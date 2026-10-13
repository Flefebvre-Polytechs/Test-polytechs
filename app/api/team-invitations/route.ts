import {database} from '@/db/raw';
import {account,checkOrigin,currentUser,hashPassword,requireRole} from '@/lib/access';
import {accessibleTeams,teamsAllowed} from '@/lib/team-access';

const levels=['viewer','user','contributor','team_admin'];
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
const fail=(error:string,status=400)=>reply({error},status);
const hex=(bytes:Uint8Array)=>Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
async function digest(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))))}
async function readBody(req:Request){
 const reader=req.body?.getReader();if(!reader)return null;
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>16384){await reader.cancel();throw Error('body-too-large')}chunks.push(part.value)}
 const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength}
 try{return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}
}
type Invitation={id:string;token_hash:string;email:string;team_id:string;team_name:string;level:string;created_by:string;expires_at:number;used_at:number|null;revoked_at:number|null};
async function invitation(token:unknown){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await database().prepare('SELECT i.*,t.name team_name FROM team_invitations i JOIN teams t ON t.id=i.team_id WHERE token_hash=?').bind(await digest(token)).first<Invitation>();
 if(!row||row.used_at||row.revoked_at||row.expires_at<=Date.now())return null;
 const issuer=await database().prepare('SELECT * FROM users WHERE id=?').bind(row.created_by).first<any>();
 if(!issuer||issuer.must_change_password||!await teamsAllowed(account(issuer),[row.team_id],true,'manage'))return null;
 return row;
}
export async function GET(req:Request){
 try{
  const gate=await requireRole(req);if(gate.error)return gate.error;
  const team=new URL(req.url).searchParams.get('team');
  const allowed=await accessibleTeams(gate.user!,true,'manage');
  if(!team||!allowed.has(team))return fail('Gestion de cette équipe non autorisée.',403);
  const result=await database().prepare('SELECT id,email,level,created_at,expires_at FROM team_invitations WHERE team_id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC').bind(team,Date.now()).all();
  return reply({invitations:result.results});
 }catch{return fail('Invitations indisponibles.',503)}
}
export async function POST(req:Request){
 try{
  if(!checkOrigin(req))return fail('Origine non autorisée.',403);
  const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body))return fail('Requête invalide.');
  const db=database();
  if(body.action==='inspect'||body.action==='accept'){
   const row=await invitation(body.token);if(!row)return fail('Cette invitation est expirée, utilisée ou révoquée.',410);
   if(body.action==='inspect')return reply({email:row.email,teamName:row.team_name,level:row.level,expiresAt:row.expires_at});
   const existing=await currentUser(req);
   if(existing&&body.useExisting!==true)return fail('Confirmez l’utilisation de votre compte connecté.');
   if(existing?.mustChangePassword)return fail('Changez votre mot de passe avant de rejoindre cette équipe.',403);
   const owner=await db.prepare('SELECT id FROM users WHERE email=?').bind(row.email).first<{id:string}>();
   if(owner&&owner.id!==existing?.id)return fail('Cette adresse appartient déjà à un compte. Connectez-vous avec ce compte pour accepter l’invitation.',409);
   const userId=existing?.id||crypto.randomUUID(),claim=crypto.randomUUID();
   const locale=['fr','en','de','it','es'].includes(body.locale)?body.locale:'fr';
   let username='',displayName='',passwordHash='';
   if(existing){
    const stored=await db.prepare('SELECT email FROM users WHERE id=?').bind(existing.id).first<{email:string|null}>();
    if(stored?.email&&stored.email!==row.email)return fail('Votre compte utilise une autre adresse e-mail.',409);
    if(existing.role==='reader'&&row.level!=='viewer')return fail('Votre compte est limité à la consultation. Un administrateur général doit modifier son rôle global.',403);
   }else{
    username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
    displayName=typeof body.displayName==='string'?body.displayName.trim():'';
    const password=typeof body.password==='string'?body.password:'';
    if(!/^[a-z0-9._-]{3,40}$/.test(username)||displayName.length<2||displayName.length>100||password.length<12||password.length>256||password.toLowerCase()===username)return fail('Choisissez un identifiant valide, un nom et un mot de passe de 12 caractères minimum distinct de l’identifiant.');
    if(await db.prepare('SELECT id FROM users WHERE username=?').bind(username).first())return fail('Cet identifiant existe déjà. Connectez-vous avec votre compte existant ou choisissez un autre identifiant.',409);
    passwordHash=await hashPassword(password);
   }
   // Every dependent write is conditioned on a unique claim. Revocation, expiry
   // and issuer permissions are checked atomically again after password hashing.
   const now=Date.now(),claimed='EXISTS (SELECT 1 FROM team_invitations WHERE id=? AND acceptance_id=?)';
   const statements=[db.prepare(`UPDATE team_invitations SET used_at=?,acceptance_id=?,consumed_by=NULL WHERE id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>? AND EXISTS (SELECT 1 FROM users u WHERE u.id=created_by AND u.must_change_password=0 AND (u.role='admin' OR (u.role='editor' AND EXISTS (SELECT 1 FROM team_members m WHERE m.user_id=u.id AND m.team_id=team_invitations.team_id AND m.level='team_admin'))))`).bind(now,claim,row.id,now)];
   if(!existing)statements.push(db.prepare(`INSERT INTO users(id,username,display_name,role,password_hash,must_change_password,created_at,email) SELECT ?,?,?,?,?,0,?,? WHERE ${claimed}`).bind(userId,username,displayName,row.level==='viewer'?'reader':'editor',passwordHash,new Date(now).toISOString(),row.email,row.id,claim));
   else statements.push(db.prepare(`UPDATE users SET email=? WHERE id=? AND (email IS NULL OR email=?) AND ${claimed}`).bind(row.email,userId,row.email,row.id,claim));
   if(!existing)statements.push(db.prepare(`INSERT INTO user_profiles(user_id,locale) SELECT ?,? WHERE ${claimed}`).bind(userId,locale,row.id,claim));
   if(existing?.role!=='admin')statements.push(db.prepare(`INSERT INTO team_members(team_id,user_id,level) SELECT ?,?,? WHERE ${claimed} ON CONFLICT(team_id,user_id) DO NOTHING`).bind(row.team_id,userId,row.level,row.id,claim));
   statements.push(db.prepare('UPDATE team_invitations SET consumed_by=? WHERE id=? AND acceptance_id=?').bind(userId,row.id,claim));
   statements.push(db.prepare(`INSERT INTO security_events(id,action,user_id,detail,created_at) SELECT ?,'team_invitation_accepted',?,?,? WHERE ${claimed}`).bind(crypto.randomUUID(),userId,row.team_id,new Date(now).toISOString(),row.id,claim));
   try{const result=await db.batch(statements);if(!result[0].meta.changes)return fail('Cette invitation est expirée, utilisée ou révoquée.',410)}catch{return fail('Le compte ou l’invitation a changé. Actualisez avant de réessayer.',409)}
   return reply({ok:true,username:existing?.username||username,existing:!!existing});
  }
  const gate=await requireRole(req);if(gate.error)return gate.error;
  if(body.action==='revoke'){
   const row=await db.prepare('SELECT team_id FROM team_invitations WHERE id=?').bind(typeof body.id==='string'?body.id:'').first<{team_id:string}>();
   if(!row||!await teamsAllowed(gate.user!,[row.team_id],true,'manage'))return fail('Gestion de cette équipe non autorisée.',403);
   await db.batch([db.prepare('UPDATE team_invitations SET revoked_at=? WHERE id=? AND used_at IS NULL AND revoked_at IS NULL').bind(Date.now(),body.id),db.prepare('INSERT INTO security_events(id,action,user_id,detail,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),'team_invitation_revoked',gate.user!.id,row.team_id,new Date().toISOString())]);
   return reply({ok:true});
  }
  if(body.action!=='invite')return fail('Action inconnue.');
  const email=typeof body.email==='string'?body.email.trim().toLowerCase():'';
  if(email.length>254||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(email)||!levels.includes(body.level)||typeof body.teamId!=='string')return fail('Renseignez une adresse e-mail et un rôle valides.');
  if(!await db.prepare('SELECT id FROM teams WHERE id=?').bind(body.teamId).first())return fail('Équipe inconnue.');
  if(!await teamsAllowed(gate.user!,[body.teamId],true,'manage'))return fail('Gestion de cette équipe non autorisée.',403);
  if(await db.prepare('SELECT id FROM users WHERE email=?').bind(email).first())return fail('Cette personne possède déjà un compte. Ajoutez-la par son nom dans la liste des membres.',409);
  const pending=await db.prepare('SELECT id FROM team_invitations WHERE email=? AND team_id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at>?').bind(email,body.teamId,Date.now()).first();
  if(pending)return fail('Une invitation est déjà en attente pour cette adresse. Révoquez-la avant d’en créer une nouvelle.',409);
  const token=hex(crypto.getRandomValues(new Uint8Array(32))),id=crypto.randomUUID(),expiresAt=Date.now()+7*24*60*60*1000;
  try{await db.batch([
   db.prepare('UPDATE team_invitations SET revoked_at=? WHERE email=? AND team_id=? AND used_at IS NULL AND revoked_at IS NULL AND expires_at<=?').bind(Date.now(),email,body.teamId,Date.now()),
   db.prepare('INSERT INTO team_invitations(id,token_hash,email,team_id,level,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,await digest(token),email,body.teamId,body.level,gate.user!.id,new Date().toISOString(),expiresAt),
   db.prepare('INSERT INTO security_events(id,action,user_id,detail,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),'team_invitation_created',gate.user!.id,body.teamId,new Date().toISOString())
  ])}catch{return fail('Une invitation est déjà en attente pour cette adresse. Révoquez-la avant d’en créer une nouvelle.',409)}
  const origin=new URL(process.env.POLYTECHS_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL||req.url).origin;
  return reply({id,email,expiresAt,url:origin+'/invitation#'+token});
 }catch(e){return e instanceof Error&&e.message==='body-too-large'?fail('Requête trop volumineuse.',413):fail('Gestion des invitations impossible.',503)}
}

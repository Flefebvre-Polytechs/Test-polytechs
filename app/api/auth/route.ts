import {after} from 'next/server';
import {startChallenge,consumeChallenge,digest} from '@/lib/email-auth';
import {emailMfaRequired,mailConfigured,validEmail} from '@/lib/security-mail';
import {database} from '@/db/raw';
import {account,needsRehash,linkSiteIdentity,throttle,clearThrottle,securityEvent,checkOrigin,checkPassword,clearCookie,currentUser,endSession,hashPassword,issueSession,sessionMaterial,userByName} from '@/lib/access';

const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){try{return Response.json({account:await currentUser(req)},{headers:{'Cache-Control':'private, no-store'}})}catch(e){console.error(e);return fail('Service de connexion indisponible.',503)}}
export async function POST(req:Request){try{if(!checkOrigin(req))return fail('Requête non autorisée.',403);const reader=req.body?.getReader();if(!reader)return fail('Demande invalide.');const chunks:Uint8Array[]=[];let size=0;for(;;){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>4096){await reader.cancel();return fail('Demande trop volumineuse.',413)}chunks.push(item.value)}const raw=Buffer.concat(chunks).toString('utf8');let body:Record<string,unknown>;try{body=JSON.parse(raw)}catch{return fail('Demande invalide.');}if(!body||typeof body!=='object')return fail('Demande invalide.');const action=body.action;
if(action==='verify-email')return consumeChallenge(body.challenge,'login',body.code);
if(action==='reset-password')return consumeChallenge(body.token,'reset','',body.newPassword);
if(action==='forgot-password'){
 if(!mailConfigured())return fail('La récupération par e-mail doit être configurée par votre administrateur.',503);
 const identifier=typeof body.identifier==='string'?body.identifier.trim().toLowerCase():'';
 if(identifier.length>254||!identifier)return fail('Renseignez votre identifiant ou votre adresse e-mail.');
 const message={ok:true,message:'Si un compte correspond et dispose d’une adresse e-mail, un lien de réinitialisation vous sera envoyé.'};
 if(await throttle('reset-request:'+digest(identifier),3,60*60000))return Response.json(message,{headers:{'Cache-Control':'private, no-store'}});
 // Never use an untrusted Host header to construct a recovery URL.
 const row=await database().prepare('SELECT * FROM users WHERE username=? OR lower(email)=? LIMIT 1').bind(identifier,identifier).first<import('@/lib/access').DbUser>();
 if(row?.email&&validEmail(row.email)&&!await throttle('reset-user:'+row.id,3,60*60000))after(async()=>{
  try{await startChallenge(row,'reset');await securityEvent('password_reset_requested',row.id)}catch{await securityEvent('security_mail_failed',row.id,'reset')}
 });
 return Response.json(message,{headers:{'Cache-Control':'private, no-store'}});
}

if(action==='login'){const username=String(body.username||'').trim().toLowerCase(),password=String(body.password||'');if(!/^[a-z0-9._-]{3,40}$/.test(username)||password.length>256)return fail('Identifiant ou mot de passe incorrect.',401);const db=database();if(await throttle('login:'+username))return fail('Trop de tentatives. Réessayez dans 15 minutes.',429);const user=await userByName(username);if(!user||!await checkPassword(password,user.password_hash)){await securityEvent('login_failed','',username);return fail('Identifiant ou mot de passe incorrect.',401)}await clearThrottle('login:'+username);if(needsRehash(user.password_hash))await db.prepare('UPDATE users SET password_hash=? WHERE id=? AND password_hash=?').bind(await hashPassword(password),user.id,user.password_hash).run();if(emailMfaRequired()){
 if(!user.email||!validEmail(user.email))return fail('Aucune adresse e-mail n’est associée à votre compte. Contactez un administrateur.',403);
 if(!mailConfigured())return fail('La vérification par e-mail est temporairement indisponible. Contactez un administrateur.',503);
 if(await throttle('mfa-send:'+user.id,3,10*60000))return fail('Trop de codes demandés. Réessayez dans 10 minutes.',429);
 // Refresh the hash snapshot after a legacy-password upgrade.
 const refreshed=await userByName(username);if(!refreshed)return fail('Compte indisponible.',401);
 const challenge=await startChallenge(refreshed,'login');await securityEvent('login_code_requested',user.id);return Response.json({requiresEmailCode:true,...challenge},{headers:{'Cache-Control':'private, no-store'}});
}
await linkSiteIdentity(req,user.id);await securityEvent('login',user.id);const response=Response.json({account:account(user)});response.headers.set('Cache-Control','private, no-store');response.headers.set('Set-Cookie',await issueSession(user.id));return response}
if(action==='logout'){await endSession(req);const response=Response.json({ok:true});response.headers.set('Cache-Control','private, no-store');response.headers.set('Set-Cookie',clearCookie);return response}
if(action==='password'){const user=await currentUser(req);if(!user)return fail('Connexion nécessaire.',401);const oldPassword=String(body.oldPassword||''),newPassword=String(body.newPassword||'');if(newPassword.length<12||newPassword.length>256||newPassword.toLowerCase()===user.username)return fail('Choisissez un mot de passe de 12 caractères minimum, différent de votre identifiant.');const row=await userByName(user.username);if(await throttle('password:'+user.id))return fail('Trop de tentatives. Réessayez dans 15 minutes.',429);if(!row||!await checkPassword(oldPassword,row.password_hash))return fail('Mot de passe actuel incorrect.',401);const db=database(),nextHash=await hashPassword(newPassword),session=await sessionMaterial();
const updated="EXISTS (SELECT 1 FROM users WHERE id=? AND password_hash=?)";
const result=await db.batch([
 db.prepare('UPDATE users SET password_hash=?,must_change_password=0 WHERE id=? AND password_hash=?').bind(nextHash,user.id,row.password_hash),
 db.prepare(`DELETE FROM sessions WHERE user_id=? AND ${updated}`).bind(user.id,user.id,nextHash),
 db.prepare(`DELETE FROM site_identities WHERE user_id=? AND ${updated}`).bind(user.id,user.id,nextHash),
 db.prepare(`DELETE FROM auth_challenges WHERE user_id=? AND ${updated}`).bind(user.id,user.id,nextHash),
 db.prepare(`INSERT INTO sessions(token_hash,user_id,expires_at,email_verified) SELECT ?,?,?,? WHERE ${updated}`).bind(session.hash,user.id,session.expires,emailMfaRequired()?1:0,user.id,nextHash)
]);if(!result[0].meta.changes)return fail('Le compte a changé. Reconnectez-vous avant de réessayer.',409);
await clearThrottle('password:'+user.id);await linkSiteIdentity(req,user.id);await securityEvent('password_changed',user.id);const response=Response.json({account:{...user,mustChangePassword:false}});response.headers.set('Cache-Control','private, no-store');response.headers.set('Set-Cookie',session.cookie);return response}
return fail('Action inconnue.');}catch(e){console.error(e);return fail('Opération impossible. Réessayez.',503)}}

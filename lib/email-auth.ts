import {randomBytes,randomInt,createHash,timingSafeEqual} from 'node:crypto';
import {database} from '@/db/raw';
import {hashPassword,sessionMaterial,throttle,type DbUser} from './access';
import {publicOrigin,sendSecurityMail,validEmail} from './security-mail';
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const noStore={'Cache-Control':'private, no-store'};
export const authReply=(value:unknown,status=200)=>Response.json(value,{status,headers:noStore});
export const authError=(error:string,status=400)=>authReply({error},status);
export async function startChallenge(user:DbUser,purpose:'login'|'reset'){
 if(!user.email||!validEmail(user.email))throw Error('Account email missing.');
 const token=randomBytes(32).toString('hex'),code=purpose==='login'?String(randomInt(0,1000000)).padStart(6,'0'):'';
 const expiresAt=Date.now()+(purpose==='login'?10:30)*60000,db=database(),tokenHash=digest(token);
 // Bound retained challenge storage; expired rows never authorize any operation.
 await db.prepare('DELETE FROM auth_challenges WHERE expires_at<?').bind(Date.now()-86400000).run();
 await db.prepare('INSERT INTO auth_challenges(token_hash,user_id,purpose,secret_hash,email,password_snapshot,expires_at) VALUES(?,?,?,?,?,?,?)').bind(tokenHash,user.id,purpose,digest(token+':'+code),user.email,user.password_hash,expiresAt).run();
 try{await sendSecurityMail(user.email,purpose==='login'?'Polytechs Connect — Code de connexion':'Polytechs Connect — Réinitialisation du mot de passe',purpose==='login'?`Votre code de connexion Polytechs Connect : ${code}\n\nValable 10 minutes, pour une seule connexion. Ne partagez jamais ce code. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message et contactez votre administrateur.`:`Pour choisir un nouveau mot de passe, ouvrez ce lien valable 30 minutes :\n${publicOrigin()}/reinitialisation#reset=${token}\n\nCe lien est à usage unique. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message. Votre mot de passe reste inchangé.`)}catch{await db.prepare('DELETE FROM auth_challenges WHERE token_hash=?').bind(tokenHash).run();throw Error('Security mail unavailable.');}
 return {challenge:token,expiresAt,destination:user.email.replace(/^(.).*(@.*)$/,'$1•••$2')};
}
type Challenge={token_hash:string;user_id:string;purpose:string;secret_hash:string;email:string;password_snapshot:string;expires_at:number;attempts:number;used_at:number|null};
export async function consumeChallenge(token:unknown,purpose:'login'|'reset',code:unknown,newPassword?:unknown){
 if(typeof token!=='string'||!(/^[a-f0-9]{64}$/.test(token)))return authError('Lien ou code invalide ou expiré.',410);
 const db=database(),tokenHash=digest(token);
 if(await throttle('challenge:'+tokenHash,10))return authError('Trop de tentatives. Demandez un nouveau code ou lien.',429);
 const row=await db.prepare('SELECT * FROM auth_challenges WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>? AND attempts<5').bind(tokenHash,purpose,Date.now()).first<Challenge>();
 if(!row)return authError('Lien ou code invalide ou expiré.',410);
 const attempt=await db.prepare('UPDATE auth_challenges SET attempts=attempts+1 WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND attempts<5 RETURNING attempts').bind(tokenHash,Date.now()).first<{attempts:number}>();
 if(!attempt)return authError('Lien ou code invalide ou expiré.',410);
 const candidate=digest(token+':'+(purpose==='login'&&typeof code==='string'?code:''));
 if(purpose==='login'&&(typeof code!=='string'||!/^\d{6}$/.test(code)||!timingSafeEqual(Buffer.from(row.secret_hash,'hex'),Buffer.from(candidate,'hex'))))return authError('Code incorrect. Après 5 essais, demandez un nouveau code.',401);
 const user=await db.prepare('SELECT * FROM users WHERE id=? AND email=? AND password_hash=?').bind(row.user_id,row.email,row.password_snapshot).first<DbUser>();
 if(!user)return authError('Le compte a changé. Recommencez la connexion.',410);
 let passwordHash='';if(purpose==='reset'){
  if(typeof newPassword!=='string'||newPassword.length<12||newPassword.length>256||(newPassword.toLowerCase()===user.username||newPassword.toLowerCase()===user.email?.toLowerCase()))return authError('Choisissez un mot de passe de 12 caractères minimum, différent de votre adresse e-mail.');
  passwordHash=await hashPassword(newPassword);
 }
 const claim=crypto.randomUUID(),now=Date.now(),material=purpose==='login'?await sessionMaterial():null;
 const claimed='EXISTS (SELECT 1 FROM auth_challenges WHERE token_hash=? AND claim=?)';
 const statements=[db.prepare('UPDATE auth_challenges SET used_at=?,claim=? WHERE token_hash=? AND used_at IS NULL AND expires_at>? AND attempts<=5 AND EXISTS (SELECT 1 FROM users WHERE id=user_id AND email=auth_challenges.email AND password_hash=password_snapshot)').bind(now,claim,tokenHash,now)];
 if(material)statements.push(db.prepare(`INSERT INTO sessions(token_hash,user_id,expires_at,email_verified,last_activity_at) SELECT ?,?,?,1,? WHERE ${claimed}`).bind(material.hash,user.id,material.expires,material.lastActivityAt,tokenHash,claim));
 else{
  statements.push(db.prepare(`UPDATE users SET password_hash=?,must_change_password=0 WHERE id=? AND ${claimed}`).bind(passwordHash,user.id,tokenHash,claim));
  statements.push(db.prepare(`DELETE FROM sessions WHERE user_id=? AND ${claimed}`).bind(user.id,tokenHash,claim));
  statements.push(db.prepare(`DELETE FROM site_identities WHERE user_id=? AND ${claimed}`).bind(user.id,tokenHash,claim));
  statements.push(db.prepare(`UPDATE auth_challenges SET used_at=? WHERE user_id=? AND used_at IS NULL AND ${claimed}`).bind(now,user.id,tokenHash,claim));
 }
 statements.push(db.prepare(`INSERT INTO security_events(id,action,user_id,detail,created_at) SELECT ?,?,?,'',? WHERE ${claimed}`).bind(crypto.randomUUID(),purpose==='login'?'login_email_verified':'password_reset',user.id,new Date(now).toISOString(),tokenHash,claim));
 const result=await db.batch(statements);if(!result[0].meta.changes)return authError('Lien ou code déjà utilisé ou expiré.',410);
 if(material){const response=authReply({account:{id:user.id,username:user.username,displayName:user.display_name,role:user.role,mustChangePassword:!!user.must_change_password,email:user.email}});response.headers.set('Set-Cookie',material.cookie);return response;}
 return authReply({ok:true});
}

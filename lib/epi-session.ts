import {database} from '@/db/raw';
import {account,currentUser,type Account,type DbUser} from './access';
import {epiCanRead} from './epi-access';

const COOKIE='qse_epi_device';
export const EPI_DEVICE_DAYS=90;
const lifetime=EPI_DEVICE_DAYS*24*60*60*1000;
function tokenFrom(req:Request){return req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
// Domain separation prevents a remembered scan token being used as a full-site session.
async function digest(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('epi-device:'+token))),b=>b.toString(16).padStart(2,'0')).join('')}
const cookie=(token:string,maxAge=lifetime/1000)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const clearEpiCookie=cookie('',0);
async function deviceUser(req:Request){const token=tokenFrom(req);if(!/^[a-f0-9]{64}$/.test(token))return null;const row=await database().prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>? AND (?=0 OR s.email_verified=1)').bind(await digest(token),Date.now(),process.env.POLYTECHS_EMAIL_MFA_REQUIRED==='true'?1:0).first<DbUser>();return row?account(row):null}
export async function currentEpiUser(req:Request){const user=await currentUser(req)||await deviceUser(req);return user&&!user.mustChangePassword&&await epiCanRead(user)?user:null}
export async function requireEpiRole(req:Request,write=false){const user=await currentUser(req)||await deviceUser(req);if(!user)return {error:Response.json({error:'Connexion EPI nécessaire.'},{status:401})};if(user.mustChangePassword)return {error:Response.json({error:'Changez votre mot de passe avant de continuer.'},{status:403})};if(write&&!['editor','admin'].includes(user.role))return {error:Response.json({error:'Accès non autorisé pour votre rôle.'},{status:403})};return {user}}
export async function rememberEpiDevice(req:Request,user:Account){
 const old=tokenFrom(req),oldUser=await deviceUser(req),db=database();
 const token=oldUser?.id===user.id?old:Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 if(old&&old!==token&&/^[a-f0-9]{64}$/.test(old))await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(old)).run();
 // The session is shared with existing revocation/password-reset mechanisms, never the QR code.
 await db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,email_verified) VALUES(?,?,?,?) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at').bind(await digest(token),user.id,Date.now()+lifetime,process.env.POLYTECHS_EMAIL_MFA_REQUIRED==='true'?1:0).run();
 return cookie(token);
}
export async function endEpiSession(req:Request){const token=tokenFrom(req);if(/^[a-f0-9]{64}$/.test(token))await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run()}

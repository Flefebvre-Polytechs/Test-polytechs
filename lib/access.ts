import {pbkdf2Async} from '@noble/hashes/pbkdf2.js';
import {sha256} from '@noble/hashes/sha2.js';
import {trustSiteIdentity} from './auth-config';
import {database} from '@/db/raw';

export type Role='admin'|'editor'|'reader';
export type Account={id:string;username:string;displayName:string;role:Role;mustChangePassword:boolean};
type DbUser={id:string;username:string;display_name:string;role:Role;password_hash:string;must_change_password:number};
const encoder=new TextEncoder();
const COOKIE='qse_session';
const DAYS=7*24*60*60*1000;

function hex(bytes:Uint8Array){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('')}
function unhex(value:string){return Uint8Array.from(value.match(/.{2}/g)??[],x=>parseInt(x,16))}
async function sha(value:string){return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))))}
const ITERATIONS=600000;
async function derive(password:string,salt:Uint8Array,iterations:number){
 const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
 try{return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt as Uint8Array<ArrayBuffer>,iterations},key,256))}
 catch(e){if(!(e instanceof Error)||!(/iteration|not supported/i.test(e.message)))throw e;return pbkdf2Async(sha256,encoder.encode(password),salt,{c:iterations,dkLen:32})}
}
export async function hashPassword(password:string){const salt=crypto.getRandomValues(new Uint8Array(16));return `pbkdf2:${ITERATIONS}:${hex(salt)}:${hex(await derive(password,salt,ITERATIONS))}`}
export async function checkPassword(password:string,stored:string){const m=/^pbkdf2:(100000|600000):([a-f0-9]{32}):([a-f0-9]{64})$/.exec(stored);if(!m||password.length>256)return false;const found=await derive(password,unhex(m[2]),Number(m[1])),expected=unhex(m[3]);let different=0;for(let i=0;i<found.length;i++)different|=found[i]^expected[i];return different===0}
export function needsRehash(stored:string){return !stored.startsWith(`pbkdf2:${ITERATIONS}:`)}
export function siteIdentity(req:Request){if(!trustSiteIdentity())return '';const id=req.headers.get('oai-authenticated-user-id')||'';return id.length>0&&id.length<=200&&!!req.headers.get('oai-authenticated-user-email')?id:''}
export async function linkSiteIdentity(req:Request,userId:string){const id=siteIdentity(req);if(id)await database().prepare('INSERT INTO site_identities(identity_id,user_id,expires_at) VALUES(?,?,?) ON CONFLICT(identity_id) DO UPDATE SET user_id=excluded.user_id,expires_at=excluded.expires_at').bind(id,userId,Date.now()+DAYS).run()}
export async function securityEvent(action:string,userId='',detail=''){await database().prepare('INSERT INTO security_events(id,action,user_id,detail,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),action,userId,detail.slice(0,300),new Date().toISOString()).run()}
// A persisted fixed window, incremented atomically before expensive verification.
export async function throttle(key:string,max=5,window=15*60*1000){const now=Date.now();const row=await database().prepare('INSERT INTO security_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<=? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING attempts').bind(key,now+window,now,now).first<{attempts:number}>();return !row||row.attempts>max}
export async function clearThrottle(key:string){await database().prepare('DELETE FROM security_limits WHERE key=?').bind(key).run()}
export function account(user:DbUser):Account{return {id:user.id,username:user.username,displayName:user.display_name,role:user.role,mustChangePassword:!!user.must_change_password}}
function cookieValue(req:Request){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1)||''}
export async function currentUser(req:Request):Promise<Account|null>{const token=cookieValue(req);if(/^[a-f0-9]{64}$/.test(token)){const row=await database().prepare('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha(token),Date.now()).first<DbUser>();if(row)return account(row)}
const identity=siteIdentity(req);if(identity){const row=await database().prepare('SELECT u.* FROM site_identities s JOIN users u ON u.id=s.user_id WHERE s.identity_id=? AND s.expires_at>?').bind(identity,Date.now()).first<DbUser>();if(row)return account(row)}
return null}
export async function requireRole(req:Request,role:Role='reader'){const user=await currentUser(req);if(!user)return {error:Response.json({error:'Connexion nécessaire.'},{status:401})};if(!['reader','editor','admin'].includes(user.role))return {error:Response.json({error:'Rôle invalide.'},{status:403})};if(user.mustChangePassword)return {error:Response.json({error:'Changez votre mot de passe avant de continuer.'},{status:403})};if(({reader:0,editor:1,admin:2})[user.role]<({reader:0,editor:1,admin:2})[role])return {error:Response.json({error:'Accès non autorisé pour votre rôle.'},{status:403})};return {user}}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');const configured=process.env.POLYTECHS_PUBLIC_ORIGIN||process.env.RENDER_EXTERNAL_URL;return !!origin&&origin===(configured?new URL(configured).origin:new URL(req.url).origin)}
export async function issueSession(userId:string){const token=hex(crypto.getRandomValues(new Uint8Array(32)));await database().prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha(token),userId,Date.now()+DAYS).run();return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=${DAYS/1000}`}
export async function endSession(req:Request){const id=siteIdentity(req);if(id)await database().prepare('DELETE FROM site_identities WHERE identity_id=?').bind(id).run();const token=cookieValue(req);if(/^[a-f0-9]{64}$/.test(token))await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token)).run()}
export const clearCookie=`${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`;
export async function userByName(username:string){return database().prepare('SELECT * FROM users WHERE username=?').bind(username).first<DbUser>()}

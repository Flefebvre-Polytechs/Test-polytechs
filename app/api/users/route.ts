import {mailConfigured,emailMfaRequired,validEmail} from '@/lib/security-mail';
import {checkPassword,userByName,throttle} from '@/lib/access';
import {database} from '@/db/raw';
import {checkOrigin,hashPassword,requireRole,securityEvent} from '@/lib/access';
const roles=['admin','editor','reader'];
export async function GET(req:Request){try{const gate=await requireRole(req,'admin');if(gate.error)return gate.error;return Response.json({users:(await database().prepare("SELECT u.id,u.username,u.display_name,u.role,u.must_change_password,u.created_at,u.email,CASE WHEN p.photo_key IS NOT NULL AND p.photo_key<>'' THEN p.photo_updated_at ELSE NULL END AS photo_updated_at,CASE WHEN em.user_id IS NULL THEN 0 ELSE 1 END AS epi_manager FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id LEFT JOIN epi_managers em ON em.user_id=u.id ORDER BY u.display_name").all()).results,emailSecurity:{configured:mailConfigured(),required:emailMfaRequired()}},{headers:{'Cache-Control':'private, no-store'}})}catch(e){console.error(e);return Response.json({error:'Comptes indisponibles.'},{status:503})}}
export async function POST(req:Request){try{if(!checkOrigin(req))return Response.json({error:'Requête non autorisée.'},{status:403});const gate=await requireRole(req,'admin');if(gate.error)return gate.error;const b=await req.json() as Record<string,unknown>,db=database();if(b.action==='name'){
 const id=typeof b.id==='string'?b.id:'',name=typeof b.displayName==='string'?b.displayName.trim():'',previous=typeof b.expectedName==='string'?b.expectedName:'';
 if(!id||name.length<2||name.length>100||!previous)return Response.json({error:'Nom invalide.'},{status:400});
 const changed=await db.prepare('UPDATE users SET display_name=? WHERE id=? AND display_name=?').bind(name,id,previous).run();
 if(!changed.meta.changes)return Response.json({error:'Le compte a changé. Actualisez avant de réessayer.'},{status:409});
 await securityEvent('user_name_changed',gate.user!.id,id);return Response.json({ok:true});
}
if(b.action==='revoke-sessions'){
 const id=typeof b.id==='string'?b.id:'';
 if(!id||!await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first())return Response.json({error:'Compte introuvable.'},{status:404});
 await db.batch([db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),db.prepare('DELETE FROM site_identities WHERE user_id=?').bind(id),db.prepare('DELETE FROM auth_challenges WHERE user_id=?').bind(id)]);
 await securityEvent('user_sessions_revoked',gate.user!.id,id);return Response.json({ok:true});
}
if(b.action==='epi-manager'){
 const id=typeof b.id==='string'?b.id:'',enabled=b.enabled,expected=b.expected;
 if(!id||typeof enabled!=='boolean'||typeof expected!=='boolean')return Response.json({error:'Droit EPI invalide.'},{status:400});
 const target=await db.prepare('SELECT role FROM users WHERE id=?').bind(id).first<{role:string}>();
 if(!target)return Response.json({error:'Compte introuvable.'},{status:404});
 if(target.role==='admin')return Response.json({error:'Un administrateur global possède déjà ce droit.'},{status:400});
 if(enabled&&target.role!=='editor')return Response.json({error:'Attribuez d’abord le rôle global Contributeur à cette personne.'},{status:400});
 const current=!!await db.prepare('SELECT 1 FROM epi_managers WHERE user_id=?').bind(id).first();
 if(current!==expected||current===enabled)return Response.json({error:'Ce droit a changé. Actualisez avant de réessayer.'},{status:409});
 const changed=enabled?await db.prepare("INSERT INTO epi_managers(user_id,granted_by,granted_at) SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM users WHERE id=? AND role='editor') AND NOT EXISTS (SELECT 1 FROM epi_managers WHERE user_id=?)").bind(id,gate.user!.id,new Date().toISOString(),id,id).run():await db.prepare('DELETE FROM epi_managers WHERE user_id=?').bind(id).run();
 if(!changed.meta.changes)return Response.json({error:'Ce droit a changé. Actualisez avant de réessayer.'},{status:409});
 await securityEvent(enabled?'epi_manager_granted':'epi_manager_revoked',gate.user!.id,id);return Response.json({ok:true});
}
if(b.action==='email'){
 const id=String(b.id||''),email=String(b.email||'').trim().toLowerCase(),password=String(b.currentPassword||'');
 if(!validEmail(email))return Response.json({error:'Adresse e-mail invalide.'},{status:400});
 if(await throttle('admin-email:'+gate.user!.id))return Response.json({error:'Trop de tentatives.'},{status:429});
 const admin=await userByName(gate.user!.username);if(!admin||!await checkPassword(password,admin.password_hash))return Response.json({error:'Confirmez votre mot de passe administrateur.'},{status:401});
 if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(id).first())return Response.json({error:'Compte introuvable.'},{status:404});
 if(await db.prepare('SELECT id FROM users WHERE lower(email)=? AND id<>?').bind(email,id).first())return Response.json({error:'Cette adresse appartient déjà à un compte.'},{status:409});
 await db.batch([db.prepare('UPDATE users SET email=? WHERE id=?').bind(email,id),db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),db.prepare('DELETE FROM site_identities WHERE user_id=?').bind(id),db.prepare('DELETE FROM auth_challenges WHERE user_id=?').bind(id)]);
 await securityEvent('recovery_email_changed',gate.user!.id,id);return Response.json({ok:true});
}
if(b.action==='create'){const id=crypto.randomUUID(),username='u.'+crypto.randomUUID().replaceAll('-',''),displayName=String(b.displayName||'').trim(),role=String(b.role||''),password=String(b.password||''),email=String(b.email||'').trim().toLowerCase();if(!validEmail(email))return Response.json({error:'Une adresse e-mail valide est nécessaire.'},{status:400});if(displayName.length<2||displayName.length>100||!roles.includes(role)||password.length<12||password.length>256||password.toLowerCase()===email)return Response.json({error:'Renseignez un nom et un mot de passe d’au moins 12 caractères différent de l’adresse e-mail.'},{status:400});if(await db.prepare('SELECT id FROM users WHERE lower(trim(email))=?').bind(email).first())return Response.json({error:'Cette adresse e-mail possède déjà un compte.'},{status:409});await db.prepare('INSERT INTO users (id,username,display_name,role,password_hash,must_change_password,created_at,email) VALUES (?,?,?,?,?,?,?,?)').bind(id,username,displayName,role,await hashPassword(password),1,new Date().toISOString(),email).run();await securityEvent('user_created',gate.user!.id,email+' / '+role);return Response.json({ok:true,id})}
if(b.action==='role'){const id=String(b.id||''),role=String(b.role||'');if(!roles.includes(role)||!id)return Response.json({error:'Rôle invalide.'},{status:400});if(id===gate.user?.id&&role!=='admin')return Response.json({error:'Vous ne pouvez pas retirer vos propres droits administrateur.'},{status:400});const target=await db.prepare('SELECT role FROM users WHERE id=?').bind(id).first<{role:string}>();if(!target)return Response.json({error:'Compte introuvable.'},{status:404});if(target.role==='admin'&&role!=='admin'){const count=await db.prepare("SELECT count(*) as total FROM users WHERE role='admin'").first<{total:number}>();if((count?.total||0)<=1)return Response.json({error:'Conservez au moins un administrateur.'},{status:400})}if(b.expectedRole!==undefined&&b.expectedRole!==target.role)return Response.json({error:'Le rôle a changé. Actualisez avant de réessayer.'},{status:409});
const changedRole=await db.prepare("UPDATE users SET role=? WHERE id=? AND role=? AND (role<>'admin' OR ?='admin' OR (SELECT count(*) FROM users WHERE role='admin')>1)").bind(role,id,target.role,role).run();
if(!changedRole.meta.changes)return Response.json({error:'Le rôle a changé ou le dernier administrateur doit être conservé.',},{status:409});
await db.batch([db.prepare('DELETE FROM sessions WHERE user_id=?').bind(id),db.prepare('DELETE FROM site_identities WHERE user_id=?').bind(id),db.prepare('DELETE FROM auth_challenges WHERE user_id=?').bind(id),...(role==='editor'?[]:[db.prepare('DELETE FROM epi_managers WHERE user_id=?').bind(id)])]);await securityEvent('role_changed',gate.user!.id,id+' / '+role);return Response.json({ok:true})}
return Response.json({error:'Action inconnue.'},{status:400})}catch(e){console.error(e);return Response.json({error:'Modification impossible. Vérifiez que l’identifiant est disponible.'},{status:503})}}

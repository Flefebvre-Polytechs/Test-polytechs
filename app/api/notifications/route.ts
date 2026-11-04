import {database} from '@/db/raw';
import {checkOrigin,requireRole,notificationSessionKey} from '@/lib/access';
import {visibleNotifications} from '@/lib/notification-access';
const fail=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){try{
 const gate=await requireRole(req);if(gate.error)return gate.error;const session=await notificationSessionKey(req);if(!session)return fail('Reconnectez-vous pour consulter les notifications.',401);
 return Response.json({notifications:await visibleNotifications(req,gate.user!,session)},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){console.error(e);return fail('Notifications indisponibles. Réessayez avant de continuer.',503)}}
export async function POST(req:Request){try{
 if(!checkOrigin(req))return fail('Origine non autorisée.',403);const gate=await requireRole(req);if(gate.error)return gate.error;
 const session=await notificationSessionKey(req);if(!session)return fail('Connexion requise.',401);
 const body=await req.json() as Record<string,unknown>;if(typeof body.id!=='string'||body.id.length>300||!['acknowledge','later'].includes(String(body.action)))return fail('Choisissez une notification et une action valide.');
 const visible=await visibleNotifications(req,gate.user!,session);if(!visible.some(n=>n.id===body.id))return fail('Notification déjà traitée ou non accessible. Actualisez.',409);
 const db=database(),now=new Date().toISOString();
 if(body.action==='acknowledge')await db.batch([
  db.prepare("INSERT INTO notification_receipts(notification_id,user_id,acknowledged_at) SELECT id,user_id,? FROM hub_notifications WHERE id=? AND user_id=? ON CONFLICT(notification_id) DO UPDATE SET acknowledged_at=excluded.acknowledged_at,deferred_session=NULL,deferred_at=NULL WHERE notification_receipts.user_id=excluded.user_id").bind(now,body.id,gate.user!.id),
  db.prepare('UPDATE hub_notifications SET seen=1 WHERE id=? AND user_id=?').bind(body.id,gate.user!.id)
 ]);
 else await db.prepare("INSERT INTO notification_receipts(notification_id,user_id,deferred_session,deferred_at) SELECT id,user_id,?,? FROM hub_notifications WHERE id=? AND user_id=? ON CONFLICT(notification_id) DO UPDATE SET deferred_session=excluded.deferred_session,deferred_at=excluded.deferred_at WHERE notification_receipts.user_id=excluded.user_id AND notification_receipts.acknowledged_at IS NULL").bind(session,now,body.id,gate.user!.id).run();
 return Response.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});
}catch(e){console.error(e);return fail('Impossible d’enregistrer votre choix. Réessayez.',503)}}

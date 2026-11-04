import {database} from '@/db/raw';
import {accessibleTeams,teamContentVisible} from './team-access';
import type {Account} from './access';
import {planAccess} from './prevention-documents';
export type UserNotification={id:string;title:string;href:string;seen:number;created_at:string;context?:string};
export async function visibleNotifications(req:Request,user:Account,pendingSession?:string){
 const db=database(),allowed=await accessibleTeams(user),visible:UserNotification[]=[];
 const filter=pendingSession?" AND NOT EXISTS (SELECT 1 FROM notification_receipts r WHERE r.notification_id=n.id AND r.user_id=n.user_id AND (r.acknowledged_at IS NOT NULL OR r.deferred_session=?))":'';
 // Scan in bounded pages so old acknowledgements and inaccessible records cannot hide pending messages.
 for(let offset=0;offset<10000&&visible.length<100;offset+=100){
  const statement=db.prepare('SELECT n.* FROM hub_notifications n WHERE n.user_id=?'+filter+' ORDER BY n.created_at DESC,n.id DESC LIMIT 100 OFFSET ?');
  const rows=(await (pendingSession?statement.bind(user.id,pendingSession,offset):statement.bind(user.id,offset)).all()).results as UserNotification[];
  for(const n of rows){const url=new URL(n.href,'https://local.invalid');if(url.origin!=='https://local.invalid')continue;let canRead=false,context='';
   if(url.pathname==='/tickets'){const ticket=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(url.searchParams.get('id')||'').first<{data:string}>();if(ticket){const data=JSON.parse(ticket.data);canRead=teamContentVisible(allowed,data.teams||[],user.role==='admin');context=data.description||''}}
   else if(url.pathname==='/plans-prevention'){const plan=await planAccess(user,url.searchParams.get('record')||'');canRead=!!plan;if(plan)context=[plan.details.planType?'PDP '+plan.details.planType.toLowerCase():'Plan de prévention',plan.details.contractor,plan.details.place,plan.details.start?'Début : '+plan.details.start:'',plan.details.inspection?'Inspection : '+plan.details.inspection:'',plan.status,plan.details.operation].filter(Boolean).join(' · ')}
   else if(url.pathname==='/ged'){const id=url.searchParams.get('document');if(id){const {GET}=await import('@/app/api/ged/route');canRead=(await GET(new Request(new URL('/api/ged?id='+encodeURIComponent(id),req.url),{headers:req.headers}))).ok}}
   else if(url.pathname==='/maintenance'){const id=url.searchParams.get('order');if(id){const {GET}=await import('@/app/api/gmao/route');canRead=(await GET(new Request(new URL('/api/gmao?kind=order&id='+encodeURIComponent(id),req.url),{headers:req.headers}))).ok}}
   if(canRead)visible.push({...n,context:context.slice(0,3000)});if(visible.length>=100)break;
  }
  if(rows.length<100)break;
 }
 return visible;
}

import {database} from '@/db/raw';
import {accessibleTeams,teamContentVisible} from './team-access';
import type {Account} from './access';
import type {Ticket} from './hub';
import {planAccess} from './prevention-documents';
export type UserNotification={id:string;title:string;href:string;seen:number;created_at:string;context?:string};
export async function visibleNotifications(req:Request,user:Account,pendingSession?:string){
 const db=database(),allowed=await accessibleTeams(user),visible:UserNotification[]=[];
 const filter=pendingSession?" AND NOT EXISTS (SELECT 1 FROM notification_receipts r WHERE r.notification_id=n.id AND r.user_id=n.user_id AND (r.acknowledged_at IS NOT NULL OR r.deferred_session=?))":'';
 const latestAssignment=` AND (n.id NOT LIKE 'ticket-action:%' OR NOT EXISTS (
  SELECT 1 FROM hub_notifications newer
  WHERE newer.user_id=n.user_id AND newer.href=n.href AND newer.rowid>n.rowid
 ))`;
 // Scan in bounded pages so old acknowledgements and inaccessible records cannot hide pending messages.
 for(let offset=0;offset<10000&&visible.length<100;offset+=100){
  const statement=db.prepare('SELECT n.* FROM hub_notifications n WHERE n.user_id=?'+filter+latestAssignment+' ORDER BY n.created_at DESC,n.id DESC LIMIT 100 OFFSET ?');
  const rows=(await (pendingSession?statement.bind(user.id,pendingSession,offset):statement.bind(user.id,offset)).all()).results as UserNotification[];
  for(const n of rows){const url=new URL(n.href,'https://local.invalid');if(url.origin!=='https://local.invalid')continue;let canRead=false,context='';
   if(url.pathname==='/tickets'){
    const ticketId=url.searchParams.get('id')||'';
    const ticket=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(ticketId).first<{data:string}>();
    if(ticket){
     const data=JSON.parse(ticket.data) as Ticket;
     canRead=teamContentVisible(allowed,data.teams||[],user.role==='admin');
     context=data.description||'';
     if(n.id.startsWith('ticket-action:')){
      const action=data.actions?.find(action=>action.id===url.searchParams.get('action'));
      if(!action||data.archivedAt||action.pilot!==user.id)continue;
      if(!canRead&&data.gmaoOrderId&&!data.teams.includes('rh')){
       const {gmaoTicketReader}=await import('@/lib/gmao-server');
       canRead=await gmaoTicketReader(user,ticketId);
      }
      context=['Ticket · '+data.title,action.due?'Échéance '+action.due.split('-').reverse().join('/'):'',
       action.done?'Action réalisée':''].filter(Boolean).join(' · ');
     }
    }
   }
   else if(url.pathname==='/plans-prevention'){const plan=await planAccess(user,url.searchParams.get('record')||'');canRead=!!plan;if(plan)context=[plan.details.planType?'PDP '+plan.details.planType.toLowerCase():'Plan de prévention',plan.details.contractor,plan.details.place,plan.details.start?'Début : '+plan.details.start:'',plan.details.inspection?'Inspection : '+plan.details.inspection:'',plan.status,plan.details.operation].filter(Boolean).join(' · ')}
   else if(url.pathname==='/ged'){const id=url.searchParams.get('document');if(id){const {GET}=await import('@/app/api/ged/route');canRead=(await GET(new Request(new URL('/api/ged?id='+encodeURIComponent(id),req.url),{headers:req.headers}))).ok}}
   else if(url.pathname==='/maintenance'){const id=url.searchParams.get('order');if(id){const {GET}=await import('@/app/api/gmao/route');canRead=(await GET(new Request(new URL('/api/gmao?kind=order&id='+encodeURIComponent(id),req.url),{headers:req.headers}))).ok}}
   if(canRead)visible.push({...n,context:context.slice(0,3000)});if(visible.length>=100)break;
  }
  if(rows.length<100)break;
 }
 return visible;
}

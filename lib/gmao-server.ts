import {database} from '@/db/raw';
import {accessibleTeams} from './team-access';
import type {Account} from './access';
import type {GmaoOrder,GmaoRow} from './gmao';
export const parseGmao=(r:any)=>({...r,data:JSON.parse(r.data)});
export async function gmaoOrders(){return (await database().prepare('SELECT * FROM gmao_orders ORDER BY updated_at DESC').all()).results.map(parseGmao) as GmaoRow<GmaoOrder>[]}
export async function maintenanceWriter(user:Account){return (await accessibleTeams(user,true)).has('maintenance')}
export async function gmaoTicketContributor(user:Account,ticketId:string,capability:'coordinate'|'contribute'='coordinate'){if(user.role==='reader')return false;const row=await database().prepare('SELECT data FROM gmao_orders WHERE ticket_id=?').bind(ticketId).first<any>();if(!row)return false;const o=JSON.parse(row.data);if(o.teamId==='rh'&&!(await accessibleTeams(user)).has('rh'))return false;const permitted=await accessibleTeams(user,true,capability);return (o.teamId!=='rh'||permitted.has('rh'))&&!['Clôturée','Annulée'].includes(o.status)&&(o.requesterId===user.id&&permitted.has(o.teamId)||permitted.has('maintenance'))}

export async function gmaoTicketReader(user:Account,ticketId:string){const row=await database().prepare('SELECT data FROM gmao_orders WHERE ticket_id=?').bind(ticketId).first<any>();if(!row)return false;const o=JSON.parse(row.data);if(o.teamId==='rh'&&!(await accessibleTeams(user)).has('rh'))return false;return o.requesterId===user.id||(await accessibleTeams(user)).has('maintenance')}

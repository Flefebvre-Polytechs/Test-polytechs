import {createHash} from 'node:crypto';
import {database} from '@/db/raw';
import {requireRole,checkOrigin} from '@/lib/access';
import {parseQualityImport,qualityImportTicket,type ImportAccount} from '@/lib/quality-ticket-import';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
async function read(req:Request){const reader=req.body?.getReader();if(!reader)throw Error('Fichier vide.');let size=0;const chunks:Uint8Array[]=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>7_500_000){await reader.cancel();throw Error('Fichier limité à 7,5 Mo.')}chunks.push(value)}const buffer=new Uint8Array(size);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(buffer))}
export async function POST(req:Request){try{
 if(!checkOrigin(req))return reply({error:'Origine non autorisée.'},403);
 const gate=await requireRole(req,'admin');if(gate.error)return gate.error;
 let body:any,input:ReturnType<typeof parseQualityImport>;
 try{body=await read(req);input=parseQualityImport(body.source)}catch(e){return reply({error:(e as Error).message},400)}
 const db=database();const users=(await db.prepare('SELECT id,display_name FROM users').all()).results as ImportAccount[],teams=new Set((await db.prepare('SELECT id FROM teams').all()).results.map(t=>t.id));
 let tickets:ReturnType<typeof qualityImportTicket>[];
 try{tickets=input.records.map(a=>qualityImportTicket(a,input.source,users));for(const {ticket} of tickets)if(!teams.has(ticket.teams[0]))throw Error('Service inconnu : '+ticket.teams[0]);}catch(e){return reply({error:(e as Error).message},400)}
 const existing=new Map((await db.prepare('SELECT id,data FROM hub_tickets').all()).results.map(r=>[String(r.id),String(r.data)]));
 const skipped=tickets.filter(t=>existing.has(t.id)).length,newTickets=tickets.filter(t=>!existing.has(t.id));
 const sha=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const summary={total:tickets.length,planned:input.records.filter(a=>a.status==='NON COMMENCEE').length,inProgress:input.records.filter(a=>a.status==='EN COURS').length,existing:skipped,toCreate:newTickets.length,unassigned:newTickets.filter(t=>t.unassigned).length,sha};
 if(body.apply!==true)return reply(summary);
 if(body.sha!==sha)return reply({error:'Le fichier a changé. Recommencez l’aperçu.'},409);
 const now=new Date().toISOString(),author=gate.user!.displayName;
 const results=newTickets.length?await db.batch(newTickets.map(t=>db.prepare('INSERT OR IGNORE INTO hub_tickets(id,data,revision,created_at,updated_at,author) VALUES(?,?,1,?,?,?)').bind(t.id,JSON.stringify({...t.ticket,qualityImport:{source:input.source,sourceRow:Number(t.id.split('-').pop()),sha}}),now,now,author))):[];
 const created=results.reduce((sum,r)=>sum+Number(r.meta.changes||0),0);
 return reply({...summary,created,existing:tickets.length-created,applied:true});
}catch(e){console.error('Ticket import failed',e);return reply({error:'Import impossible. Aucune écriture partielle n’est conservée.'},503)}}

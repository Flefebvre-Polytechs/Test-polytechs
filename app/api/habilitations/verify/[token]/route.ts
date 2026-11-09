import {database} from '@/db/raw';
import {currentStatus,statusLabel,type HabilitationRecord} from '@/lib/habilitations';
const headers={'Cache-Control':'no-store, max-age=0','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const fail=()=>Response.json({error:'Badge inconnu ou désactivé.'},{status:404,headers});
export async function GET(_req:Request,{params}:{params:Promise<{token:string}>}){
 try{
  const {token}=await params;
  // 256-bit unguessable bearer token, never expose private files or medical dates.
  if(!/^[a-f0-9]{64}$/.test(token))return fail();
  const db=database();
  const person=await db.prepare('SELECT id,first_name,last_name,service FROM hr_people WHERE qr_token=? AND active=1').bind(token).first<{id:string;first_name:string;last_name:string;service:string}>();
  if(!person)return fail();
  const rows=await db.prepare("SELECT kind,title,category,equipment,zone,valid_from,valid_until,training_until,medical_until,status,prerequisites_checked FROM hr_authorizations WHERE person_id=? AND status IN ('active','suspended') ORDER BY kind,title").bind(person.id).all();
  const authorizations=(rows.results as unknown as HabilitationRecord[]).map(a=>({
   kind:a.kind,title:a.title,category:a.category,equipment:a.equipment,zone:a.zone,validFrom:a.valid_from,validUntil:a.valid_until,
   status:currentStatus(a),statusLabel:statusLabel[currentStatus(a)]
  }));
  return Response.json({person:{firstName:person.first_name,lastName:person.last_name,service:person.service},authorizations,verifiedAt:new Date().toISOString()},{headers});
 }catch(e){console.error('QR badge verification failed',e);return Response.json({error:'Vérification indisponible. Ne pas supposer une autorisation valide.'},{status:503,headers})}
}

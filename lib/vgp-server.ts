import {database} from '@/db/raw';
import {requireRole} from '@/lib/access';
import {teamsAllowed} from '@/lib/team-access';
import type {VgpRecord} from './vgp';
export async function vgpAccess(req:Request,write=false){
 const gate=await requireRole(req,write?'editor':'reader');
 if(gate.error)return gate;
 if(!await teamsAllowed(gate.user!,['qsse'],write))return {error:Response.json({error:'Accès au service QSSE nécessaire.'},{status:403})};
 return gate;
}
export async function vgpRecord(id:string){
 const row=await database().prepare('SELECT * FROM vgp_records WHERE id=?').bind(id).first<{id:string;data:string;revision:number}>();
 return row?{...JSON.parse(row.data),id:row.id,revision:row.revision} as VgpRecord:null;
}

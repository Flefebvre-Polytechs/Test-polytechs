import {createHash} from 'node:crypto';
import {database} from '@/db/raw';
import {recordAccess} from '@/lib/record-access';
import {normalize,type QRecord} from '@/lib/workflows';
import type {Account} from '@/lib/access';

export const categories=['Analyse de risques','Mode opératoire','FDS','Autorisation de conduite','Habilitation','Attestation de formation','Contrôle du matériel','Permis / autorisation spécifique','Autre'] as const;
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export async function planAccess(user:Account,id:string,write=false){
 const db=database(),raw=await db.prepare('SELECT * FROM records WHERE id=? AND kind=?').bind(id,'Plans de prévention').first<any>();
 if(!raw)return null;
 const allowed=await recordAccess(user,[raw],write);
 return allowed(raw)?normalize(raw) as QRecord:null;
}
export type Invite={id:string;record_id:string;company:string;expires_at:number;revoked_at:number|null;created_at:string};
export async function portalInvite(token:string){
 if(!/^[a-f0-9]{64}$/.test(token))return null;
 const row=await database().prepare('SELECT i.*,r.title,r.status,r.details FROM prevention_invites i JOIN records r ON r.id=i.record_id WHERE i.token_hash=? AND i.expires_at>? AND i.revoked_at IS NULL AND r.kind=? AND r.status<>?').bind(tokenHash(token),Date.now(),'Plans de prévention','Clôturé').first<Invite&{title:string;status:string;details:string}>();
 return row||null;
}

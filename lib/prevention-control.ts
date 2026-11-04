import {cseMembers} from './function-roles';
import {createHash} from 'node:crypto';
import {database} from '@/db/raw';
import {pdpRecipients,pdpType} from './prevention-rules';
import {dateToday,normalize,type QRecord} from './workflows';
import type {Account} from './access';
export const hseeMemberSql="SELECT DISTINCT u.id,u.display_name,u.role FROM users u JOIN member_function_roles m ON m.user_id=u.id WHERE m.role='hsee_approver' AND u.role IN ('editor','admin')";
export async function hseeMembers(){return (await database().prepare(hseeMemberSql).all()).results as {id:string;display_name:string;role:string}[]}
export async function canApproveUrgency(user:Account){return (await hseeMembers()).some(member=>member.id===user.id)}
export function urgentScope(r:QRecord){const excluded=new Set(['notifyUserIds','agreementEU','agreementEE','inspectionDone','cseEUDate','cseEUProof','cseEEDate','cseEEProof','urgentImmediateProof','completedAt','changes','briefing','inspectionNotice']);return createHash('sha256').update(JSON.stringify({title:r.title,details:Object.fromEntries(Object.entries(r.details).filter(([key])=>!excluded.has(key)).sort(([a],[b])=>a.localeCompare(b)))})).digest('hex')}
export type UrgentReview={id:number;decision:string;reason:string;author:string;created_at:string};
export async function urgentReview(r:QRecord){return await database().prepare('SELECT id,decision,reason,author,created_at FROM prevention_urgent_reviews WHERE record_id=? AND scope_hash=? ORDER BY id DESC LIMIT 1').bind(r.id||'',urgentScope(r)).first<UrgentReview>()}
export async function preventionServerError(r:QRecord,all:QRecord[]){
 if(r.status==='Validé'&&all.find(plan=>plan.id===r.id)?.status!=='Validé'&&r.details.start&&r.details.start<dateToday())return 'Impossible d’arrêter rétroactivement un nouveau plan après la date prévue de début des travaux.';
 if(r.id&&all.some(plan=>plan.details.annualPlanId===r.id)&&r.details.planType!=='Annuel')return 'Ce cadre possède des interventions rattachées : conservez son type annuel.';
 const ids=pdpRecipients(r);let raw:unknown;try{raw=JSON.parse(r.details.notifyUserIds||'[]')}catch{return 'Destinataires internes invalides.'}
 if(!Array.isArray(raw)||raw.length>100||raw.some(id=>typeof id!=='string'||id.length>100)||new Set(raw).size!==raw.length)return 'Destinataires internes invalides.';
 if(ids.length){const users=(await database().prepare('SELECT id FROM users').all()).results;if(ids.some(id=>!users.some(u=>u.id===id)))return 'Un destinataire interne n’existe plus.'}
 if(r.details.annualPlanId){const parent=all.find(plan=>plan.id===r.details.annualPlanId&&plan.kind==='Plans de prévention');if(r.details.planType!=='Ponctuel'||!parent||parent.details.planType!=='Annuel')return 'Sélectionnez un cadre annuel existant pour cette intervention ponctuelle.';if(['À valider','Validé','Clôturé'].includes(r.status)&&(parent.status!=='Validé'||r.details.contractor!==parent.details.contractor||!r.details.start||!r.details.end||r.details.start<parent.details.start||r.details.end>parent.details.end||r.details.annualScopeConfirmed!=='Oui'))return 'Le cadre annuel doit être arrêté, couvrir l’entreprise et les dates de l’intervention ; confirmez son périmètre.'}
 if(['Validé','Clôturé'].includes(r.status)&&r.details.urgent==='Oui'&&(await urgentReview(r))?.decision!=='Approuvée')return 'Urgence : accord HSEE requis sur le périmètre et les dates enregistrés. Enregistrez, puis soumettez la demande.';
 return '';
}
export async function notifyPrevention(r:QRecord,event:string,revision:number,extra:string[]=[]){
 const members=await hseeMembers(),elected=await cseMembers(),ids=[...new Set([...pdpRecipients(r),...elected.map(member=>member.id),...extra,...(r.details.urgent==='Oui'?members.map(m=>m.id):[])])];
 if(!ids.length)return {count:0,warning:'Aucun destinataire interne défini. Sélectionnez les personnes concernées.'};
 const db=database(),now=new Date().toISOString(),href='/plans-prevention?record='+encodeURIComponent(r.id||'');
 try{await db.batch(ids.map(userId=>db.prepare('INSERT OR IGNORE INTO hub_notifications (id,user_id,title,href,seen,created_at) VALUES (?,?,?,?,0,?)').bind('pdp:'+r.id+':'+event+':'+revision+':'+userId,userId,('PDP '+pdpType(r).toLowerCase()+' · '+event+' · '+r.title).slice(0,300),href,now)));return {count:ids.length,warning:''}}catch(e){console.error(e);return {count:0,warning:'Plan enregistré, mais notifications non créées. Réessayez depuis « Notifier les personnes concernées ».'}}
}
export function preventionChanged(r:QRecord,previous?:QRecord){return !previous||JSON.stringify({title:r.title,status:r.status,scope:urgentScope(r),recipients:pdpRecipients(r)})!==JSON.stringify({title:previous.title,status:previous.status,scope:urgentScope(previous),recipients:pdpRecipients(previous)})}

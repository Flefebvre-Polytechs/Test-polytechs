import type {QRecord} from './workflows';
export const pdpType=(r:QRecord)=>r.details.planType||'À qualifier';
export function cseDeadline(inspection:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(inspection)||Number.isNaN(Date.parse(inspection)))return '';const date=new Date(inspection+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-3);return date.toISOString().slice(0,10)}
export function pdpRecipients(r:QRecord):string[]{try{const ids=JSON.parse(r.details.notifyUserIds||'[]');return Array.isArray(ids)&&ids.length<=100&&ids.every(id=>typeof id==='string'&&id.length<=100)?[...new Set(ids)]:[]}catch{return []}}
export function pdpDeadlineErrors(r:QRecord,today:string){
 const d=r.details,errors:string[]=[];
 if(!['Annuel','Ponctuel'].includes(d.planType))errors.push('Choisissez un PDP annuel ou ponctuel.');
 if(d.planType==='Annuel'&&!d.recurringScope?.trim())errors.push('Définissez les prestations récurrentes couvertes par le PDP annuel.');
 if(d.urgent==='Oui'&&!d.urgentReason?.trim())errors.push('Justifiez la demande urgente à soumettre au service HSEE.');
 if(!['Oui','Non'].includes(d.urgent))errors.push('Précisez si l’opération relève d’une urgence.');
 if(['Validé','Clôturé'].includes(r.status)){
  if(d.inspectionDone!=='Oui'||!d.inspection||d.inspection>today)errors.push('Confirmez l’inspection commune effectivement réalisée avant d’arrêter le plan.');
  const deadline=cseDeadline(d.inspection);
  for(const [key,label] of [['cseEU','CSE Polytechs'],['cseEE','CSE des entreprises extérieures et sous-traitants concernés']]){
   if(!['Oui','Non'].includes(d[key])){errors.push('Précisez l’existence du '+label+'.');continue}
   if(d[key]==='Non'){if(!d[key+'Absence']?.trim())errors.push('Justifiez l’absence de '+label+'.');continue}
   const date=d[key+'Date'],proof=d[key+'Proof'];
   if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||date>today||date>d.inspection)errors.push(label+' : consignez une information effective, au plus tard le jour de l’inspection.');
   if(!proof?.trim())errors.push(label+' : consignez les destinataires et la preuve de l’information.');
   if(date&&deadline&&date>deadline&&d.urgent!=='Oui')errors.push(label+' : délai de trois jours avant l’inspection non respecté. Replanifiez ou soumettez une urgence réelle à HSEE.');
  }
  if(d.urgent==='Oui'&&!d.urgentImmediateProof?.trim())errors.push('Urgence : tracez l’information des CSE sur-le-champ et sa preuve.');
 }
 return errors;
}

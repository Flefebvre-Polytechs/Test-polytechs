import {fieldLabel,validate,type QRecord} from './workflows';

export const preventionSteps=[
 {title:'Opération',description:'Périmètre, entreprise et dates'},
 {title:'Inspection commune',description:'Visite et consignes partagées'},
 {title:'Risques d’interférence',description:'Phases et mesures convenues'},
 {title:'Organisation et secours',description:'Moyens et responsabilités'},
 {title:'Autorisations et prêts',description:'Intervenants et matériels'},
 {title:'Documents EE',description:'Dépôt et examen des pièces'},
 {title:'Accords et suivi',description:'Bilan avant arrêt du plan'},
];
export type PreventionFile={id:string;category:string;status:string};
export type PreventionIssue={message:string;step:number};
const fieldSteps:Record<string,number>={planType:0,recurringScope:0,annualPlanId:0,annualScopeConfirmed:0,urgent:1,urgentReason:1,inspectionDone:1,cseEU:1,cseEE:1,cseEUDate:1,cseEEDate:1,contractor:0,operation:0,place:0,start:0,end:0,hours:0,dangerous:0,regime:0,contact:0,subcontractors:0,inspection:1,euRepresentative:1,eeRepresentative:1,inspectionAttendees:1,sector:1,dangerZones:1,circulation:1,facilities:1,instructions:1,riskRowsJson:2,equipment:3,emergency:3,coordination:3,maintenance:3,medical:3,asbestos:3,drivingNeeded:4,habilitationNeeded:4,loanNeeded:4,chemicalsNeeded:4,externalRiskNeeded:4,methodNeeded:4,credentialsJson:4,loansJson:4};
export function requiredPreventionDocuments(record:QRecord){return [['drivingNeeded','Autorisation de conduite'],['habilitationNeeded','Habilitation'],['chemicalsNeeded','FDS'],['externalRiskNeeded','Analyse de risques'],['methodNeeded','Mode opératoire']].filter(([key])=>record.details[key]==='Oui').map(([,category])=>category)}
export function preventionReadiness(record:QRecord,all:QRecord[],files:PreventionFile[]|null=null):PreventionIssue[]{
 const errors=validate({...record,status:'Validé'},all).map(message=>{
  let step=6;
  const key=Object.keys(fieldSteps).find(key=>message.includes(fieldLabel(record.kind,key)));
  if(key)step=fieldSteps[key];
  if(/PDP annuel ou ponctuel|prestations récurrentes|titre|intitulé|fin d’intervention|total des heures|travaux dangereux|autre dispositif/i.test(message))step=0;
  else if(/CSE|Urgence|urgence|inspection commune/i.test(message))step=1;
  else if(/Analysez chaque phase/i.test(message))step=2;
  else if(/autorisations|Conduite :|habilitations|matériel prêté|chaque prêt|autorisation ou habilitation/i.test(message))step=4;
  return {message,step};
 });
 const required=requiredPreventionDocuments(record);
 if(['drivingNeeded','habilitationNeeded','chemicalsNeeded','externalRiskNeeded','methodNeeded'].some(key=>!['Oui','Non'].includes(record.details[key])))errors.push({message:'Déterminez les pièces attendues à l’étape Autorisations et prêts.',step:5});
 if(required.length&&files===null)errors.push({message:'Vérifier les documents EE requis avant de finaliser le bilan.',step:5});
 else for(const category of required)if(!files?.some(file=>file.category===category&&file.status==='Accepté'))errors.push({message:category+' : une pièce acceptée est attendue.',step:5});
 return errors;
}
export function preventionDate(value:string){if(!value)return 'À préciser';const date=new Date(value+'T12:00:00');return Number.isNaN(date.getTime())?value:date.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}

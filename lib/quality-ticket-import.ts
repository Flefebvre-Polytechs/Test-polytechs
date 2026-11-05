import {newTicket,ticketError,validDate,type Ticket} from './hub';
import {serviceTeams,type QualityAction} from './quality-actions';
export type ImportAccount={id:string;display_name:string};
const normalized=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseQualityImport(body:unknown):{source:string;records:QualityAction[]}{
 if(!body||typeof body!=='object')throw Error('Fichier d’actions invalide.');
 const input=body as {source:unknown;records:unknown};
 if(typeof input.source!=='string'||input.source.length>200||!Array.isArray(input.records)||!input.records.length||input.records.length>1000)throw Error('Sélectionnez un fichier de 1 à 1 000 actions.');
 const ids=new Set<string>();
 for(const row of input.records){
  if(!row||typeof row!=='object')throw Error('Action invalide.');
  if(!Number.isInteger(row.sourceRow)||row.sourceRow<6||row.sourceRow>100000||row.id!=='quality-source-'+row.sourceRow||ids.has(row.id))throw Error('Origine de ligne invalide ou doublonnée.');ids.add(row.id);
  if(!['NON COMMENCEE','EN COURS'].includes(row.status))throw Error('Seules les actions non commencées et en cours sont autorisées.');
  for(const key of ['reference','service','problem','objective','method','action','pilot','pilotId','teamId','origin','comment','criterion','created','due','status'])if(typeof row[key]!=='string'||row[key].length>10000)throw Error('Champ invalide : '+key);
  if(!row.action.trim()||!row.service.trim()||(row.due&&!validDate(row.due)))throw Error('Libellé, service ou échéance invalide à la ligne '+row.sourceRow+'.');
 }
 return input as {source:string;records:QualityAction[]};
}
export function qualityImportTicket(action:QualityAction,source:string,users:ImportAccount[]):{id:string;ticket:Ticket;unassigned:boolean}{
 // Assign only an exact, unique name; preserve unmatched names in the description.
 const candidates=users.filter(u=>normalized(u.display_name)===normalized(action.pilot)&&!!action.pilot.trim());
 const pilot=candidates.length===1?candidates[0].id:'';
 const fields:Record<string,string>={reference:'Référence',status:'Statut Excel',service:'Service source',pilot:'Pilote source',created:'Date source',due:'Échéance',origin:'Origine',problem:'Problème',objective:'Objectif',method:'Méthode',action:'Action à réaliser',comment:'Commentaires',criterion:'Critère d’efficacité',target:'Cible',validation:'Validation',hours:'Heures prévues',cost:'Coût prévu',usedHours:'Heures réalisées',usedCost:'Coût réalisé',gravity:'Gravité initiale',exposure:'Exposition initiale',afterGravity:'Gravité après action',afterExposure:'Exposition après action',sourceClass:'Priorité source',sourceEffective:'Efficacité source',sourceNewAction:'Nouvelle action source'};
 const description=['Import du fichier : '+source,'Ligne Excel : '+action.sourceRow,...Object.entries(fields).flatMap(([key,label])=>{const value=action[key as keyof QualityAction];return value!==null&&value!==undefined&&value!==''?[label+' : '+String(value)]:[]}),...(!pilot?['Compte du pilote à désigner : aucun rapprochement unique avec le nom source.']:[])].join('\n\n');
 const team=serviceTeams[action.service.split(' - ')[0]];if(!team)throw Error('Service source inconnu : '+action.service);
 const ticket:Ticket={...newTicket(),title:([action.reference,action.action].filter(Boolean).join(' · ')).slice(0,200),category:'Qualité',description,teams:[team],pilot,due:action.due,status:action.status==='EN COURS'?'En cours':'Ouvert',actions:[{id:'import-action-'+action.sourceRow,title:action.action.slice(0,500),done:false,pilot,due:action.due}],responsibles:[]};
 const error=ticketError(ticket);if(error)throw Error('Ligne '+action.sourceRow+' : '+error);
 return {id:'quality-ticket-'+action.id,ticket,unassigned:!pilot};
}

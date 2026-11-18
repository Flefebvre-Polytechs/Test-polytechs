import {validDate} from './hub';

export type VgpRecord = {
 id:string; revision:number; controlId:string; kind:'control'|'observation'; title:string; domain:string;
 location:string; reference:string; provider:string; pilotId:string; lastDate:string;
 due:string; plannedDate:string; months:number|null; regulatory:string;
 status:string; description:string; note:string; ticketId:string; sourceSheet:string;
 sourceRow:number; raw:Record<string,string>;
};
export const vgpStatuses=['À qualifier','À traiter','En cours','Levée'];
export function blankVgp(kind:VgpRecord['kind']):VgpRecord {
 return {id:'',revision:0,controlId:'',kind,title:'',domain:'',location:'',reference:'',provider:'',pilotId:'',
 lastDate:'',due:'',plannedDate:'',months:null,regulatory:'',status:'À qualifier',description:'',
 note:'',ticketId:'',sourceSheet:'',sourceRow:0,raw:{}};
}
export function vgpTiming(record:VgpRecord,today:string){
 if(record.kind==='observation'&&record.status==='Levée')return 'Levée';
 if(!record.due)return 'À planifier';
 if(record.due<today)return 'En retard';
 const limit=new Date(today+'T12:00:00Z');limit.setUTCDate(limit.getUTCDate()+30);
 return record.due<=limit.toISOString().slice(0,10)?'Sous 30 jours':'À jour';
}
export function nextVgpDate(date:string,months:number|null){
 if(!validDate(date)||!Number.isInteger(months)||!months||months<1)return '';
 const original=new Date(date+'T12:00:00Z');
 const target=new Date(Date.UTC(original.getUTCFullYear(),original.getUTCMonth()+months+1,0,12));
 target.setUTCDate(Math.min(original.getUTCDate(),target.getUTCDate()));
 return target.toISOString().slice(0,10);
}
export function vgpError(record:VgpRecord){
 const fields=['controlId','title','domain','location','reference','provider','pilotId','lastDate','due','plannedDate','regulatory','status','description','note'] as const;
 if(fields.some(field=>typeof record[field]!=='string'||record[field].length>10000))return 'Champ invalide.';
 if(!record.title.trim()||record.title.length>300||!['control','observation'].includes(record.kind))return 'Renseignez une désignation valide.';
 if([record.lastDate,record.due,record.plannedDate].some(date=>date&&!validDate(date)))return 'Renseignez des dates valides.';
 if(record.months!==null&&(!Number.isInteger(record.months)||record.months<1||record.months>240))return 'La périodicité doit être comprise entre 1 et 240 mois.';
 if(!['','Oui','Non'].includes(record.regulatory)||!vgpStatuses.includes(record.status))return 'Statut ou caractère réglementaire invalide.';
 if(record.kind==='observation'&&record.status==='Levée'&&!record.note.trim())return 'Précisez la justification de la levée dans le suivi.';
 return '';
}

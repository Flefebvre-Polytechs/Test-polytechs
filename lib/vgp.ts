import {validDate} from './hub';

export type VgpRecord = {
 id:string; revision:number; controlId:string; kind:'control'|'observation'; title:string; domain:string;
 location:string; reference:string; provider:string; pilotId:string; lastDate:string;
 due:string; plannedDate:string; months:number|null; regulatory:string;
 status:string; description:string; note:string; ticketId:string; sourceSheet:string;
 sourceRow:number; equipment?:VgpEquipmentIdentity; raw:Record<string,string>;
};
export const vgpStatuses=['À qualifier','À traiter','En cours','Levée'];
export function blankVgp(kind:VgpRecord['kind']):VgpRecord {
 return {id:'',revision:0,controlId:'',kind,title:'',domain:'',location:'',reference:'',provider:'',pilotId:'',
 lastDate:'',due:'',plannedDate:'',months:null,regulatory:'',status:'À qualifier',description:'',
 note:'',ticketId:'',sourceSheet:'',sourceRow:0,raw:{}};
}
export function vgpTiming(record:Pick<VgpRecord,'kind'|'status'|'due'>,today:string){
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
 if(record.equipment!==undefined&&(!record.equipment||typeof record.equipment!=='object'||
  [record.equipment.family,record.equipment.number,record.equipment.reference].some(value=>typeof value!=='string'||value.length>250)))
  return 'Vérifiez la famille et les références du matériel (250 caractères maximum).';
 if(record.kind==='observation'&&record.status==='Levée'&&!record.note.trim())return 'Précisez la justification de la levée dans le suivi.';
 return '';
}

export const vgpResults=['Conforme','Avec observations','Non conforme','En attente du rapport'] as const;
export type VgpPassage={
 id:string; record_id:string; due:string; planned_date:string; performed_date:string;
 result:string; report_expected:number; note:string; created_at:string; created_by:string;
};

export type VgpEquipmentIdentity={family:string;number:string;reference:string};
export function vgpSearchText(value:string){
 return value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim().replace(/\s+/g,' ');
}
export function vgpEquipmentIdentity(record:VgpRecord):VgpEquipmentIdentity{
 const source=new Map(Object.entries(record.raw||{}).map(([column,value])=>[
  vgpSearchText(column.split(' · ').slice(1).join(' · ')),value.trim(),
 ]));
 const present=(value:string|undefined)=>value&&!/^(\?|[-–—]+|n\/?a|non renseigné)$/i.test(value)?value:'';
 const number=present(source.get('n° equipement'));
 const reference=present(source.get('ref apave equipement'));
 const sourceFamily=present(source.get('famille equipement'));
 const type=present(source.get('type de rapport'));
 const label=vgpSearchText(sourceFamily||record.title);
 const match=[
  [/^chariots? elevateur/, 'Chariots élévateurs'],
  [/^portes? (?:a commande automatique|semi.?auto|motorisee|sectionnelle|automatique|souple)/, 'Portes motorisées'],
  [/^presses?(?: a balles)?\b/, 'Presses'],
  [/^palans?\b/, 'Palans'],
  [/^ponts? roulants?\b/, 'Ponts roulants'],
  [/^elingues?\b/, 'Élingues'],
  [/^gerbeurs?\b/, 'Gerbeurs'],
  [/^transpalettes?\b/, 'Transpalettes'],
 ] as const;
 const commonFamily=match.find(([pattern])=>pattern.test(label))?.[1];
 return {
  family:record.equipment?.family?.trim()||commonFamily||sourceFamily||type||
   record.domain.replace(/\s+20\d{2}(?:-\d+)?$/, '')||'Famille à renseigner',
  number:record.equipment?.number?.trim()||number,
  reference:record.equipment?.reference?.trim()||reference,
 };
}

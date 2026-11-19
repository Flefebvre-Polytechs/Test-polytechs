import {vgpSearchText,vgpTiming,type VgpPassage,type VgpRecord} from '@/lib/vgp';

export type RegisterRow=Omit<VgpRecord,'raw'>;
export type ReportFollowUp=Pick<VgpPassage,'id'|'record_id'|'performed_date'>;
export type VgpUser={id:string;display_name:string};
export type VgpFile={passage_id:string|null;id:string;name:string;author:string;created_at:string};
export type VgpHistory={snapshot:string;saved_at:string;saved_by:string};
export type VgpDetail={record:VgpRecord;files:VgpFile[];history:VgpHistory[];passages:VgpPassage[]};
export type SheetIntent='summary'|'plan'|'passages'|'qualify';
export type SheetTarget={id:string;passageId?:string;intent?:SheetIntent};

export function displayDate(date:string){
 return date?new Date(date+'T12:00:00Z').toLocaleDateString('fr-FR'):'—';
}

const sitePattern=/\bsite\s*[:\-]?\s*(?:n\s*[°ºo.]\s*)?(\d+)\b/;
export function siteFor(location:string){
 const match=vgpSearchText(location).match(sitePattern);
 return match?'Site '+Number(match[1]):'';
}

export function searchRecord(record:RegisterRow,query:string){
 const equipment=record.equipment;
 const base=[record.title,record.domain,record.location,siteFor(record.location),record.reference,
  record.provider,record.description,equipment?.family,equipment?.number&&'N° '+equipment.number,equipment?.reference&&'APAVE '+equipment.reference].filter(Boolean).join(' ');
 const compactRefs=[equipment?.number,equipment?.reference,record.reference].map(value=>referenceKey(value||'')).join(' ');
 const requestedSite=siteFor(query);
 if(requestedSite&&siteFor(record.location)!==requestedSite)return false;
 const terms=vgpSearchText(query).replace(sitePattern,'').split(' ').filter(Boolean);
 const normalized=vgpSearchText(base);
 return terms.every(term=>normalized.includes(term)||(!!referenceKey(term)&&compactRefs.includes(referenceKey(term))));
}

export function referenceKey(value:string){
 return vgpSearchText(value).replace(/[^a-z0-9]/g,'');
}

export function statusTone(status:string){
 if(['En retard','À traiter','Non conforme'].includes(status))return 'red';
 if(['Sous 30 jours','En cours','Avec observations','Rapport attendu','À qualifier'].includes(status))return 'amber';
 if(['Levée','Conforme','À jour','PDF disponible'].includes(status))return 'green';
 if(['Programmé','Ticket lié'].includes(status))return 'blue';
 return 'slate';
}

export function calendarDelta(date:string,today:string){
 return Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
}

export function dueLabel(date:string,today:string){
 if(!date)return 'Sans échéance';
 const days=calendarDelta(date,today);
 if(days===0)return 'Aujourd’hui';
 if(days<0)return Math.abs(days)+' j de retard';
 return 'Dans '+days+' j';
}

export type PriorityKey='late'|'schedule'|'reports'|'observations'|'results';
type PriorityItem={key:string;record:RegisterRow;date:string;kind:PriorityKey;action:string;target:SheetTarget};
export const priorityLabels:Record<PriorityKey,string>={
 late:'Contrôles en retard',schedule:'À programmer sous 30 jours',reports:'Rapports attendus',
 observations:'Écarts en retard',results:'Résultats à renseigner',
};
export function vgpPriorityItems(records:RegisterRow[],pendingReports:ReportFollowUp[],pendingResults:ReportFollowUp[],today:string){
 const rows:PriorityItem[]=[];
 const byId=new Map(records.map(record=>[record.id,record]));
 for(const record of records){
  const timing=vgpTiming(record,today);
  if(record.kind==='control'){
   if(timing==='En retard'){
    rows.push({key:record.id,record,date:record.due,kind:'late',action:record.plannedDate?'Voir le rendez-vous':'Planifier',target:{id:record.id,intent:'plan'}});
   }else if(timing==='Sous 30 jours'&&!record.plannedDate){
    rows.push({key:record.id,record,date:record.due,kind:'schedule',action:'Planifier',target:{id:record.id,intent:'plan'}});
   }
  }else if(timing==='En retard'&&['À traiter','En cours'].includes(record.status)){
   rows.push({key:record.id,record,date:record.due,kind:'observations',action:'Traiter l’écart',target:{id:record.id}});
  }
 }
 const followUps=[{rows:pendingReports,kind:'reports',action:'Déposer le PDF'},{rows:pendingResults,kind:'results',action:'Saisir le résultat'}] as const;
 for(const group of followUps){
  for(const passage of group.rows){
   const record=byId.get(passage.record_id);
   if(record)rows.push({key:passage.id,record,date:passage.performed_date,kind:group.kind,action:group.action,
    target:{id:record.id,intent:'passages',passageId:passage.id}});
  }
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.record.title.localeCompare(b.record.title,'fr'));
}

export type EquipmentGroup={key:string;rows:RegisterRow[];identified:boolean};
export function groupEquipment(rows:RegisterRow[]):EquipmentGroup[]{
 const knownSerials=new Map<string,Set<string>>();
 const refsBySerial=new Map<string,Set<string>>();
 function keys(row:RegisterRow){
  const ref=referenceKey(row.equipment?.reference||'');
  const number=referenceKey(row.equipment?.number||'');
  const location=vgpSearchText(row.location);
  return {ref,number,scopedNumber:number&&location?number+'|'+location:''};
 }
 for(const row of rows){
  const {ref,number,scopedNumber}=keys(row);
  if(!ref||!number)continue;
  if(!knownSerials.has(ref))knownSerials.set(ref,new Set());
  knownSerials.get(ref)!.add(number);
  if(scopedNumber){
   if(!refsBySerial.has(scopedNumber))refsBySerial.set(scopedNumber,new Set());
   refsBySerial.get(scopedNumber)!.add(ref);
  }
 }
 const groups=new Map<string,EquipmentGroup>();
 for(const row of rows){
  const {ref,number,scopedNumber}=keys(row);
  const candidates=refsBySerial.get(scopedNumber);
  const reference=ref||(candidates?.size===1?[...candidates][0]:'');
  const conflicting=reference&&(knownSerials.get(reference)?.size||0)>1;
  const ambiguousSerial=!ref&&(candidates?.size||0)>1;
  const key=reference&&(!conflicting||number)?'ref:'+reference+(conflicting?'|'+number:''):
   !reference&&scopedNumber&&(!candidates||candidates.size===0)?'serial:'+scopedNumber:'row:'+row.id;
  const group=groups.get(key)??{key,rows:[],identified:!!(ref||number)&&(!conflicting||!!number)&&!ambiguousSerial};
  group.rows.push(row);
  groups.set(key,group);
 }
 return [...groups.values()];
}

'use client';

import {useState} from 'react';
import {Activity,ArrowRight,CheckCircle2,ClipboardList,Download,Link2,ListChecks,Search} from 'lucide-react';
import {ListPagination,useListPage} from '@/components/list-pagination';
import {closed,dateToday,dueEvents,flows,validate,type QRecord} from '@/lib/workflows';
import {healthEventKind,healthEventTypes} from '@/lib/health-events';
import {HealthEventImport} from './health-event-tools';
import './health-events.css';

const stages=[
 {id:'all',label:'Événements',icon:Activity},
 {id:'review',label:'À analyser',icon:ClipboardList},
 {id:'actions',label:'Actions en cours',icon:ListChecks},
 {id:'closed',label:'Clôturés',icon:CheckCircle2},
] as const;
const stage=(record:QRecord)=>closed(record)?'closed':record.status==='Actions en cours'?'actions':'review';
const key=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
const formatDate=(date:string)=>date?new Date(date+'T12:00:00').toLocaleDateString('fr-FR'):'—';

export function HealthEventRegister({records,canEdit,canImport,onOpen,onCreate,onExport,onImported}:{
 records:QRecord[];canEdit:boolean;canImport:boolean;
 onOpen:(record:QRecord,tab?:'fiche'|'liens')=>void;onCreate:()=>void;
 onExport:(records:QRecord[])=>void;onImported:(message:string)=>void;
}){
 const [selected,setSelected]=useState<typeof stages[number]['id']>('all');
 const [search,setSearch]=useState(''),[type,setType]=useState(''),[year,setYear]=useState(''),[ticket,setTicket]=useState('');
 const [status,setStatus]=useState(''),[attention,setAttention]=useState('');
 const today=dateToday();
 const years=[...new Set(records.map(record=>record.details.date?.slice(0,4)).filter(Boolean))].sort().reverse();
 const scope=records.filter(record=>!year||record.details.date?.startsWith(year+'-'));
 const counts={all:scope.length,review:0,actions:0,closed:0};
 for(const record of scope)counts[stage(record)]++;
 const query=key(search.trim());
 const filtered=scope.filter(record=>
  (selected==='all'||stage(record)===selected)&&(!type||(record.details.eventType||'Non renseigné')===type)&&
  (!ticket||(ticket==='linked')===!!record.details.linkedTicketId)&&
  (!status||record.status===status)&&
  (!attention||attention==='late'&&dueEvents(record).some(event=>event.date<today)||
   attention==='incomplete'&&validate(record,records).length>0||attention==='unassigned'&&!record.owner)&&
  (!query||key([record.title,record.owner,record.description,...Object.values(record.details)].join(' ')).includes(query)),
 ).sort((a,b)=>(b.details.date||'').localeCompare(a.details.date||'')||(b.details.time||'').localeCompare(a.details.time||''));
 const page=useListPage(filtered,JSON.stringify([selected,search,type,year,ticket,status,attention]));
 const hasFilters=selected!=='all'||!!(search||year||type||ticket||status||attention);
 function reset(){
  setSelected('all');setSearch('');setType('');setYear('');setTicket('');setStatus('');setAttention('');
 }

 return <section className="health-register" aria-label="Suivi des accidents du travail">
  <div className="health-overview" role="group" aria-label="Filtrer par état du suivi">
   {stages.map(({id,label,icon:Icon})=><button type="button" key={id} className={'health-kpi health-kpi-'+id}
    aria-pressed={selected===id} onClick={()=>{setSelected(id);setStatus('')}}>
    <span><Icon size={17} aria-hidden="true"/>{label}</span><strong>{counts[id]}</strong>
   </button>)}
  </div>
  <section className="panel health-panel">
   <div className="section-head">
    <div><h2>Registre des événements</h2><p>{filtered.length} fiche{filtered.length!==1?'s':''} dans la sélection</p></div>
    <button type="button" className="outline" disabled={!filtered.length} onClick={()=>onExport(filtered)}><Download size={16}/> Exporter la sélection</button>
   </div>
   <div className="health-filters">
    <label><span>Rechercher</span><div className="health-search"><Search size={16} aria-hidden="true"/>
     <input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Personne, atelier, service…"/>
    </div></label>
    <label><span>Année</span><select value={year} onChange={event=>setYear(event.target.value)}><option value="">Toutes</option>{years.map(value=><option key={value}>{value}</option>)}</select></label>
    <label><span>Type d’événement</span><select value={type} onChange={event=>setType(event.target.value)}><option value="">Tous les types</option>{[...healthEventTypes,'Non renseigné'].map(value=><option key={value}>{value}</option>)}</select></label>
    <label><span>Ticket de suivi</span><select value={ticket} onChange={event=>setTicket(event.target.value)}><option value="">Tous</option><option value="linked">Avec ticket</option><option value="unlinked">Sans ticket</option></select></label>
   </div>
   <details className="health-advanced">
    <summary>Statut et points d’attention</summary>
    <div className="health-filters">
     <label><span>Statut</span><select value={status} onChange={event=>{setStatus(event.target.value);setSelected('all')}}>
      <option value="">Tous les statuts</option>{flows[healthEventKind].states.map(value=><option key={value}>{value}</option>)}
     </select></label>
     <label><span>Points d’attention</span><select value={attention} onChange={event=>setAttention(event.target.value)}>
      <option value="">Toutes les fiches</option><option value="late">En retard</option>
      <option value="incomplete">À compléter</option><option value="unassigned">Sans responsable</option>
     </select></label>
    </div>
   </details>
   {hasFilters&&<button type="button" className="health-reset" onClick={reset}>Réinitialiser les filtres</button>}
   <ul className="health-event-list">
    {page.rows.map(record=><li key={record.id} className="health-event-row">
     <button type="button" className="health-event-main" onClick={()=>onOpen(record)}>
      <strong>{record.title}</strong>
      <span>{[record.details.person,record.details.place].filter(Boolean).join(' · ')||'Personne et lieu à renseigner'}</span>
      {record.details.eventType&&record.details.eventType!==record.title&&<span>{record.details.eventType}</span>}
     </button>
     <div className="health-event-date"><span>Date</span><strong>{formatDate(record.details.date)}</strong></div>
     <div className="health-event-owner"><span>Responsable</span><strong>{record.owner||'À attribuer'}</strong>
      {record.due&&!closed(record)&&<span className={record.due<today?'late-text':undefined}>Échéance {formatDate(record.due)}</span>}
     </div>
     <span className={'health-status health-status-'+stage(record)}>{record.status}</span>
     <button type="button" className="outline health-row-follow" onClick={()=>onOpen(record,'liens')}>
      {record.details.linkedTicketId?<Link2 size={15}/>:<ArrowRight size={15}/>}
      {record.details.linkedTicketId?'Ticket lié':'Suivi'}
     </button>
    </li>)}
   </ul>
   {!filtered.length&&<div className="health-empty">
    <p>{hasFilters?'Aucun événement ne correspond aux filtres.':'Aucun événement dans le registre.'}</p>
    {hasFilters?<button type="button" className="outline" onClick={reset}>Afficher tous les événements</button>:canEdit&&<button type="button" className="outline" onClick={onCreate}>Ajouter un événement</button>}
   </div>}
   <ListPagination page={page.page} pages={page.pages} total={filtered.length} onChange={page.setPage}/>
  </section>
  {canImport&&<HealthEventImport onImported={onImported}/>}
 </section>;
}

'use client';

import {useState,type ReactNode} from 'react';
import {ArrowRight,CalendarClock,CalendarDays,ClipboardList,FileText,Search,Ticket,TriangleAlert} from 'lucide-react';
import {ListPagination,useListPage} from '@/components/list-pagination';
import {vgpStatuses,vgpTiming} from '@/lib/vgp';
import {calendarDelta,displayDate,dueLabel,priorityLabels,searchRecord,siteFor,statusTone,vgpPriorityItems,
 type PriorityKey,type RegisterRow,type ReportFollowUp,type SheetTarget,type VgpUser} from './model';

export function StatusBadge({children,status}:{children?:ReactNode;status:string}){
 return <span className="vgp-badge" data-tone={statusTone(status)}>{children??status}</span>;
}

export function EmptyState({title,children}:{title:string;children?:ReactNode}){
 return <div className="vgp-empty"><strong>{title}</strong>{children&&<div>{children}</div>}</div>;
}

const priorityCards=[
 {key:'late',icon:TriangleAlert,tone:'red'},
 {key:'schedule',icon:CalendarClock,tone:'amber'},
 {key:'reports',icon:FileText,tone:'blue'},
 {key:'observations',icon:ClipboardList,tone:'red'},
] as const;

type PrioritiesProps={
 records:RegisterRow[]; users:VgpUser[]; pendingReports:ReportFollowUp[]; pendingResults:ReportFollowUp[];
 today:string; busy:boolean; onOpen:(target:SheetTarget)=>void;
 onRegister:(kind:RegisterRow['kind'],filter:string)=>void;
};

export function VgpPriorities({records,users,pendingReports,pendingResults,today,busy,onOpen,onRegister}:PrioritiesProps){
 const [filter,setFilter]=useState<PriorityKey|''>('');
 const items=vgpPriorityItems(records,pendingReports,pendingResults,today);
 const selected=filter?items.filter(item=>item.kind===filter):items;
 const page=useListPage(selected,filter,8);
 const byPilot=new Map(users.map(user=>[user.id,user.display_name]));
 const controls=records.filter(record=>record.kind==='control');
 const upcoming=controls.filter(record=>record.plannedDate>=today&&calendarDelta(record.plannedDate,today)<=30)
  .sort((a,b)=>a.plannedDate.localeCompare(b.plannedDate)||a.title.localeCompare(b.title,'fr'));
 const missingDue=controls.filter(record=>!record.due).length;
 const withoutPilot=controls.filter(record=>!record.pilotId).length;
 const unqualified=records.filter(record=>record.kind==='observation'&&record.status==='À qualifier').length;
 return <>
  <div className="vgp-kpis" aria-label="Indicateurs opérationnels">
   {priorityCards.map(({key,icon:Icon,tone})=><button key={key} className="vgp-kpi" data-tone={tone} type="button"
    aria-pressed={filter===key} onClick={()=>setFilter(filter===key?'':key)}>
    <span className="vgp-kpi-icon"><Icon size={18} aria-hidden="true"/></span>
    <strong>{items.filter(item=>item.kind===key).length}</strong>
    <span>{priorityLabels[key]}</span>
    <ArrowRight className="vgp-kpi-arrow" size={16} aria-hidden="true"/>
   </button>)}
  </div>
  <div className="vgp-dashboard-grid">
   <section className="vgp-panel">
    <div className="vgp-panel-head"><div><h2>{filter?priorityLabels[filter]:'À traiter en priorité'}</h2>
     <p>{selected.length} {selected.length===1?'élément':'éléments'}</p></div>
     {filter&&<button className="vgp-text-action" type="button" onClick={()=>setFilter('')}>Toutes les priorités</button>}
    </div>
    {page.rows.length?<ul className="vgp-action-list">{page.rows.map(({key,record,date,kind,action,target})=>{
     const report=kind==='reports'||kind==='results';
     const label=report?kind==='reports'?'Rapport attendu':'Résultat à renseigner':dueLabel(date,today);
     return <li key={kind+':'+key}>
      <button type="button" disabled={busy} onClick={()=>onOpen(target)}>
       <span className="vgp-action-date" data-tone={kind==='late'||kind==='observations'?'red':report?'blue':'amber'}>
        <time dateTime={date}>{displayDate(date)}</time><small>{report?'Date du passage':'Échéance'}</small>
       </span>
       <span className="vgp-action-record"><strong>{record.title}</strong>
        <small>{[record.location||record.domain,byPilot.get(record.pilotId)||'Pilote à attribuer'].filter(Boolean).join(' · ')}</small>
        <small>{label}{record.plannedDate&&!report?' · Rendez-vous le '+displayDate(record.plannedDate):''}</small>
       </span>
       <span className="vgp-action-label">{action}<ArrowRight size={15} aria-hidden="true"/></span>
      </button>
     </li>;
    })}</ul>:<EmptyState title="Aucun élément dans cette sélection"/>}
    {page.pages>1&&<ListPagination page={page.page} pages={page.pages} total={selected.length} onChange={page.setPage}/>}
   </section>
   <aside className="vgp-dashboard-aside">
    <section className="vgp-panel">
     <div className="vgp-panel-head"><div><h2><CalendarDays size={17} aria-hidden="true"/> Rendez-vous</h2><p>30 prochains jours</p></div></div>
     {upcoming.length?<ul className="vgp-agenda">{upcoming.slice(0,5).map(record=><li key={record.id}>
      <button type="button" disabled={busy} onClick={()=>onOpen({id:record.id,intent:'plan'})}>
       <time dateTime={record.plannedDate}>{displayDate(record.plannedDate)}</time>
       <span><strong>{record.title}</strong><small>{record.location||record.provider||record.domain}</small></span>
       <ArrowRight size={14} aria-hidden="true"/>
      </button>
     </li>)}</ul>:<EmptyState title="Aucun rendez-vous programmé"/>}
     {upcoming.length>5&&<button className="vgp-text-action vgp-panel-link" type="button" onClick={()=>onRegister('control','Programmé')}>Voir les contrôles programmés</button>}
    </section>
    <section className="vgp-panel">
     <div className="vgp-panel-head"><h2>Données à compléter</h2></div>
     <ul className="vgp-completions">
      <li><button type="button" onClick={()=>onRegister('control','À planifier')}><span>Contrôles sans échéance</span><b>{missingDue}</b><ArrowRight size={14} aria-hidden="true"/></button></li>
      <li><button type="button" onClick={()=>onRegister('control','Sans pilote')}><span>Contrôles sans pilote</span><b>{withoutPilot}</b><ArrowRight size={14} aria-hidden="true"/></button></li>
      <li><button type="button" onClick={()=>onRegister('observation','À qualifier')}><span>Observations à qualifier</span><b>{unqualified}</b><ArrowRight size={14} aria-hidden="true"/></button></li>
      <li><button type="button" aria-pressed={filter==='results'} onClick={()=>setFilter(filter==='results'?'':'results')}><span>Résultats à renseigner</span><b>{items.filter(item=>item.kind==='results').length}</b><ArrowRight size={14} aria-hidden="true"/></button></li>
     </ul>
    </section>
   </aside>
  </div>
 </>;
}

function matchesStatus(record:RegisterRow,status:string,today:string){
 if(status==='Programmé')return !!record.plannedDate;
 if(status==='Sans pilote')return !record.pilotId;
 if(status==='Ticket lié')return !!record.ticketId;
 if(status==='Sans ticket')return !record.ticketId;
 return !status||record.status===status||vgpTiming(record,today)===status;
}

type RegisterProps={kind:RegisterRow['kind'];records:RegisterRow[];users:VgpUser[];initialStatus:string;today:string;busy:boolean;onOpen:(target:SheetTarget)=>void};
export function VgpRegister({kind,records,users,initialStatus,today,busy,onOpen}:RegisterProps){
 const [query,setQuery]=useState(''),[domain,setDomain]=useState(''),[site,setSite]=useState('');
 const [status,setStatus]=useState(initialStatus),[choice,setChoice]=useState(kind==='control'?'due':'recent');
 const control=kind==='control';
 const scoped=records.filter(record=>record.kind===kind);
 const domains=[...new Set(scoped.map(record=>record.domain).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 const sites=[...new Set(scoped.map(record=>siteFor(record.location)))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
 const statusOptions=control?['En retard','Sous 30 jours','À planifier','À jour','Programmé','Sans pilote']:
  [...vgpStatuses,'En retard','Ticket lié','Sans ticket'];
 const basis=scoped.filter(record=>(!domain||record.domain===domain)&&
  (!site||siteFor(record.location)===(site==='unknown'?'':site))&&searchRecord(record,query));
 const chips=control?['En retard','Sous 30 jours','Programmé','À planifier']:vgpStatuses;
 const filtered=basis.filter(record=>matchesStatus(record,status,today)).sort((a,b)=>{
  const order=choice==='due'?(a.due||'9999').localeCompare(b.due||'9999'):choice==='recent'?b.lastDate.localeCompare(a.lastDate):0;
  return order||a.title.localeCompare(b.title,'fr');
 });
 const list=useListPage(filtered,JSON.stringify([kind,query,domain,site,status,choice]),25);
 const pilotById=new Map(users.map(user=>[user.id,user.display_name]));
 function clear(){setQuery('');setDomain('');setSite('');setStatus('')}
 return <section className="vgp-panel vgp-register">
  <div className="vgp-panel-head"><div><h2>{control?'Registre des contrôles':'Registre des observations'}</h2>
   <p>{control?'Échéances, interventions et responsables.':'Constats et tickets de suivi.'}</p></div></div>
  <div className="vgp-filter-chips" aria-label="Filtres rapides">{chips.map(label=>
   <button key={label} type="button" aria-pressed={status===label} onClick={()=>setStatus(status===label?'':label)}>{label}<b>{basis.filter(record=>matchesStatus(record,label,today)).length}</b></button>
  )}</div>
  <div className="vgp-filters">
   <label className="vgp-search"><Search size={17} aria-hidden="true"/><span className="sr-only">Rechercher dans le registre</span>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Rechercher par matériel, référence ou emplacement…"/>
   </label>
   <label><span className="sr-only">Domaine</span><select value={domain} onChange={event=>setDomain(event.target.value)}><option value="">Tous les domaines</option>{domains.map(value=><option key={value}>{value}</option>)}</select></label>
   <label><span className="sr-only">Site</span><select value={site} onChange={event=>setSite(event.target.value)}><option value="">Tous les sites</option>{sites.map(value=><option key={value} value={value||'unknown'}>{value||'Site non renseigné'}</option>)}</select></label>
   <label><span className="sr-only">État de suivi</span><select value={status} onChange={event=>setStatus(event.target.value)}><option value="">Tous les états</option>{statusOptions.map(value=><option key={value}>{value}</option>)}</select></label>
   <label><span className="sr-only">Trier le registre</span><select value={choice} onChange={event=>setChoice(event.target.value)}>
    <option value="due">Échéance la plus proche</option><option value="recent">{control?'Dernier contrôle récent':'Relevé le plus récent'}</option><option value="name">Désignation A–Z</option>
   </select></label>
   {!!(query||domain||site||status)&&<button className="vgp-text-action" type="button" onClick={clear}>Réinitialiser</button>}
  </div>
  {list.rows.length?<div className="vgp-table-wrap">
   <table className="vgp-table">
    <thead><tr><th scope="col">{control?'Contrôle':'Matériel et constat'}</th><th scope="col">Échéance</th>
     <th scope="col">{control?'Intervention prévue':'Date du relevé'}</th><th scope="col">Pilote</th><th scope="col">Suivi</th></tr></thead>
    <tbody>{list.rows.map(record=><tr key={record.id}>
     <td><button className="vgp-record-link" type="button" disabled={busy} onClick={()=>onOpen({id:record.id})}>
      <span>{record.title}</span><ArrowRight size={15} aria-hidden="true"/>
     </button><small>{[record.domain,record.location||record.provider,record.equipment?.number||record.equipment?.reference||record.reference].filter(Boolean).join(' · ')}</small>
      {!control&&record.description&&<small className="vgp-truncate">{record.description}</small>}</td>
     <td data-label="Échéance"><span>{displayDate(record.due)}</span>{record.due&&<small>{dueLabel(record.due,today)}</small>}</td>
     <td data-label={control?'Prévu le':'Relevé le'}>{displayDate(control?record.plannedDate:record.lastDate)}</td>
     <td data-label="Pilote">{pilotById.get(record.pilotId)||'À attribuer'}</td>
     <td data-label="Suivi"><StatusBadge status={control?vgpTiming(record,today):record.status}/>
      {record.ticketId&&<a className="vgp-ticket-mini" href={'/tickets?id='+encodeURIComponent(record.ticketId)}><Ticket size={13} aria-hidden="true"/> Ticket lié</a>}</td>
    </tr>)}</tbody>
   </table>
  </div>:<EmptyState title="Aucun résultat pour ces filtres"><button className="vgp-text-action" type="button" onClick={clear}>Effacer les filtres</button></EmptyState>}
  <ListPagination page={list.page} pages={list.pages} total={filtered.length} onChange={list.setPage}/>
 </section>;
}

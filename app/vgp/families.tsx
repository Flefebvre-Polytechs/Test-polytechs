'use client';

import {useMemo,useState} from 'react';
import {ArrowRight,Box,Boxes,ClipboardList,MapPin,Search,Ticket} from 'lucide-react';
import {ListPagination,useListPage} from '@/components/list-pagination';
import {vgpSearchText} from '@/lib/vgp';
import {displayDate,groupEquipment,searchRecord,siteFor,type RegisterRow,type SheetTarget} from './model';
import {EmptyState,StatusBadge} from './register';

const alphabetical=(a:string,b:string)=>a.localeCompare(b,'fr',{numeric:true});
const followUpOptions=[
 {value:'',label:'Tous les écarts'},
 {value:'active',label:'À traiter / en cours'},
 {value:'qualify',label:'À qualifier'},
 {value:'linked',label:'Avec ticket'},
 {value:'unidentified',label:'À identifier'},
 {value:'closed',label:'Levés'},
] as const;
type EquipmentFilter=typeof followUpOptions[number]['value'];

function observationMatches(row:RegisterRow,filter:EquipmentFilter){
 if(filter==='active')return row.status==='À traiter'||row.status==='En cours';
 if(filter==='qualify')return row.status==='À qualifier';
 if(filter==='linked')return !!row.ticketId;
 if(filter==='closed')return row.status==='Levée';
 return true;
}

export function VgpFamilies({records,busy,onOpen,onAdd}:{
 records:RegisterRow[];busy:boolean;onOpen:(target:SheetTarget)=>void;onAdd?:(family:string)=>void;
}){
 const [family,setFamily]=useState(''),[query,setQuery]=useState(''),[site,setSite]=useState(''),[filter,setFilter]=useState<EquipmentFilter>('');
 const families=useMemo(()=>{
  const index=new Map<string,{key:string;label:string;rows:RegisterRow[]}>();
  for(const row of records){
   if(row.kind!=='observation'||!row.equipment)continue;
   const label=row.equipment.family;
   const key=vgpSearchText(label);
   const group=index.get(key)??{key,label,rows:[]};
   group.rows.push(row);index.set(key,group);
  }
  return [...index.values()].sort((a,b)=>alphabetical(a.label,b.label))
   .map(group=>({...group,equipment:groupEquipment(group.rows)}));
 },[records]);
 const selected=families.find(group=>group.key===family);
 const ordered=selected?[selected]:families;
 const sites=[...new Set(families.flatMap(group=>group.rows.map(row=>siteFor(row.location))))].sort(alphabetical);
 const equipment=ordered.flatMap(group=>group.equipment.flatMap(item=>{
  if(filter==='unidentified'&&item.identified)return [];
  const visible=item.rows.filter(row=>(!site||siteFor(row.location)===(site==='unknown'?'':site))&&observationMatches(row,filter));
  if(!visible.length)return [];
  const named=item.rows.find(row=>row.equipment?.number)||item.rows.find(row=>row.equipment?.reference)||visible[0];
  const reference=item.rows.find(row=>row.equipment?.reference)?.equipment?.reference||'';
  const identity={family:group.label,number:named.equipment?.number||'',reference};
  if(!visible.some(row=>searchRecord({...row,equipment:identity},query)))return [];
  const active=visible.filter(row=>row.status==='À traiter'||row.status==='En cours').length;
  return [{...item,key:group.key+'|'+item.key,family:group.label,named,identity,active,
   rows:visible.sort((a,b)=>b.lastDate.localeCompare(a.lastDate)||alphabetical(a.title,b.title))}];
 })).sort((a,b)=>b.active-a.active||Number(b.identified)-Number(a.identified)||
  alphabetical(a.family,b.family)||alphabetical(a.named.title,b.named.title));
 const matchingFamilies=new Set(equipment.map(item=>vgpSearchText(item.family)));
 const list=useListPage(equipment,JSON.stringify([family,query,site,filter]),12);
 const visibleFamilies=query&&!selected?families.filter(group=>matchingFamilies.has(group.key)):families;
 const unresolved=equipment.filter(item=>!item.identified).reduce((total,item)=>total+item.rows.length,0);
 const known=equipment.filter(item=>item.identified).length;
 const observationCount=equipment.reduce((total,item)=>total+item.rows.length,0);
 function clear(){setQuery('');setSite('');setFilter('')}
 function choose(key:string){setFamily(key)}
 return <div className="vgp-material">
  <div className="vgp-panel vgp-material-filters">
   <label className="vgp-search"><Search size={19} aria-hidden="true"/><span className="sr-only">Rechercher un matériel ou une famille</span>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)}
     placeholder="Nom, famille, n° équipement, référence APAVE ou emplacement"/>
   </label>
   <label><span className="sr-only">Site du matériel</span><select value={site} onChange={event=>setSite(event.target.value)}><option value="">Tous les sites</option>
    {sites.map(value=><option value={value||'unknown'} key={value}>{value||'Site non renseigné'}</option>)}
   </select></label>
   <label><span className="sr-only">Suivi du matériel</span><select value={filter} onChange={event=>setFilter(event.target.value as EquipmentFilter)}>
    {followUpOptions.map(({value,label})=><option key={value} value={value}>{label}</option>)}
   </select></label>
   {!!(query||site||filter)&&<button className="vgp-text-action" type="button" onClick={clear}>Réinitialiser</button>}
  </div>
  <div className="vgp-material-grid">
   <aside className="vgp-panel vgp-family-navigation">
    <div className="vgp-panel-head"><h2><Boxes size={17} aria-hidden="true"/> Familles</h2></div>
    <label className="vgp-family-select"><span className="sr-only">Famille de matériel</span><select value={family} onChange={event=>choose(event.target.value)}>
     <option value="">Toutes les familles</option>{families.map(group=><option key={group.key} value={group.key}>{group.label}</option>)}
    </select></label>
    <nav aria-label="Familles de matériel">
     <button type="button" aria-pressed={!selected} onClick={()=>choose('')}><span>Toutes les familles</span><b>{families.length}</b></button>
     {visibleFamilies.map(group=><button type="button" key={group.key} aria-pressed={family===group.key} onClick={()=>choose(group.key)}>
      <span>{group.label}</span><b aria-label={group.rows.length+' observations'}>{group.rows.length}</b>
     </button>)}
    </nav>
   </aside>
   <section className="vgp-material-results">
    <div className="vgp-material-heading">
     <div><h2>{selected?.label||'Matériels signalés'}</h2>
      <p>{new Intl.NumberFormat('fr-FR').format(known)} matériel{known===1?'':'s'} identifié{known===1?'':'s'} · {observationCount} observation{observationCount===1?'':'s'}
       {unresolved>0&&<><span aria-hidden="true"> · </span><button type="button" className="vgp-text-action" onClick={()=>setFilter(filter==='unidentified'?'':'unidentified')}>{unresolved} à identifier</button></>}
      </p></div>
     {selected&&onAdd&&<button className="outline" type="button" onClick={()=>onAdd(selected.label)}><ClipboardList size={16} aria-hidden="true"/> Ajouter une observation</button>}
    </div>
    <div className="vgp-equipment-stack">{list.rows.map(item=>{
     const {number,reference}=item.identity;
     const location=item.rows.find(row=>row.location)?.location||item.named.location;
     return <details className="vgp-panel vgp-equipment" key={item.key}>
      <summary>
       <span className="vgp-equipment-icon"><Box size={19} aria-hidden="true"/></span>
       <span className="vgp-equipment-title"><strong>{item.named.title}</strong>
        <small>{[number&&'N° '+number,reference&&'APAVE '+reference,!selected&&item.family].filter(Boolean).join(' · ')||'Identifiants à compléter'}</small>
        {location&&<small><MapPin size={12} aria-hidden="true"/> {location}</small>}
       </span>
       <span className="vgp-equipment-meta">
        {!item.identified?<StatusBadge status="À qualifier">À identifier</StatusBadge>:
         item.active>0&&<StatusBadge status="À traiter">{item.active} à traiter / en cours</StatusBadge>}
        <span>{item.rows.length} {item.rows.length===1?'écart':'écarts'}</span>
       </span>
       <ArrowRight className="vgp-equipment-chevron" size={16} aria-hidden="true"/>
      </summary>
      <div className="vgp-equipment-issues">{item.rows.map(row=><button type="button" className="vgp-equipment-row" disabled={busy} key={row.id}
       onClick={()=>onOpen({id:row.id})}>
       <span><strong>{row.description||row.title}</strong>
        <small>{[row.lastDate&&displayDate(row.lastDate),row.location,row.sourceSheet].filter(Boolean).join(' · ')}</small></span>
       <span className="vgp-chip-group"><StatusBadge status={row.status}/>
        {row.ticketId&&<span className="vgp-ticket-mini"><Ticket size={13} aria-hidden="true"/> Ticket lié</span>}
       </span><ArrowRight size={15} aria-hidden="true"/>
      </button>)}</div>
     </details>;
    })}</div>
    {!equipment.length&&<EmptyState title="Aucun matériel pour cette sélection"><button className="vgp-text-action" type="button" onClick={clear}>Effacer les filtres</button></EmptyState>}
    {list.pages>1&&<ListPagination page={list.page} pages={list.pages} total={equipment.length} onChange={list.setPage}/>}
   </section>
  </div>
 </div>;
}

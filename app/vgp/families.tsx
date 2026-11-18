'use client';
import {useState} from 'react';
import {ArrowLeft,ArrowRight,Boxes,Search} from 'lucide-react';
import {ListPagination,useListPage} from '@/components/list-pagination';
import {vgpSearchText,type VgpEquipmentIdentity,type VgpRecord} from '@/lib/vgp';

export type VgpListRecord=VgpRecord&{equipment?:VgpEquipmentIdentity};
type EquipmentGroup={rows:VgpListRecord[];identity:VgpEquipmentIdentity};
const alphabetic=(a:string,b:string)=>a.localeCompare(b,'fr',{numeric:true});

export function VgpFamilies({records,busy,onOpen}:{records:VgpListRecord[];busy:boolean;onOpen:(id:string)=>void}){
 const [family,setFamily]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState('');
 const observationFamilies=new Map<string,{label:string;rows:VgpListRecord[]}>();
 for(const row of records){
  if(!row.equipment)continue;
  const key=vgpSearchText(row.equipment.family);
  const group=observationFamilies.get(key)??{label:row.equipment.family,rows:[]};
  group.rows.push(row);observationFamilies.set(key,group);
 }
 const active=observationFamilies.get(family);
 const groups=new Map<string,EquipmentGroup>();
 const search=vgpSearchText(query);
 for(const row of active?.rows??[]){
  const identity=row.equipment!;
  if(status&&row.status!==status)continue;
  const key=identity.reference?'ref:'+vgpSearchText(identity.reference):
   identity.number&&row.location?'number:'+vgpSearchText(identity.number)+'|'+vgpSearchText(row.location):row.id;
  const group=groups.get(key)??{rows:[],identity};
  if(!group.identity.number&&identity.number)group.identity=identity;
  group.rows.push(row);groups.set(key,group);
 }
 const equipment=[...groups.entries()].filter(([,group])=>group.rows.some(row=>
  vgpSearchText([row.title,row.location,row.description,group.identity.number,group.identity.reference].join(' ')).includes(search),
 )).sort(([,a],[,b])=>alphabetic(a.rows[0].title,b.rows[0].title)||alphabetic(a.identity.number,b.identity.number));
 const list=useListPage(equipment,[family,query,status].join('|'),20);
 function choose(key:string){setFamily(key);setQuery('');setStatus('')}
 return <section className="vgp-family-view">
  {active&&<button className="outline" onClick={()=>choose('')}><ArrowLeft size={15}/> Toutes les familles</button>}
  <h2>{active?.label||'Familles de matériel'}</h2>
  <div className="vgp-filters">
   <label className="vgp-search"><Search size={17}/><span className="sr-only">{active?'Rechercher un matériel':'Rechercher une famille'}</span>
    <input value={query} onChange={event=>setQuery(event.target.value)} placeholder={active?'N° équipement, référence APAVE, emplacement…':'Rechercher une famille…'}/>
   </label>
   {active&&<label><span className="sr-only">État de l’observation</span><select value={status} onChange={event=>setStatus(event.target.value)}>
    <option value="">Tous les états</option>{['À qualifier','À traiter','En cours','Levée'].map(label=><option key={label}>{label}</option>)}
   </select></label>}
  </div>
  {!active?<div className="vgp-family-grid">{[...observationFamilies.entries()].filter(([key])=>key.includes(search))
   .sort(([,a],[,b])=>alphabetic(a.label,b.label)).map(([key,group])=>
    <button key={key} className="vgp-panel vgp-family-card" onClick={()=>choose(key)}>
     <Boxes size={19} aria-hidden="true"/><span><strong>{group.label}</strong>
      <small>{group.rows.length} observation{group.rows.length===1?'':'s'}</small></span><ArrowRight size={16} aria-hidden="true"/>
    </button>)}</div>:<>
   {list.rows.map(([key,group])=>{
    const row=group.rows[0],locations=[...new Set(group.rows.map(item=>item.location).filter(Boolean))];
    return <article className="vgp-panel vgp-equipment" key={key}>
     <h3>{row.title}</h3>
     <p>{[group.identity.number&&'N° équipement '+group.identity.number,
      group.identity.reference&&'Réf. APAVE '+group.identity.reference,
      locations.join(' · ')].filter(Boolean).join(' · ')||'Identification à compléter'}</p>
     {group.rows.map(item=><button className="vgp-equipment-row" disabled={busy} key={item.id} onClick={()=>onOpen(item.id)}>
      <span>{item.description||item.title}<small>{item.lastDate?item.lastDate.split('-').reverse().join('/')+' · ':''}{item.sourceSheet}</small></span>
      <span className="vgp-badge">{item.status}</span><ArrowRight size={15} aria-hidden="true"/>
     </button>)}
    </article>;
   })}
   {!equipment.length&&<p>Aucun matériel ne correspond aux filtres.</p>}
   <ListPagination page={list.page} pages={list.pages} total={equipment.length} onChange={list.setPage}/>
  </>}
 </section>;
}

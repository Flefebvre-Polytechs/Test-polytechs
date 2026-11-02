'use client';
import {useMemo,useState} from 'react';
import {Search} from 'lucide-react';
import {fold,type WasteRecord} from '@/lib/waste';
import {wasteCatalog,newWasteFromCatalog} from '@/lib/waste-catalog';

export function WasteCatalogPicker({records,draft,onSelect}:{records:WasteRecord[];draft:WasteRecord;onSelect:(record:WasteRecord)=>void}){
 const [query,setQuery]=useState(''),[open,setOpen]=useState(false);
 const catalog=useMemo(()=>wasteCatalog(records),[records]);
 const filtered=catalog.filter(({record})=>fold([record.type,record.code,record.family].join(' ')).includes(fold(query.trim())));
 function select(item:typeof catalog[number]){onSelect(newWasteFromCatalog(item,draft));setQuery(item.record.type+(item.record.code?' · '+item.record.code:''));setOpen(false)}
 return <div className="waste-catalog-picker">
  <label htmlFor="waste-catalog-search">Reprendre un déchet du registre <span>facultatif</span></label>
  <div className="waste-catalog-control" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}><div className="waste-catalog-input"><Search size={17}/><input id="waste-catalog-search" role="combobox" aria-expanded={open} aria-controls="waste-catalog-options" aria-autocomplete="list" autoComplete="off" value={query} onFocus={()=>setOpen(true)} onChange={e=>{setQuery(e.target.value);setOpen(true)}} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}} placeholder="Rechercher un déchet, un code ou une famille…"/></div>
  {open&&<div id="waste-catalog-options" className="waste-catalog-options" role="listbox">{filtered.length?filtered.slice(0,20).map(item=><button type="button" role="option" aria-selected={false} key={item.key} onClick={()=>select(item)}><strong>{item.record.type}</strong><span>{item.record.family}{item.record.code?' · '+item.record.code:''} · {item.count} enlèvement{item.count>1?'s':''}</span></button>):<p>Aucun déchet correspondant. Saisissez un nouveau type ci-dessous.</p>}{filtered.length>20&&<small>Affinez la recherche pour voir les autres résultats.</small>}</div>}</div>
  <p>Le code, la famille et les informations de filière sont repris du dernier enlèvement correspondant. Vérifiez-les avant d’enregistrer. Date, quantités et BSD restent à saisir.</p>
 </div>
}

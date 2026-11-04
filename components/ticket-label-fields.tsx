'use client';
import {useEffect,useId,useState} from 'react';
import {MapPin,Tags,RefreshCw} from 'lucide-react';
import type {Ticket,TicketLabel} from '@/lib/hub';
import {Combobox,ComboboxValue,ComboboxChips,ComboboxChip,ComboboxChipsInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty,useComboboxAnchor} from '@/components/ui/combobox';
import './ticket-label-fields.css';
function LabelPicker({kind,options,value,onChange,disabled}:{kind:'topic'|'location';options:TicketLabel[];value:string[];onChange:(ids:string[])=>void;disabled:boolean}){
 const id=useId(),anchor=useComboboxAnchor(),[query,setQuery]=useState('');
 const selected=options.filter(o=>value.includes(o.id)),label=kind==='topic'?'Sujets':'Lieux';
 return <div className={'ticket-label-group '+kind}><label htmlFor={id}>{kind==='topic'?<Tags size={14}/>:<MapPin size={14}/>} {label}</label><Combobox multiple items={options} value={selected} onValueChange={items=>{if(items.length<=20)onChange(items.map(o=>o.id));setQuery('')}} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={o=>o.name} isItemEqualToValue={(a,b)=>a.id===b.id} filter={(o,q)=>o.name.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr').includes(q.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr'))} disabled={disabled}><ComboboxChips ref={anchor}><ComboboxValue>{(items:TicketLabel[])=>items.map(o=><ComboboxChip key={o.id} showRemove={!disabled}>{o.name}</ComboboxChip>)}</ComboboxValue>{disabled&&!selected.length?<span className="ticket-label-empty">Aucun</span>:<ComboboxChipsInput id={id} aria-label={label} placeholder={selected.length?'Ajouter…':'Sélectionner…'} disabled={disabled}/>}</ComboboxChips><ComboboxContent anchor={anchor}><ComboboxEmpty>Aucune étiquette disponible.</ComboboxEmpty><ComboboxList>{(o:TicketLabel)=><ComboboxItem key={o.id} value={o} disabled={value.length>=20&&!value.includes(o.id)}>{o.name}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox>{value.length>=20&&<small>20 étiquettes maximum.</small>}</div>
}
export function TicketLabelFields({ticket,onChange,disabled}:{ticket:Ticket;onChange:(patch:Partial<Ticket>)=>void;disabled:boolean}){
 const [labels,setLabels]=useState<TicketLabel[]>([]),[ready,setReady]=useState(false),[error,setError]=useState('');
 async function load(){setError('');try{const response=await fetch('/api/ticket-labels',{cache:'no-store'}),data=await response.json() as {labels:TicketLabel[];error?:string};if(!response.ok)throw Error(data.error||'Étiquettes indisponibles.');setLabels(data.labels);setReady(true)}catch(e){setError((e as Error).message)}}
 useEffect(()=>{void load()},[]);
 return <section className="ticket-label-fields" aria-label="Étiquettes du ticket">{(['topic','location'] as const).map(kind=>{const key=kind==='topic'?'topicTags':'locationTags';return <LabelPicker key={kind+ticket.category} kind={kind} options={labels.filter(o=>o.kind===kind&&(kind==='location'||o.category===ticket.category)).sort((a,b)=>a.name.localeCompare(b.name,'fr'))} value={ticket[key]||[]} onChange={ids=>onChange({[key]:ids})} disabled={disabled||!ready}/>})}{!ready&&!error&&<small role="status">Chargement…</small>}{error&&<div className="ticket-label-error" role="alert">{error}<button type="button" onClick={()=>void load()}><RefreshCw size={13}/> Actualiser</button></div>}</section>
}

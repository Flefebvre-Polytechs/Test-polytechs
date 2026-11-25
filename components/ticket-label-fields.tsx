'use client';

import {useId,useRef,useState} from 'react';
import {MapPin,Plus,RefreshCw,Tags} from 'lucide-react';
import {labelKey,type Ticket,type TicketLabel} from '@/lib/hub';
import {TicketLabelCreateForm,useTicketLabelCatalog} from '@/components/ticket-label-create';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {Combobox,ComboboxValue,ComboboxChips,ComboboxChip,ComboboxChipsInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty,useComboboxAnchor} from '@/components/ui/combobox';
import './ticket-label-fields.css';

const labelFields={topic:'topicTags',location:'locationTags'} as const;

function LabelPicker({kind,options,value,onChange,disabled,onCreate}:{
 kind:TicketLabel['kind'];
 options:TicketLabel[];
 value:string[];
 onChange:(ids:string[])=>void;
 disabled:boolean;
 onCreate?:(trigger:HTMLButtonElement)=>void;
}){
 const id=useId(),anchor=useComboboxAnchor(),[query,setQuery]=useState('');
 const selected=options.filter(option=>value.includes(option.id));
 const isTopic=kind==='topic';
 const label=isTopic?'Sujets':'Lieux';
 const createLabel=isTopic?'Créer un sujet':'Créer un lieu';

 return (
  <div className={'ticket-label-group '+kind}>
   <label htmlFor={id}>{isTopic?<Tags size={14} aria-hidden="true"/>:<MapPin size={14} aria-hidden="true"/>} {label}</label>
   <Combobox multiple items={options} value={selected} onValueChange={items=>{
    if(items.length<=20)onChange(items.map(option=>option.id));
    setQuery('');
   }} inputValue={query} onInputValueChange={setQuery} itemToStringLabel={option=>option.name}
    isItemEqualToValue={(a,b)=>a.id===b.id} filter={(option,q)=>labelKey(option.name).includes(labelKey(q))} disabled={disabled}>
    <ComboboxChips ref={anchor}>
     <ComboboxValue>{(items:TicketLabel[])=>items.map(option=>(
      <ComboboxChip key={option.id} showRemove={!disabled}>{option.name}</ComboboxChip>
     ))}</ComboboxValue>
     {disabled&&!selected.length?<span className="ticket-label-empty">Aucun</span>:
      <ComboboxChipsInput id={id} aria-label={label} placeholder={selected.length?'Ajouter…':'Sélectionner…'} disabled={disabled}/>}
    </ComboboxChips>
    <ComboboxContent anchor={anchor}>
     <ComboboxEmpty>Aucune étiquette disponible.</ComboboxEmpty>
     <ComboboxList>{(option:TicketLabel)=>(
      <ComboboxItem key={option.id} value={option} disabled={value.length>=20&&!value.includes(option.id)}>{option.name}</ComboboxItem>
     )}</ComboboxList>
    </ComboboxContent>
   </Combobox>
   {onCreate&&(
    <button type="button" className="ticket-label-add" aria-label={createLabel} title={createLabel}
     disabled={disabled||value.length>=20} onClick={event=>onCreate(event.currentTarget)}>
     <Plus size={17} aria-hidden="true"/>
    </button>
   )}
   {value.length>=20&&<small>20 étiquettes maximum.</small>}
  </div>
 );
}

export function TicketLabelFields({ticket,onChange,disabled}:{ticket:Ticket;onChange:(patch:Partial<Ticket>)=>void;disabled:boolean}){
 const {labels,ready,canCreate,loadError,reload,remember,revokeCreation}=useTicketLabelCatalog();
 const [draft,setDraft]=useState<TicketLabel['kind']|null>(null);
 const [creating,setCreating]=useState(false);
 const [message,setMessage]=useState('');
 const trigger=useRef<HTMLButtonElement>(null);

 function attach(label:TicketLabel){
  remember(label);
  const key=labelFields[label.kind],ids=ticket[key]||[];
  if(ids.length<20&&!ids.includes(label.id)){
   onChange({[key]:[...ids,label.id]});
   setMessage('« '+label.name+' » ajouté au ticket.');
  }
  setDraft(null);
 }

 return (
  <section className="ticket-label-fields" aria-label="Étiquettes du ticket">
   {(['topic','location'] as const).map(kind=>{
    const key=labelFields[kind];
    return (
     <LabelPicker key={kind+ticket.category} kind={kind}
      options={labels.filter(option=>option.kind===kind&&(kind==='location'||option.category===ticket.category))
       .sort((a,b)=>a.name.localeCompare(b.name,'fr'))}
      value={ticket[key]||[]} onChange={ids=>onChange({[key]:ids})} disabled={disabled||!ready}
      onCreate={canCreate&&!disabled?button=>{trigger.current=button;setMessage('');setDraft(kind)}:undefined}/>
    );
   })}
   {!ready&&!loadError&&<small role="status">Chargement des étiquettes…</small>}
   {loadError&&(
    <div className="ticket-label-error" role="alert">{loadError}
     <button type="button" onClick={reload}><RefreshCw size={13} aria-hidden="true"/> Actualiser</button>
    </div>
   )}
   <span className="sr-only" role="status">{message}</span>

   <Dialog open={!!draft&&canCreate&&!disabled} onOpenChange={open=>{if(!open&&!creating)setDraft(null)}}>
    <DialogContent className="ticket-label-dialog" showCloseButton={false}
     onCloseAutoFocus={event=>{event.preventDefault();trigger.current?.focus()}}
     onEscapeKeyDown={event=>{if(creating)event.preventDefault()}}
     onInteractOutside={event=>{if(creating)event.preventDefault()}}>
     {draft&&(
      <>
       <div className="ticket-label-dialog-heading" data-kind={draft}>
        <span>{draft==='topic'?<Tags size={21} aria-hidden="true"/>:<MapPin size={21} aria-hidden="true"/>}</span>
        <div>
         <DialogTitle>{draft==='topic'?'Nouveau sujet':'Nouveau lieu'}</DialogTitle>
         <DialogDescription>{draft==='topic'?'Thème du ticket · '+ticket.category:'Disponible dans tous les tickets.'}</DialogDescription>
        </div>
       </div>
       <TicketLabelCreateForm key={draft+ticket.category} kind={draft} category={draft==='topic'?ticket.category:''}
        labels={labels} attached={ticket[labelFields[draft]]||[]} onComplete={attach} onForbidden={()=>{
         revokeCreation();
         setDraft(null);
         setMessage('Le rôle Créateur d’étiquettes est nécessaire.');
        }} onBusyChange={setCreating} onCancel={()=>setDraft(null)}/>
      </>
     )}
    </DialogContent>
   </Dialog>
  </section>
 );
}

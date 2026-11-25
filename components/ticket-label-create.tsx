'use client';

import {useEffect,useId,useRef,useState,type FormEvent} from 'react';
import {CircleAlert,Plus} from 'lucide-react';
import {categories,labelInputError,labelKey,type TicketLabel} from '@/lib/hub';
import './ticket-label-create.css';

type Catalog={labels:TicketLabel[];canCreate:boolean};

export function useTicketLabelCatalog(ticketId=''){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [loadError,setLoadError]=useState('');
 const [attempt,setAttempt]=useState(0);

 useEffect(()=>{
  const controller=new AbortController();
  async function load(){
   try{
    const suffix=ticketId?'?ticketId='+encodeURIComponent(ticketId):'';
    const response=await fetch('/api/ticket-labels'+suffix,{cache:'no-store',signal:controller.signal});
    const data=await response.json().catch(()=>null) as (Catalog&{error?:string})|null;
    if(!response.ok||!Array.isArray(data?.labels))throw Error(data?.error||'Catalogue indisponible.');
    if(!controller.signal.aborted)setCatalog({labels:data.labels,canCreate:data.canCreate===true});
   }catch(e){
    if(!controller.signal.aborted)setLoadError((e as Error).message||'Catalogue indisponible.');
   }
  }
  void load();
  return ()=>controller.abort();
 },[attempt,ticketId]);

 function reload(){
  setLoadError('');
  setAttempt(value=>value+1);
 }
 function remember(label:TicketLabel){
  setCatalog(current=>current?{...current,labels:[...current.labels.filter(row=>row.id!==label.id),label]}:current);
 }
 function forget(id:string){
  setCatalog(current=>current?{...current,labels:current.labels.filter(row=>row.id!==id)}:current);
 }
 function revokeCreation(){
  setCatalog(current=>current?{...current,canCreate:false}:current);
 }
 return {labels:catalog?.labels??[],ready:catalog!==null,canCreate:catalog?.canCreate===true,loadError,reload,remember,forget,revokeCreation};
}

export function TicketLabelCreateForm({
 kind,category,labels,onCategoryChange,attached,onComplete,onForbidden,onBusyChange,onCancel,
}:{
 kind:TicketLabel['kind'];
 category:string;
 labels:TicketLabel[];
 onCategoryChange?:(category:string)=>void;
 attached?:readonly string[];
 onComplete:(label:TicketLabel,created:boolean)=>void;
 onForbidden:()=>void;
 onBusyChange:(busy:boolean)=>void;
 onCancel?:()=>void;
}){
 const nameId=useId(),messageId=useId();
 const form=useRef<HTMLFormElement>(null);
 const [name,setName]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const key=labelKey(name);
 const existing=key?labels.find(label=>!label.deletedAt&&label.kind===kind&&label.category===category&&labelKey(label.name)===key):undefined;
 const canAttach=!!existing&&!!attached&&!attached.includes(existing.id);
 const validation=labelInputError(kind,category,name);
 const hint=existing
  ? canAttach
    ? '« '+existing.name+' » existe déjà. Vous pouvez l’ajouter au ticket.'
    : attached
      ? '« '+existing.name+' » figure déjà sur ce ticket.'
      : '« '+existing.name+' » existe déjà '+(kind==='topic'?'dans ce thème.':'dans les lieux.')
  : name.trim().length>=2&&(kind==='location'||category)?validation:'';

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(busy||validation||existing&&!canAttach)return;
  if(existing){
   onComplete(existing,false);
   return;
  }

  const submittedForm=event.currentTarget;
  setBusy(true);
  onBusyChange(true);
  setError('');
  try{
   const response=await fetch('/api/ticket-labels',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({kind,category,name}),
   });
   const data=await response.json().catch(()=>null) as {label?:TicketLabel;created?:boolean;error?:string}|null;
   if(form.current!==submittedForm)return;
   if(!response.ok||!data?.label){
    if(response.status===403)onForbidden();
    throw Error(data?.error||'Création de l’étiquette impossible.');
   }
   setName('');
   onComplete(data.label,data.created!==false);
  }catch(e){
   if(form.current===submittedForm)setError((e as Error).message||'Création de l’étiquette impossible.');
  }finally{
   if(form.current===submittedForm)setBusy(false);
   onBusyChange(false);
  }
 }

 return (
  <form ref={form} className="ticket-label-create" data-kind={kind} onSubmit={submit} aria-busy={busy}>
   {kind==='topic'&&onCategoryChange&&(
    <label>
     Thème du sujet
     <select value={category} required disabled={busy} onChange={event=>{onCategoryChange(event.target.value);setError('')}}>
      <option value="" disabled>Choisir un thème…</option>
      {categories.map(theme=><option key={theme}>{theme}</option>)}
     </select>
    </label>
   )}
   <label htmlFor={nameId}>
    Nom de l’étiquette
    <input id={nameId} value={name} onChange={event=>{setName(event.target.value);setError('')}}
     placeholder={kind==='topic'?'Ex. Déversement accidentel':'Ex. Atelier mélange'} minLength={2} maxLength={60}
     required disabled={busy} aria-describedby={hint||error?messageId:undefined}/>
   </label>
   {(hint||error)&&(
    <p id={messageId} className="ticket-label-feedback" data-error={!!error} role={error?'alert':'status'}>
     <CircleAlert aria-hidden="true" size={16}/>{error||hint}
    </p>
   )}
   <div className="ticket-label-create-actions">
    {onCancel&&<button type="button" className="ticket-label-cancel" onClick={onCancel} disabled={busy}>Annuler</button>}
    <button type="submit" className="ticket-label-submit" disabled={busy||!!validation||!!existing&&!canAttach}>
     <Plus size={17} aria-hidden="true"/>
     {busy?'Création…':canAttach?'Associer l’étiquette':onCancel?'Créer et associer':kind==='topic'?'Créer le sujet':'Créer le lieu'}
    </button>
   </div>
  </form>
 );
}

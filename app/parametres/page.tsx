'use client';

import {useRef,useState,type FormEvent} from 'react';
import {ArrowUpRight,Check,CheckCircle2,LockKeyhole,MapPin,RefreshCw,Search,Tag,Tags,Trash2,UsersRound} from 'lucide-react';
import {AccountGate} from '@/components/account-gate';
import {HubFrame} from '@/components/hub-layout';
import {TicketLabelCreateForm,useTicketLabelCatalog} from '@/components/ticket-label-create';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {categories,labelKey,type TicketLabel} from '@/lib/hub';
import {categoryVisuals} from '@/lib/ticket-visuals';
import './style.css';

const labelTypes=[
 {kind:'topic',title:'Sujets',Icon:Tags},
 {kind:'location',title:'Lieux',Icon:MapPin},
] as const;

function LabelSettings({admin}:{admin:boolean}){
 const {labels,ready,canCreate,loadError,reload,remember,forget,revokeCreation}=useTicketLabelCatalog();
 const [kind,setKind]=useState<TicketLabel['kind']>('topic');
 const [category,setCategory]=useState('');
 const [filter,setFilter]=useState('');
 const [query,setQuery]=useState('');
 const [creating,setCreating]=useState(false);
 const [lastSaved,setLastSaved]=useState<{label:TicketLabel;created:boolean}|null>(null);
 const [deleteTarget,setDeleteTarget]=useState<TicketLabel|null>(null);
 const [deleteText,setDeleteText]=useState('');
 const [deleting,setDeleting]=useState(false);
 const [deleteError,setDeleteError]=useState('');
 const [removed,setRemoved]=useState('');
 const deleteTrigger=useRef<HTMLButtonElement>(null);
 const catalogSearch=useRef<HTMLInputElement>(null);
 const isTopic=kind==='topic';
 const term=labelKey(query);
 const topicCount=labels.filter(label=>label.kind==='topic').length;
 const groups=(isTopic?(filter?[filter]:categories):['Lieux']).map(title=>({
  title,
  entries:labels.filter(label=>label.kind===kind&&(!isTopic||label.category===title)&&labelKey(label.name+' '+title).includes(term))
   .sort((a,b)=>a.name.localeCompare(b.name,'fr')),
 })).filter(group=>group.entries.length);
 const resultCount=groups.reduce((total,group)=>total+group.entries.length,0);

 function chooseType(nextKind:TicketLabel['kind']){
  if(kind===nextKind)return;
  setKind(nextKind);
  setQuery('');
  setLastSaved(null);
  setRemoved('');
 }
 function changeFilter(theme:string){
  setFilter(theme);
  if(theme)setCategory(theme);
 }
 function showSaved(label:TicketLabel,created:boolean){
  remember(label);
  setQuery('');
  if(label.kind==='topic'&&filter&&filter!==label.category)setFilter(label.category);
  setLastSaved({label,created});
  setRemoved('');
 }
 function confirmDeletion(label:TicketLabel,trigger:HTMLButtonElement){
  deleteTrigger.current=trigger;
  setDeleteTarget(label);
  setDeleteText('');
  setDeleteError('');
 }
 async function deleteLabel(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!deleteTarget||deleting||!canCreate||deleteText!=='SUPPRIMER')return;
  setDeleting(true);
  setDeleteError('');
  try{
   const response=await fetch('/api/ticket-labels',{
    method:'DELETE',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:deleteTarget.id,confirmation:deleteText}),
   });
   if(!response.ok){
    const data=await response.json().catch(()=>null) as {error?:string}|null;
    if(response.status===403)revokeCreation();
    throw Error(data?.error||'Suppression de l’étiquette impossible.');
   }
   forget(deleteTarget.id);
   if(lastSaved?.label.id===deleteTarget.id)setLastSaved(null);
   setRemoved(deleteTarget.name);
   setDeleteTarget(null);
  }catch(e){
   setDeleteError((e as Error).message||'Suppression de l’étiquette impossible.');
  }finally{
   setDeleting(false);
  }
 }

 return (
  <section className="label-workspace" aria-labelledby="label-workspace-title">
   <header className="label-settings-header">
    <div className="label-settings-symbol"><Tags size={28} aria-hidden="true"/></div>
    <div>
     <h1 id="label-workspace-title">Étiquettes des tickets</h1>
     <p>Organisez les sujets par thème et les lieux utilisés dans vos tickets.</p>
    </div>
    {admin&&<a className="label-manage-access" href="/membres"><UsersRound size={17} aria-hidden="true"/> Gérer les accès <ArrowUpRight size={14} aria-hidden="true"/></a>}
   </header>

   {loadError&&<div className="label-catalog-state" role="alert">
    {loadError} <button type="button" onClick={reload}><RefreshCw size={15} aria-hidden="true"/> Réessayer</button>
   </div>}
   {!ready&&!loadError&&<p className="label-catalog-state" role="status">Chargement du catalogue…</p>}
   {ready&&(
    <>
     <nav className="label-type-picker" aria-label="Type d’étiquette">
      {labelTypes.map(({kind:option,title,Icon})=>(
       <button key={option} type="button" data-kind={option} aria-pressed={kind===option}
        onClick={()=>chooseType(option)} disabled={creating}>
        <Icon size={19} aria-hidden="true"/>
        <span>{title}</span>
        <span className="label-type-count">{option==='topic'?topicCount:labels.length-topicCount}</span>
       </button>
      ))}
     </nav>

     <div className="label-settings-grid">
      <section className="label-settings-create" data-kind={kind} aria-labelledby="label-create-title">
       <div className="label-settings-create-heading">
        <span className="label-create-symbol">{isTopic?<Tag size={20} aria-hidden="true"/>:<MapPin size={20} aria-hidden="true"/>}</span>
        <div>
         <h2 id="label-create-title">{isTopic?'Nouveau sujet':'Nouveau lieu'}</h2>
         <p>{isTopic?'Le sujet sera proposé pour le thème choisi.':'Le lieu sera proposé dans tous les tickets.'}</p>
        </div>
       </div>
       {canCreate?(
        <TicketLabelCreateForm key={kind} kind={kind} category={isTopic?category:''} labels={labels}
         onCategoryChange={setCategory} onComplete={showSaved} onForbidden={revokeCreation} onBusyChange={setCreating}/>
       ):(
        <p className="label-create-access"><LockKeyhole size={17} aria-hidden="true"/>
         <span>Le rôle <strong>Créateur d’étiquettes</strong> est requis pour créer ou supprimer une étiquette.</span>
        </p>
       )}
       {lastSaved&&(
        <p className="label-creation-result" role="status">
         <CheckCircle2 size={17} aria-hidden="true"/>
         <span><strong data-no-translate>« {lastSaved.label.name} »</strong> {lastSaved.created?'est disponible dans les tickets.':'figurait déjà au catalogue.'}</span>
        </p>
       )}
      </section>

      <section className="label-library" aria-labelledby="label-library-title">
       <h2 id="label-library-title">{isTopic?'Catalogue des sujets':'Catalogue des lieux'}</h2>
       <div className="label-library-filters">
        <label className="label-library-search">
         <Search size={17} aria-hidden="true"/><span className="sr-only">Rechercher une étiquette</span>
         <input ref={catalogSearch} type="search" placeholder="Rechercher une étiquette…" value={query} onChange={event=>setQuery(event.target.value)}/>
        </label>
        {isTopic&&(
         <select aria-label="Filtrer par thème" value={filter} onChange={event=>changeFilter(event.target.value)} disabled={creating}>
          <option value="">Tous les thèmes</option>
          {categories.map(theme=><option key={theme}>{theme}</option>)}
         </select>
        )}
       </div>
       {removed&&<p className="label-creation-result label-removal-result" role="status">
        <CheckCircle2 size={17} aria-hidden="true"/>
        <span><strong data-no-translate>« {removed} »</strong> a été supprimée du catalogue.</span>
       </p>}
       {(term||isTopic&&filter)&&<p className="label-library-results" role="status">{resultCount} résultat{resultCount!==1?'s':''}</p>}
       {groups.length?(
        <div className="label-library-groups">
         {groups.map(({title,entries})=>{
          const visual=isTopic?categoryVisuals[title]:{Icon:MapPin,tone:'location'};
          return (
           <section key={title} className="label-library-group" data-tone={visual.tone}>
            {isTopic&&<h3><visual.Icon size={17} aria-hidden="true"/>{title}</h3>}
            <ul>
             {entries.map(label=>(
              <li key={label.id} data-saved={lastSaved?.label.id===label.id}>
               {lastSaved?.label.id===label.id&&<Check size={14} aria-hidden="true"/>}
               <span data-no-translate>{label.name}</span>
               {canCreate&&(
                <button type="button" className="label-remove-button" title="Supprimer l’étiquette"
                 aria-label={'Supprimer l’étiquette '+label.name} disabled={creating||deleting}
                 onClick={event=>confirmDeletion(label,event.currentTarget)}>
                 <Trash2 size={13} aria-hidden="true"/>
                </button>
               )}
              </li>
             ))}
            </ul>
           </section>
          );
         })}
        </div>
       ):(
        <div className="label-library-empty">
         {term?<Search size={24} aria-hidden="true"/>:isTopic?<Tags size={24} aria-hidden="true"/>:<MapPin size={24} aria-hidden="true"/>}
         <p>{term?'Aucune étiquette ne correspond à cette recherche.':isTopic&&filter?'Aucun sujet pour ce thème.':isTopic?'Aucun sujet dans le catalogue.':'Aucun lieu dans le catalogue.'}</p>
         {(term||isTopic&&filter)&&<button type="button" onClick={()=>{setQuery('');changeFilter('')}}>Effacer les filtres</button>}
        </div>
       )}
      </section>
     </div>
    </>
   )}
   <Dialog open={!!deleteTarget} onOpenChange={open=>{if(!open&&!deleting)setDeleteTarget(null)}}>
    <DialogContent className="label-delete-dialog" showCloseButton={false}
     onCloseAutoFocus={event=>{
      event.preventDefault();
      const button=deleteTrigger.current;
      if(button?.isConnected)button.focus();
      else catalogSearch.current?.focus();
     }}>
     <DialogTitle>Supprimer l’étiquette</DialogTitle>
     <DialogDescription>
      <strong data-no-translate>« {deleteTarget?.name} »</strong>{deleteTarget?.category?' · '+deleteTarget.category:''} sera retirée du catalogue.
      Les tickets qui la portent déjà conserveront cette étiquette.
     </DialogDescription>
     <form className="label-delete-form" onSubmit={deleteLabel}>
      <label>Saisissez <strong>SUPPRIMER</strong> pour confirmer
       <input value={deleteText} onChange={event=>setDeleteText(event.target.value)}
        autoComplete="off" spellCheck={false} disabled={deleting}/>
      </label>
      {deleteError&&<p className="ticket-label-feedback" data-error="true" role="alert">{deleteError}</p>}
      <div className="ticket-label-create-actions">
       <button type="button" className="ticket-label-cancel" disabled={deleting} onClick={()=>setDeleteTarget(null)}>Annuler</button>
       <button type="submit" className="label-delete-submit" disabled={deleting||deleteText!=='SUPPRIMER'||!canCreate}>
        <Trash2 size={16} aria-hidden="true"/>{deleting?'Suppression…':'Supprimer l’étiquette'}
       </button>
      </div>
     </form>
    </DialogContent>
   </Dialog>
  </section>
 );
}

export default function SettingsPage(){
 return <AccountGate>{account=>
  <HubFrame active="Paramètres" teamId="" className="ticket-labels-workspace">
   <LabelSettings admin={account.role==='admin'}/>
  </HubFrame>
 }</AccountGate>;
}

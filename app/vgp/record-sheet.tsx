'use client';

import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {ArrowRight,CalendarClock,Clock3,FileText,History,MapPin,Pencil,Plus,Ticket,Upload,X} from 'lucide-react';
import {hubRequest} from '@/components/hub-layout';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {useConfirmation} from '@/components/use-confirmation';
import {blankVgp,nextVgpDate,vgpResults,vgpStatuses,vgpTiming,type VgpPassage,type VgpRecord} from '@/lib/vgp';
import {displayDate,dueLabel,type RegisterRow,type SheetTarget,type VgpDetail,type VgpFile,type VgpUser} from './model';
import {EmptyState,StatusBadge} from './register';

export type VgpSheetRequest=SheetTarget|{kind:VgpRecord['kind'];family?:string};
type Tab='summary'|'passages'|'files';
type Form='edit'|'plan'|'passage'|null;
type PassageDraft={performedDate:string;result:string;reportExpected:boolean;note:string;nextDue:string};

function newDetail(request:Extract<VgpSheetRequest,{kind:VgpRecord['kind']}>):VgpDetail{
 const record=blankVgp(request.kind);
 if(request.kind==='observation')record.equipment={family:request.family||'',number:'',reference:''};
 return {record,files:[],history:[],passages:[]};
}

type SheetProps={request:VgpSheetRequest;records:RegisterRow[];users:VgpUser[];canEdit:boolean;today:string;
 onClose:()=>void;onFollow:(target:SheetTarget)=>void;
 onChanged:(id:string,passageId?:string)=>void;returnFocus:HTMLElement|null};

export function VgpRecordSheet({request,records,users,canEdit,today,onClose,onFollow,onChanged,returnFocus}:SheetProps){
 const target='id' in request?request:null;
 const [detail,setDetail]=useState<VgpDetail|null>(()=>'kind' in request?newDetail(request):null);
 const [form,setForm]=useState<Form>(()=>'kind' in request?'edit':null);
 const [draft,setDraft]=useState<VgpRecord|null>(()=>'kind' in request?newDetail(request).record:null);
 const [planDate,setPlanDate]=useState(''),[entry,setEntry]=useState<PassageDraft|null>(null);
 const [tab,setTab]=useState<Tab>(target?.intent==='passages'||target?.passageId?'passages':'summary');
 const [focusPassage,setFocusPassage]=useState(target?.passageId||'');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refreshId,setRefreshId]=useState('');
 const {askConfirm,confirmation}=useConfirmation();
 const titleRef=useRef<HTMLHeadingElement>(null),passageRef=useRef<HTMLDetailsElement>(null);
 const formRef=useRef<HTMLDivElement>(null);
 const formId=useId();
 const record=detail?.record;
 const dirty=form==='passage'||form==='plan'&&planDate!==record?.plannedDate||
  form==='edit'&&!!draft&&JSON.stringify(draft)!==JSON.stringify(record);
 const kind=record?.kind||('kind' in request?request.kind:undefined);
 const control=kind==='control';

 useEffect(()=>{
  if(!target)return;
  let current=true;
  hubRequest('/api/vgp?id='+encodeURIComponent(target.id)).then((loaded:VgpDetail)=>{
   if(!current)return;
   setDetail(loaded);setError('');setRefreshId('');
   if(target.intent==='plan'&&canEdit&&loaded.record.kind==='control'){
    setPlanDate(loaded.record.plannedDate);setForm('plan');
   }
   if(target.intent==='qualify'&&canEdit&&loaded.record.kind==='observation'){
    setDraft(loaded.record);setForm('edit');
   }
  }).catch(e=>{if(current){setError(e.message);setRefreshId(target.id)}});
  return ()=>{current=false};
 },[target,canEdit]);

 useEffect(()=>{
  if(!dirty)return;
  const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
  window.addEventListener('beforeunload',prevent);
  return ()=>window.removeEventListener('beforeunload',prevent);
 },[dirty]);

 useEffect(()=>{
  if(!form)return;
  const frame=requestAnimationFrame(()=>formRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus());
  return ()=>cancelAnimationFrame(frame);
 },[form]);

 useEffect(()=>{
  if(form||tab!=='passages'||!focusPassage||!detail)return;
  const frame=requestAnimationFrame(()=>{
   passageRef.current?.scrollIntoView({block:'nearest'});
   passageRef.current?.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
  });
  return ()=>cancelAnimationFrame(frame);
 },[detail,focusPassage,form,tab]);

 async function close(){
  if(busy)return;
  if(dirty&&!await askConfirm('Abandonner les modifications non enregistrées ?'))return;
  onClose();
 }
 function edit(){
  if(!record)return;
  setError('');setNotice('');setDraft({...record});setForm('edit');
 }
 function plan(){
  if(!record)return;
  setError('');setNotice('');setPlanDate(record.plannedDate);setTab('summary');setForm('plan');
 }
 function addPassage(){
  if(!record)return;
  setError('');setNotice('');setTab('passages');
  setEntry({performedDate:today,result:'En attente du rapport',reportExpected:true,note:'',nextDue:nextVgpDate(today,record.months)});
  setForm('passage');
 }
 function cancelForm(){
  if(!record?.id){void close();return}
  setForm(null);setDraft(null);setEntry(null);setError('');
 }
 function patch<K extends keyof VgpRecord>(key:K,value:VgpRecord[K]){
  setDraft(previous=>previous&&({...previous,[key]:value}));
 }
 async function refresh(id:string,passageId=''){
  try{
   const next:VgpDetail=await hubRequest('/api/vgp?id='+encodeURIComponent(id));
   setDetail(next);setFocusPassage(passageId);setRefreshId('');
  }catch{
   setRefreshId(id);setError('Impossible d’actualiser la fiche. Réessayez le chargement.');
  }
 }
 async function retry(){
  setBusy(true);setError('');
  try{await refresh(refreshId,focusPassage)}finally{setBusy(false)}
 }
 async function save(operation:string,data?:unknown){
  if(!record||busy||refreshId)return;
  setBusy(true);setError('');setNotice('');
  try{
   const result=await hubRequest('/api/vgp',{operation,id:record.id,revision:record.revision,data});
   if(operation==='ticket'){
    onChanged(result.id);
    location.assign('/tickets?id='+encodeURIComponent(result.ticketId));
    return;
   }
   const passageId=result.passageId||(operation==='passage-result'?(data as {passageId:string}).passageId:focusPassage);
   setForm(null);setDraft(null);setEntry(null);
   setNotice(operation==='plan'?'Rendez-vous enregistré.':operation==='passage'?'Passage enregistré.':operation==='passage-result'?'Résultat du contrôle enregistré.':'Fiche enregistrée.');
   await refresh(result.id,passageId);
   onChanged(result.id,passageId);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 async function upload(file:File|undefined,passageId?:string){
  if(!file||!record?.id||busy||refreshId)return;
  setBusy(true);setError('');setNotice('');
  try{
   const data=new FormData();
   data.set('recordId',record.id);data.set('file',file);
   if(passageId)data.set('passageId',passageId);
   const response=await fetch('/api/vgp/files',{method:'POST',body:data});
   if(!response.ok){
    const body=await response.json().catch(()=>null) as {error?:string}|null;
    throw Error(body?.error||'Dépôt impossible.');
   }
   setNotice('Rapport PDF déposé.');
   await refresh(record.id,passageId);
   onChanged(record.id,passageId);
  }catch(e){setError((e as Error).message)}finally{setBusy(false)}
 }
 function submit(){
  if(form==='edit'&&draft)void save('save',draft);
  if(form==='plan')void save('plan',{plannedDate:planDate});
  if(form==='passage'&&entry)void save('passage',entry);
 }

 const disabled=busy||!!refreshId;
 const attachments=detail?.files.filter(file=>!file.passage_id)??[];
 const linked=record&&records.find(row=>row.id===record.controlId&&row.kind==='control');
 const observations=control&&record?records.filter(row=>row.kind==='observation'&&row.controlId===record.id):[];
 const pilot=record&&users.find(user=>user.id===record.pilotId)?.display_name;
 const timing=record&&(control?vgpTiming(record,today):record.status);
 const selectedTitle=record?.title||(control?'Nouveau contrôle':kind==='observation'?'Nouvelle observation':'Fiche VGP');
 const headingDetail=record?[record.equipment?.family||record.domain,record.location].filter(Boolean).join(' · '):'';
 return <Dialog open onOpenChange={open=>{if(!open)void close()}}>
  <DialogContent className="vgp-dialog" showCloseButton={false}
   onOpenAutoFocus={event=>{event.preventDefault();titleRef.current?.focus()}}
   onCloseAutoFocus={event=>{event.preventDefault();if(returnFocus?.isConnected)returnFocus.focus()}}>
   <header className="vgp-sheet-head">
    <div>
     <div className="vgp-sheet-kind"><span>{control?'Contrôle périodique':kind==='observation'?'Observation VGP':'VGP'}</span>{timing&&<StatusBadge status={timing}/>}</div>
     <DialogTitle ref={titleRef} tabIndex={-1}>{selectedTitle}</DialogTitle>
     <DialogDescription className={headingDetail?'vgp-sheet-meta':'sr-only'}>{headingDetail||'Fiche de suivi du registre VGP'}</DialogDescription>
    </div>
    <button type="button" aria-label="Fermer la fiche VGP" className="vgp-sheet-close" disabled={busy} onClick={()=>void close()}><X size={20} aria-hidden="true"/></button>
   </header>
   {record?.id&&!form&&<nav className="vgp-sheet-tabs" aria-label="Sections de la fiche">
    <button type="button" aria-pressed={tab==='summary'} onClick={()=>setTab('summary')}>Synthèse</button>
    {control&&<button type="button" aria-pressed={tab==='passages'} onClick={()=>setTab('passages')}>Passages <b>{detail?.passages.length||0}</b></button>}
    <button type="button" aria-pressed={tab==='files'} onClick={()=>setTab('files')}>Documents et historique</button>
   </nav>}
   {(error||notice)&&<div className="vgp-sheet-feedback">
    {error&&<p className="vgp-message" role="alert" data-tone="red">{error}
     {refreshId&&<button type="button" className="vgp-text-action" disabled={busy} onClick={()=>void retry()}>Recharger la fiche</button>}</p>}
    {notice&&<p className="vgp-message" role="status" data-tone="green">{notice}</p>}
   </div>}
   <div className="vgp-detail-scroll">
    {!detail&&!error&&<p role="status" className="vgp-sheet-loading">Chargement de la fiche…</p>}
    {record&&detail&&<>
     {form&&<div ref={formRef} className="vgp-sheet-form-section">
      <h3>{form==='edit'?(record.id?'Modifier la fiche':selectedTitle):form==='plan'?'Planifier le contrôle':'Enregistrer un passage'}</h3>
      <form id={formId} onSubmit={event=>{event.preventDefault();submit()}}>
       <fieldset disabled={disabled} className="vgp-form">
        {form==='edit'&&draft&&<RecordFields draft={draft} records={records} users={users} patch={patch}/>}
        {form==='plan'&&<>
         <div className="vgp-wide vgp-inline-fact"><span>Échéance du contrôle</span><strong>{displayDate(record.due)}</strong></div>
         <label className="vgp-wide">Date du rendez-vous<input type="date" value={planDate} onChange={event=>setPlanDate(event.target.value)}/></label>
         {planDate&&record.due&&planDate>record.due&&<p className="vgp-wide vgp-message" data-tone="amber">Ce rendez-vous est prévu après l’échéance du contrôle.</p>}
        </>}
        {form==='passage'&&entry&&<>
         <div className="vgp-wide vgp-inline-fact"><span>Échéance du passage</span><strong>{displayDate(record.due)}</strong><span>Prévu le</span><strong>{displayDate(record.plannedDate)}</strong></div>
         <label>Date réelle<input required type="date" max={today} value={entry.performedDate}
          onChange={event=>{const performedDate=event.target.value;setEntry({...entry,performedDate,nextDue:nextVgpDate(performedDate,record.months)})}}/></label>
         <label>Résultat<select value={entry.result} onChange={event=>setEntry({...entry,result:event.target.value,reportExpected:entry.reportExpected||event.target.value==='En attente du rapport'})}>
          {vgpResults.map(result=><option key={result}>{result}</option>)}</select></label>
         <label>Prochaine échéance<input type="date" value={entry.nextDue} onChange={event=>setEntry({...entry,nextDue:event.target.value})}/></label>
         <label className="vgp-check"><input type="checkbox" checked={entry.reportExpected} disabled={entry.result==='En attente du rapport'}
          onChange={event=>setEntry({...entry,reportExpected:event.target.checked})}/> Rapport attendu</label>
         <label className="vgp-wide">Notes du passage<textarea rows={3} maxLength={10000} value={entry.note} onChange={event=>setEntry({...entry,note:event.target.value})}/></label>
        </>}
       </fieldset>
      </form>
     </div>}
     {!form&&tab==='summary'&&<>
      <dl className="vgp-sheet-facts">
       <Fact label={control?'Échéance du contrôle':'Échéance de traitement'} value={displayDate(record.due)} detail={record.due?dueLabel(record.due,today):undefined}/>
       <Fact label={control?'Rendez-vous prévu':'Date du relevé'} value={displayDate(control?record.plannedDate:record.lastDate)}
        detail={control&&record.plannedDate&&record.due&&record.plannedDate>record.due?'Après l’échéance du contrôle':undefined}/>
       <Fact label="Pilote" value={pilot||'À attribuer'}/>
      </dl>
      {canEdit&&<div className="vgp-sheet-actions">
       {control&&record.id&&<>
        <button className="primary" type="button" disabled={disabled} onClick={plan}><CalendarClock size={16} aria-hidden="true"/>{record.plannedDate?'Modifier le rendez-vous':'Planifier'}</button>
        <button className="outline" type="button" disabled={disabled} onClick={addPassage}><Plus size={16} aria-hidden="true"/> Enregistrer un passage</button>
       </>}
       {!control&&!record.ticketId&&record.id&&<button className="primary" type="button" disabled={disabled} onClick={()=>void save('ticket')}><Ticket size={16} aria-hidden="true"/> Créer le ticket d’écart</button>}
       <button className="outline" type="button" disabled={disabled} onClick={edit}><Pencil size={15} aria-hidden="true"/> Modifier la fiche</button>
      </div>}
      <section className="vgp-sheet-section">
       <h3>{control?'Informations du contrôle':'Identification du matériel'}</h3>
       <dl className="vgp-sheet-specs">
        {control?<>
         <Fact label="Dernière vérification" value={displayDate(record.lastDate)}/>
         <Fact label="Périodicité" value={record.months?record.months+' mois':'À renseigner'}/>
         <Fact label="Prestataire" value={record.provider||'À renseigner'}/>
         <Fact label="Caractère réglementaire" value={record.regulatory||'À renseigner'}/>
        </>:<>
         <Fact label="N° équipement" value={record.equipment?.number||'À renseigner'}/>
         <Fact label="Référence APAVE" value={record.equipment?.reference||'À renseigner'}/>
         <Fact label="Emplacement" value={record.location||'À renseigner'}/>
         <Fact label="Contrôle associé" value={linked?<button type="button" className="vgp-text-action" disabled={disabled} onClick={()=>onFollow({id:linked.id})}>{linked.title} <ArrowRight size={14} aria-hidden="true"/></button>:'À rattacher'}/>
        </>}
        {record.reference&&<Fact label="Référence source" value={record.reference}/>}
       </dl>
      </section>
      {(record.description||record.note)&&<section className="vgp-sheet-section">
       {record.description&&<><h3>{control?'Objet du contrôle':'Constat'}</h3><p className="vgp-prewrap">{record.description}</p></>}
       {record.note&&<><h3>Suivi</h3><p className="vgp-prewrap">{record.note}</p></>}
      </section>}
      {(record.ticketId||control&&canEdit)&&<section className="vgp-sheet-section"><h3>Ticket de suivi</h3>
       {record.ticketId?<a className="outline" href={'/tickets?id='+encodeURIComponent(record.ticketId)}><Ticket size={16} aria-hidden="true"/> Ouvrir le ticket lié <ArrowRight size={15} aria-hidden="true"/></a>:
        <button className="outline" type="button" disabled={disabled} onClick={()=>void save('ticket')}><Ticket size={16} aria-hidden="true"/> Créer un ticket de suivi</button>}
      </section>}
      {control&&observations.length>0&&<section className="vgp-sheet-section"><h3>Observations associées ({observations.length})</h3>
       <ul className="vgp-linked-list">{observations.map(row=><li key={row.id}><button type="button" disabled={disabled} onClick={()=>onFollow({id:row.id})}>
        <span>{row.title}</span><StatusBadge status={row.status}/><ArrowRight size={15} aria-hidden="true"/>
       </button></li>)}</ul>
      </section>}
     </>}
     {!form&&tab==='passages'&&control&&<section className="vgp-sheet-section vgp-timeline">
      <header><h3>Passages du contrôle</h3>
       {canEdit&&<button type="button" className="primary" disabled={disabled} onClick={addPassage}><Plus size={16} aria-hidden="true"/> Enregistrer un passage</button>}
      </header>
      {detail.passages.map(passage=><Passage key={passage.id} passage={passage} recordId={record.id}
       files={detail.files.filter(file=>file.passage_id===passage.id)}
       focus={focusPassage===passage.id} focusRef={passageRef} canEdit={canEdit} disabled={disabled}
       onResult={result=>void save('passage-result',{passageId:passage.id,result})}
       onUpload={file=>void upload(file,passage.id)}/>)}
      {!detail.passages.length&&<EmptyState title="Aucun passage enregistré"/>}
     </section>}
     {!form&&tab==='files'&&<div>
      <section className="vgp-sheet-section">
       <h3><FileText size={17} aria-hidden="true"/> Documents de la fiche</h3>
       {attachments.map(file=><FileLink key={file.id} file={file}/>)}
       {!attachments.length&&<p className="vgp-muted">Aucun document général déposé.</p>}
       {canEdit&&<UploadField label="Déposer un PDF" disabled={disabled} onFile={file=>void upload(file)}/>}
       {control&&detail.files.some(file=>file.passage_id)&&<button type="button" className="vgp-text-action" onClick={()=>setTab('passages')}>Voir les rapports rattachés aux passages <ArrowRight size={15} aria-hidden="true"/></button>}
      </section>
      {!!Object.keys(record.raw||{}).length&&<details className="vgp-sheet-section vgp-source">
       <summary>Données d’origine · {record.sourceSheet}, ligne {record.sourceRow}</summary>
       <dl>{Object.entries(record.raw).map(([key,value])=><Fact key={key} label={key} value={value}/>)}</dl>
      </details>}
      {!!detail.history.length&&<section className="vgp-sheet-section">
       <h3><History size={17} aria-hidden="true"/> Historique des modifications</h3>
       {detail.history.map((entry,index)=>{
        const old=JSON.parse(entry.snapshot) as VgpRecord;
        return <details className="vgp-history-row" key={entry.saved_at+':'+index}>
         <summary>{new Date(entry.saved_at).toLocaleString('fr-FR')} · {entry.saved_by}</summary>
         <p>{old.title||'Création de la fiche'}</p>
         <p>Échéance précédente {displayDate(old.due)} · Prévu le {displayDate(old.plannedDate)}</p>
         {old.note&&<p className="vgp-prewrap">{old.note}</p>}
        </details>;
       })}
      </section>}
     </div>}
    </>}
   </div>
   <footer className="vgp-footer">
    <button className="outline" type="button" disabled={busy} onClick={form?cancelForm:()=>void close()}>{form?'Annuler':'Fermer'}</button>
    {form&&<button className="primary" type="submit" form={formId} disabled={disabled||form==='plan'&&!dirty}>
     {busy?'Enregistrement…':form==='plan'?'Enregistrer le rendez-vous':form==='passage'?'Valider le passage':'Enregistrer la fiche'}
    </button>}
   </footer>
   {confirmation}
  </DialogContent>
 </Dialog>;
}

function Fact({label,value,detail}:{label:string;value:ReactNode;detail?:string}){
 return <div><dt>{label}</dt><dd>{value}</dd>{detail&&<dd className="vgp-fact-subtitle">{detail}</dd>}</div>;
}

function FileLink({file}:{file:VgpFile}){
 return <a className="vgp-file" href={'/api/vgp/files?id='+encodeURIComponent(file.id)} target="_blank" rel="noreferrer">
  <FileText size={17} aria-hidden="true"/><span><strong>{file.name}</strong>
   <small>{file.author} · {new Date(file.created_at).toLocaleDateString('fr-FR')}</small>
  </span><ArrowRight size={15} aria-hidden="true"/>
 </a>;
}

function UploadField({label,disabled,onFile}:{label:string;disabled:boolean;onFile:(file?:File)=>void}){
 return <label className="vgp-upload" data-disabled={disabled}>
  <span><Upload size={15} aria-hidden="true"/> {label}</span><small>PDF · 15 Mo maximum</small>
  <input type="file" accept="application/pdf,.pdf" disabled={disabled} onChange={event=>{
   const file=event.target.files?.[0];event.target.value='';onFile(file);
  }}/>
 </label>;
}

function Passage({passage,recordId,files,focus,focusRef,canEdit,disabled,onResult,onUpload}:{
 passage:VgpPassage;recordId:string;files:VgpFile[];focus:boolean;focusRef:React.RefObject<HTMLDetailsElement|null>;
 canEdit:boolean;disabled:boolean;onResult:(result:string)=>void;onUpload:(file?:File)=>void;
}){
 return <details className="vgp-passage" open={focus||undefined} ref={focus?focusRef:undefined}>
  <summary>
   <span><Clock3 size={16} aria-hidden="true"/><strong>{displayDate(passage.performed_date)}</strong></span>
   <span className="vgp-chip-group"><StatusBadge status={passage.result}/>
    {files.length>0?<StatusBadge status="PDF disponible"/>:!!passage.report_expected&&<StatusBadge status="Rapport attendu"/>}</span>
   <ArrowRight className="vgp-equipment-chevron" size={16} aria-hidden="true"/>
  </summary>
  <div className="vgp-passage-body">
   <dl className="vgp-sheet-specs">
    <Fact label="Échéance du passage" value={displayDate(passage.due)}/>
    <Fact label="Prévu le" value={displayDate(passage.planned_date)}/>
    <Fact label="Saisi par" value={passage.created_by}/>
   </dl>
   {passage.note&&<p className="vgp-prewrap">{passage.note}</p>}
   {canEdit&&passage.result==='En attente du rapport'&&<label className="vgp-result-select">Résultat du contrôle
    <select value="" disabled={disabled} onChange={event=>{if(event.target.value)onResult(event.target.value)}}>
     <option value="">Renseigner le résultat</option>
     {vgpResults.filter(value=>value!=='En attente du rapport').map(value=><option key={value}>{value}</option>)}
    </select>
   </label>}
   {files.map(file=><FileLink key={file.id} file={file}/>)}
   {canEdit&&<div className="vgp-passage-actions">
    <UploadField label="Déposer le rapport" disabled={disabled} onFile={onUpload}/>
    {!disabled&&<a className="outline" href={'/tickets?new=1&vgp='+encodeURIComponent(recordId)+'&passage='+encodeURIComponent(passage.id)}>
     <Ticket size={15} aria-hidden="true"/> Ouvrir un ticket d’écart
    </a>}
   </div>}
  </div>
 </details>;
}

function RecordFields({draft,records,users,patch}:{
 draft:VgpRecord;records:RegisterRow[];users:VgpUser[];patch:<K extends keyof VgpRecord>(key:K,value:VgpRecord[K])=>void;
}){
 const control=draft.kind==='control';
 function text(key:'title'|'domain'|'location'|'reference'|'provider'|'due'|'lastDate'|'plannedDate',label:string,type='text'){
  return <label>{label}<input required={key==='title'} type={type} value={draft[key]} maxLength={key==='title'?300:10000}
   onChange={event=>patch(key,event.target.value)}/></label>;
 }
 return <>
  {text('title','Désignation')}{text('domain','Domaine')}{text('location','Site / localisation')}{text('reference','Référence source')}
  {!control&&([
   ['family','Famille de matériel'],['number','N° équipement'],['reference','Référence APAVE'],
  ] as const).map(([key,label])=><label key={key}>{label}<input maxLength={250} value={draft.equipment?.[key]||''} onChange={event=>
   patch('equipment',{family:'',number:'',reference:'',...draft.equipment,[key]:event.target.value})}/></label>)}
  <label>Pilote du suivi<select value={draft.pilotId} onChange={event=>patch('pilotId',event.target.value)}>
   <option value="">À attribuer</option>
   {draft.pilotId&&!users.some(user=>user.id===draft.pilotId)&&<option value={draft.pilotId}>Pilote actuel</option>}
   {users.map(user=><option value={user.id} key={user.id}>{user.display_name}</option>)}
  </select></label>
  {text('due',control?'Échéance de contrôle':'Échéance de traitement','date')}
  {text('lastDate',control?'Dernière vérification':'Date du relevé','date')}
  {control?<>
   {text('plannedDate','Prévu le','date')}
   <label>Périodicité (mois)<input type="number" min="1" max="240" value={draft.months??''}
    onChange={event=>patch('months',event.target.value?Number(event.target.value):null)}/></label>
   {nextVgpDate(draft.lastDate,draft.months)&&<div className="vgp-wide"><button type="button" className="vgp-text-action"
    onClick={()=>patch('due',nextVgpDate(draft.lastDate,draft.months))}>Calculer l’échéance depuis le dernier contrôle</button></div>}
  </>:<>
   <label>État de l’observation<select value={draft.status} onChange={event=>patch('status',event.target.value)}>
    {vgpStatuses.map(status=><option key={status}>{status}</option>)}
   </select></label>
   <label>Contrôle associé<select value={draft.controlId} onChange={event=>patch('controlId',event.target.value)}>
    <option value="">À rattacher</option>
    {draft.controlId&&!records.some(row=>row.id===draft.controlId)&&<option value={draft.controlId}>Contrôle actuel</option>}
    {records.filter(row=>row.kind==='control').map(row=><option value={row.id} key={row.id}>{row.domain} · {row.title}</option>)}
   </select></label>
  </>}
  {text('provider','Entreprise de vérification')}
  <label>Caractère réglementaire<select value={draft.regulatory} onChange={event=>patch('regulatory',event.target.value)}>
   <option value="">Non renseigné</option><option>Oui</option><option>Non</option>
  </select></label>
  <label className="vgp-wide">{control?'Objet du contrôle':'Constat'}<textarea rows={4} maxLength={10000} value={draft.description} onChange={event=>patch('description',event.target.value)}/></label>
  <label className="vgp-wide">{draft.status==='Levée'?'Justification de la levée':'Notes de suivi'}
   <textarea rows={3} maxLength={10000} value={draft.note} required={draft.status==='Levée'} onChange={event=>patch('note',event.target.value)}/>
  </label>
 </>;
}

'use client';
import {useRef,useState,type FormEvent} from 'react';
import {Camera,Download,FileCheck2,LoaderCircle,Plus,ExternalLink,Save,Trash2} from 'lucide-react';
import {auditConformityChoices,auditQuestionType,auditScore,auditSections,categories,type Routine,type Run,type Row} from '@/lib/hub';
import {serviceHref} from '@/lib/navigation';
import {hubRequest} from '@/lib/hub-request';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import './audit-run-editor.css';

type LinkedAuditTicket={id:string;title:string;status:string;questionId:string};
type TicketDraft={questionId:string;label:string;title:string;description:string;category:string;due:string};
export type AuditEditorState={routine:Row<Routine>;date:string;revision:number;data:Run;tickets?:LinkedAuditTicket[]};
type Props={audit:AuditEditorState;canFill:boolean;canEdit:boolean;busy:boolean;dirty:boolean;team:string;onChange:(data:Run)=>void;onSave:()=>Promise<{data:Run;revision:number}|null>;onSaved:(data:Run,revision:number)=>void;onBusy:(busy:boolean)=>void;onError:(error:string)=>void};
const dateLabel=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'Date non renseignée':new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',dateStyle:'medium',timeStyle:'short'}).format(date)};

export function AuditRunEditor({audit,canFill,canEdit,busy,dirty,team,onChange,onSave,onSaved,onBusy,onError}:Props){
  const [downloading,setDownloading]=useState(false),score=auditScore(audit.data.answers),writable=canFill&&audit.routine.data.active;
  const [ticketDraft,setTicketDraft]=useState<TicketDraft|null>(null);
  const [tickets,setTickets]=useState<LinkedAuditTicket[]>(audit.tickets??[]);
  const [ticketError,setTicketError]=useState(''),[ticketMessage,setTicketMessage]=useState<{questionId:string;text:string}|null>(null),[ticketSaving,setTicketSaving]=useState(false);
  const ticketPoint=useRef<HTMLElement|null>(null);

  function openTicket(answer:Run['answers'][number],point:HTMLElement|null){
   ticketPoint.current=point;
   setTicketError('');setTicketMessage(null);
   setTicketDraft({
    questionId:answer.id,label:answer.label,title:('Écart d’audit · '+answer.label).slice(0,200),
    description:[
     'Audit : '+(audit.data.routineTitle||audit.routine.data.title)+' · '+audit.date.split('-').reverse().join('/'),
     audit.data.location?'Lieu : '+audit.data.location:'',
     'Point non conforme : '+answer.label,
     answer.comment?'Observation : '+answer.comment:'',
    ].filter(Boolean).join('\n'),
    category:'Autre',due:'',
   });
  }
  async function saveTicket(event:FormEvent){
   event.preventDefault();
   if(!ticketDraft||ticketSaving||busy)return;
   setTicketSaving(true);setTicketError('');
   try{
    let revision=audit.revision;
    if(dirty||!revision){
     const saved=await onSave();
     if(!saved)throw Error('Le compte rendu n’a pas été enregistré. Fermez cette fenêtre pour voir le détail.');
     revision=saved.revision;
    }
    onBusy(true);
    const {questionId,title,description,category,due}=ticketDraft;
    const result=await hubRequest('/api/hub',{action:'audit-ticket',routineId:audit.routine.id,date:audit.date,runRevision:revision,questionId,title,description,category,due});
    setTickets(current=>[...current.filter(ticket=>ticket.questionId!==questionId),result]);
    setTicketMessage({questionId,text:result.created?'Ticket créé. Vous pouvez poursuivre l’audit.':'Le ticket déjà lié est disponible.'});
    setTicketDraft(null);
   }catch(error){setTicketError((error as Error).message)}
   finally{setTicketSaving(false);onBusy(false)}
  }

  const fileUrl=(id:string)=>'/api/routine-files?routine='+encodeURIComponent(audit.routine.id)+'&date='+audit.date+'&id='+encodeURIComponent(id)+'&team='+encodeURIComponent(team);
  async function upload(questionId:string,file:File,caption:string){
    onError('');try{
      let saved={data:audit.data,revision:audit.revision};if(dirty||!audit.revision){const result=await onSave();if(!result)return false;saved=result}
      onBusy(true);
      const image=await compressPhoto(file),form=new FormData();form.set('file',image,file.name);form.set('revision',String(saved.revision));form.set('questionId',questionId);form.set('caption',caption);
      const response=await fetch('/api/routine-files?routine='+encodeURIComponent(audit.routine.id)+'&date='+audit.date,{method:'POST',body:form,credentials:'same-origin'});const result=await response.json() as {error?:string;data:Run;revision:number};if(!response.ok)throw Error(result.error||'Ajout de la photo impossible.');onSaved(result.data,result.revision);return true;
    }catch(e){onError((e as Error).message);return false}finally{onBusy(false)}
  }
  async function remove(id:string){onError('');try{let saved={data:audit.data,revision:audit.revision};if(dirty){const result=await onSave();if(!result)return;saved=result}onBusy(true);const response=await fetch('/api/routine-files?routine='+encodeURIComponent(audit.routine.id)+'&date='+audit.date,{method:'DELETE',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,revision:saved.revision})});const result=await response.json() as {error?:string;data:Run;revision:number};if(!response.ok)throw Error(result.error||'Retrait impossible.');onSaved(result.data,result.revision)}catch(e){onError((e as Error).message)}finally{onBusy(false)}}
  async function download(){onError('');setDownloading(true);onBusy(true);try{const response=await fetch('/api/routines/report?routine='+encodeURIComponent(audit.routine.id)+'&date='+audit.date+'&revision='+audit.revision+'&team='+encodeURIComponent(team),{credentials:'same-origin',cache:'no-store'});if(!response.ok){const result=await response.json() as {error?:string;data:Run;revision:number};throw Error(result.error||'Téléchargement impossible.')}const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='audit-'+audit.date+'-v'+audit.revision+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000)}catch(e){onError((e as Error).message)}finally{setDownloading(false);onBusy(false)}}
  function changeAnswer(id:string,patch:Partial<Run['answers'][number]>){onChange({...audit.data,completed:false,answers:audit.data.answers.map(a=>a.id===id?{...a,...patch}:a)})}
  const photos=(id:string)=><AuditPhotos photos={(audit.data.photos||[]).filter(p=>p.questionId===id)} disabled={busy||!writable||audit.data.completed} url={fileUrl} onUpload={(file,caption)=>upload(id,file,caption)} onRemove={remove}/>;
  return <div className="audit-run">
    <section className="audit-summary" aria-label="Résultats de l’audit">
      <div className="audit-score" style={{'--audit-score':(score.percent||0)*3.6+'deg'} as React.CSSProperties}><strong>{score.percent===null?'—':score.percent+' %'}</strong></div>
      <div><span className="audit-eyebrow">{audit.data.completed?'Compte rendu terminé':audit.revision?'Compte rendu en cours':'Audit à démarrer'}</span><h3>Résultats de l’audit</h3><p>{score.conform} conforme(s) · {score.nonconform} non conforme(s) · {score.na} N/A · {score.requiredPending} obligatoire(s) à compléter{score.information>0&&<> · {score.information} champ(s) de contexte</>}</p></div>
    </section>
    <p className="audit-score-rule">Score calculé sur les points évalués applicables. Les N/A et les champs de contexte sont exclus du score. Les réponses et preuves obligatoires sont vérifiées avant de terminer.</p>
    <div className="audit-report-toolbar"><button className="outline" type="button" disabled={busy||dirty||!audit.revision} onClick={download}>{downloading?<LoaderCircle size={16}/>:<Download size={16}/>} Télécharger le PDF</button><small>{dirty?'Enregistrez vos modifications pour actualiser le PDF.':audit.revision?'PDF généré à partir de la version '+audit.revision:'Démarrez l’audit pour enregistrer son heure de début.'}</small></div>
    {audit.data.startedAt&&<p className="audit-timing">Début : {dateLabel(audit.data.startedAt)} · {audit.data.startedBy}{audit.data.completedAt&&<> · Fin : {dateLabel(audit.data.completedAt)}</>}</p>}
    <fieldset className="hub-fields" disabled={busy||!writable}>
      <div className="hub-form-grid"><label>Lieu / bâtiment / atelier<input maxLength={200} value={audit.data.location||''} onChange={e=>onChange({...audit.data,location:e.target.value,completed:false})} placeholder="Ex. Production · bâtiment A"/></label><label>Personnes auditées<input maxLength={200} value={audit.data.auditee||''} onChange={e=>onChange({...audit.data,auditee:e.target.value,completed:false})} placeholder="Nom, fonction ou équipe"/></label></div>
    </fieldset>
    {!audit.revision&&writable&&<button type="button" className="primary" disabled={busy} onClick={onSave}><FileCheck2 size={17}/>Démarrer l’audit</button>}
    <p className="hub-prewrap">{audit.data.routineDescription??audit.routine.data.description}</p>
    {auditSections(audit.data.answers).map(section=><section className="audit-theme" key={section.title}><header><h3>{section.title}</h3><span>{section.score.percent===null?'N/A':section.score.percent+' %'} · {section.score.conform}/{section.score.applicable}</span></header>{section.answers.map(answer=>{const type=auditQuestionType(answer);return <article className="audit-point" tabIndex={-1} key={answer.id} data-result={answer.result}><fieldset disabled={busy||!writable}><label className="audit-point-label"><strong>{answer.label}{answer.required!==false?' *':' (facultatif)'}</strong>{type==='conformity'&&<select aria-label={'Résultat : '+answer.label} value={answer.result} onChange={e=>changeAnswer(answer.id,{result:e.target.value})}><option value="À faire" disabled={audit.routine.data.binaryConformity}>{audit.routine.data.binaryConformity?'Choisir un résultat':'À faire'}</option>{auditConformityChoices(audit.routine.data.binaryConformity).map(v=><option key={v}>{v}</option>)}</select>}</label>{answer.help&&<p className="audit-answer-help">{answer.help}</p>}{type==='text'&&<textarea aria-label={'Réponse : '+answer.label} placeholder="Votre réponse…" rows={3} maxLength={3000} value={answer.value||''} onChange={e=>changeAnswer(answer.id,{value:e.target.value})}/>} {['number','date'].includes(type)&&<input className="audit-answer-value" aria-label={'Réponse : '+answer.label} type={type==='number'?'number':'date'} step={type==='number'?'any':undefined} value={answer.value||''} onChange={e=>changeAnswer(answer.id,{value:e.target.value})}/>}<textarea aria-label={'Observation : '+answer.label} placeholder={type==='conformity'?'Décrivez votre observation…':'Observation complémentaire (facultatif)'} rows={2} maxLength={3000} value={answer.comment} onChange={e=>changeAnswer(answer.id,{comment:e.target.value})}/>{answer.result==='Non conforme'&&answer.evidence&&answer.evidence!=='none'&&<small className="audit-evidence-hint">Pour terminer : {answer.evidence==='both'?'une observation et une photo sont obligatoires':answer.evidence==='photo'?'une photo est obligatoire':'une observation est obligatoire'} pour ce point.</small>}</fieldset>{answer.author&&answer.updatedAt&&<small className="audit-observation-author">{answer.author} · {dateLabel(answer.updatedAt)}</small>}{photos(answer.id)}
    {tickets.filter(ticket=>ticket.questionId===answer.id).map(ticket=><a key={ticket.id} className="outline audit-ticket-link" target="_blank" rel="noopener noreferrer" href={serviceHref('/tickets?id='+encodeURIComponent(ticket.id),team)}><ExternalLink size={16}/>Ticket lié · {ticket.status}<span className="sr-only"> (nouvel onglet)</span></a>)}
    {answer.result==='Non conforme'&&canEdit&&writable&&!tickets.some(ticket=>ticket.questionId===answer.id)&&
     <button className="outline audit-ticket-link" type="button" disabled={busy} onClick={event=>openTicket(answer,event.currentTarget.closest('.audit-point'))}><Plus size={16}/>Créer un ticket</button>}
    {ticketMessage?.questionId===answer.id&&<p role="status" className="success">{ticketMessage.text}</p>}
    </article>})}</section>)}
    <fieldset className="hub-fields" disabled={busy||!writable}><label>Synthèse et autres observations<textarea rows={4} maxLength={10000} value={audit.data.notes} onChange={e=>onChange({...audit.data,notes:e.target.value,completed:false})}/></label></fieldset>
    <section className="audit-general-photos"><h3>Photos générales</h3>{photos('')}</section>
    {!audit.routine.data.active&&<p>Routine suspendue : ce compte rendu est conservé en lecture seule.</p>}
    {writable&&<div className="audit-save-area"><label className="hub-check"><input disabled={busy} type="checkbox" checked={audit.data.completed} onChange={e=>onChange({...audit.data,completed:e.target.checked})}/> Audit terminé</label><small>{score.requiredPending?`${score.requiredPending} réponse(s) obligatoire(s) à compléter.`:'Réponses obligatoires renseignées. Les preuves requises seront vérifiées à l’enregistrement.'}</small><button className="primary" type="button" disabled={busy} onClick={onSave}><Save size={16}/>{busy?'Enregistrement…':'Enregistrer le compte rendu'}</button></div>}
    <Dialog open={!!ticketDraft} onOpenChange={open=>{if(!open&&!ticketSaving)setTicketDraft(null)}}>
     <DialogContent className="hub-form-dialog audit-inline-ticket" showCloseButton={!ticketSaving}
      onCloseAutoFocus={event=>{if(ticketPoint.current){event.preventDefault();ticketPoint.current.focus({preventScroll:true})}}}>
      <DialogTitle>Créer un ticket pour cet écart</DialogTitle>
      <DialogDescription>{ticketDraft?.label}. La saisie reprend sur ce point après création du ticket.</DialogDescription>
      {ticketDraft&&<form onSubmit={saveTicket}>
       <fieldset className="hub-fields" disabled={ticketSaving}>
        <label>Titre<input required maxLength={200} value={ticketDraft.title} onChange={event=>setTicketDraft({...ticketDraft,title:event.target.value})}/></label>
        <label>Description<textarea rows={6} maxLength={10000} value={ticketDraft.description} onChange={event=>setTicketDraft({...ticketDraft,description:event.target.value})}/></label>
        <div className="hub-form-grid">
         <label>Catégorie<select value={ticketDraft.category} onChange={event=>setTicketDraft({...ticketDraft,category:event.target.value})}>{categories.map(category=><option key={category}>{category}</option>)}</select></label>
         <label>Échéance (facultative)<input type="date" value={ticketDraft.due} onChange={event=>setTicketDraft({...ticketDraft,due:event.target.value})}/></label>
        </div>
       </fieldset>
       {ticketError&&<p role="alert" className="error">{ticketError}</p>}
       <div className="audit-routine-actions"><button type="button" className="outline" disabled={ticketSaving} onClick={()=>setTicketDraft(null)}>Annuler</button>
        <button type="submit" className="primary" disabled={ticketSaving||!ticketDraft.title.trim()}>{ticketSaving?'Création…':'Créer et reprendre l’audit'}</button></div>
      </form>}
     </DialogContent>
    </Dialog>
  </div>;
}

function AuditPhotos({photos,disabled,url,onUpload,onRemove}:{photos:NonNullable<Run['photos']>;disabled:boolean;url:(id:string)=>string;onUpload:(file:File,caption:string)=>Promise<boolean>;onRemove:(id:string)=>void}){const [adding,setAdding]=useState(false),[caption,setCaption]=useState('');return <div className="audit-photos"><div className="audit-photo-grid">{photos.map(p=><figure key={p.id}><a href={url(p.id)} target="_blank" rel="noreferrer"><img src={url(p.id)} alt={p.caption||p.name} loading="lazy"/></a><figcaption>{p.caption||p.name}<small>{p.author} · {dateLabel(p.createdAt)}</small></figcaption>{!disabled&&<button type="button" aria-label={'Retirer la photo '+(p.caption||p.name)} onClick={()=>onRemove(p.id)}><Trash2 size={14}/></button>}</figure>)}</div>{!disabled&&(adding?<div className="audit-photo-add"><label>Légende de la photo<input maxLength={500} value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Décrire le constat ou la preuve"/></label><label className="outline audit-photo-file"><Camera size={16}/>Choisir une photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(file&&await onUpload(file,caption)){setAdding(false);setCaption('')}}}/></label><button type="button" className="outline" onClick={()=>setAdding(false)}>Annuler</button></div>:<button type="button" className="audit-add-photo" onClick={()=>setAdding(true)}><Camera size={15}/>Ajouter une photo</button>)}</div>}

async function compressPhoto(file:File):Promise<Blob>{
  if(file.size>20*1024*1024)throw Error('Choisissez une image de moins de 20 Mo.');
  const bitmap=await createImageBitmap(file);try{const factor=Math.min(1,1800/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));const context=canvas.getContext('2d');if(!context)throw Error('Préparation de la photo indisponible.');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob&&blob.size<=2*1024*1024?resolve(blob):reject(Error('Photo trop volumineuse après compression.')),'image/jpeg',0.82))}finally{bitmap.close()}
}

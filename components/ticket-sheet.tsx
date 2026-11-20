'use client';

import {useRef,useState,type ReactNode} from 'react';
import {Archive,ArchiveRestore,AlignLeft,CalendarDays,Check,CircleCheck,MessageSquare,Paperclip,Plus,Send,ShieldCheck,Users,X} from 'lucide-react';
import type {Account} from '@/components/account-gate';
import type {Meta} from '@/components/hub-layout';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {PersonAvatar} from '@/components/person-avatar';
import {TicketAnalysisMenu,TicketAnalysisFields} from '@/components/ticket-analysis';
import {useConfirmation} from '@/components/use-confirmation';
import {TicketLabelFields} from '@/components/ticket-label-fields';
import {TicketPilotPicker,TicketSearchPicker} from '@/components/ticket-search-picker';
import {TicketVisualSelect} from '@/components/ticket-visuals';
import {categories,ticketStatuses,type Row,type Ticket} from '@/lib/hub';
import '@/app/tickets/tickets.css';
import '@/app/tickets/ticket-colors.css';
import '@/app/tickets/ticket-sheet.css';

type TicketComment={id:string;author_id:string;author:string;created_at:string;body:string};
type TicketFile={id:string;name:string;mime:string;size:number;author:string};
type TicketSheetProps={
 edit:Row<Ticket>|null;
 account:Pick<Account,'id'|'displayName'>;
 meta:Meta;
 canEdit:boolean;
 canContribute:boolean;
 dirty:boolean;
 busy:boolean;
 patch:(value:Partial<Ticket>)=>void;
 close:()=>void;
 save:()=>void;
 saveLabel?:string;
 initialActionId?:string;
 modalError?:string;
 modalNotice?:string;
 uploading?:boolean;
 comments?:TicketComment[];
 files?:TicketFile[];
 comment?:string;
 notifyComment?:boolean;
 recipientIds?:string[];
 archiveTicket?:()=>void;
 upload?:(file:File|undefined)=>void;
 setComment?:(value:string)=>void;
 setNotifyComment?:(value:boolean)=>void;
 sendComment?:()=>void;
 notify?:()=>void;
 onCloseAutoFocus?:(event:Event)=>void;
 children?:ReactNode;
};

export function TicketSheet({
 edit,account,meta,canEdit,canContribute,dirty,busy,patch,close,save,
 saveLabel='Enregistrer le ticket',initialActionId='',modalError='',modalNotice='',uploading=false,
 comments=[],files=[],comment='',notifyComment=true,recipientIds=[],
 archiveTicket,upload,setComment,setNotifyComment,sendComment,notify,onCloseAutoFocus,children,
}:TicketSheetProps){
 const [showAnalysisRequest,setShowAnalysisRequest]=useState(0);
 const actionPlanRef=useRef<HTMLFieldSetElement>(null);
 const {askConfirm,confirmation:analysisConfirmation}=useConfirmation();
 async function removeAnalysis(){
  if(!edit?.data.analysis||busy||uploading)return;
  if(await askConfirm('Les réponses de cette analyse seront retirées à l’enregistrement du ticket.',{title:'Retirer la méthode d’analyse ?',confirmLabel:'Retirer l’analyse'})){
   patch({analysis:undefined});
   setShowAnalysisRequest(0);
  }
 }
 function removeAction(id:string){
  if(!edit)return;
  const {analysis,actions}=edit.data;
  const causes=analysis?.causes;
  const nextActions=actions.filter(action=>action.id!==id);
  if(analysis&&causes?.some(cause=>cause.actionId===id)){
   patch({actions:nextActions,analysis:{...analysis,causes:causes.map(cause=>cause.actionId===id?{...cause,actionId:undefined}:cause)}});
  }else patch({actions:nextActions});
 }
 function closeSheet(){
  setShowAnalysisRequest(0);
  close();
 }
 function viewAction(id:string){
  const row=actionPlanRef.current?.querySelector<HTMLDivElement>('[data-ticket-action-id="'+CSS.escape(id)+'"]');
  if(!row)return false;
  const step=row.closest('details');
  if(step)step.open=true;
  row.scrollIntoView({block:'nearest'});
  row.focus({preventScroll:true});
  return true;
 }
 const vgpLink=edit?.data.description.match(/^Passage et rapport : (\/vgp\?id=[a-z0-9-]+&passage=[a-z0-9-]+)$/im)?.[1];
 const vgpRecordLink=edit?.data.description.match(/^(?:Fiche VGP : |Suivi VGP )(\/vgp\?id=[a-z0-9-]+)$/im)?.[1];
 const formLocked=!canContribute||!!edit?.data.archivedAt||!!edit?.data.gmaoOrderId&&edit.data.status==='Clôturé'||busy||uploading;
 const coreReadOnly=!canEdit||!!edit?.data.archivedAt||!!edit?.data.gmaoOrderId;
 const coreLocked=coreReadOnly||busy||uploading;
 const people=meta.users.map(user=>({id:user.id,name:user.display_name}));
 // A creator name in legacy records is not enough to identify a homonym.
 const authorId=(label?:string)=>{const matches=meta.users.filter(user=>user.display_name===label);return matches.length===1?matches[0].id:undefined};
 const actionPlan=edit&&<fieldset ref={actionPlanRef} className="ticket-actions-section ticket-sheet-actions" disabled={formLocked}>
            <div className="hub-section-heading"><h3><CircleCheck size={17}/> Actions <span className="ticket-count">{edit.data.actions.filter(a=>a.done).length}/{edit.data.actions.length}</span></h3>{canEdit&&<button className="ticket-add-action" disabled={edit.data.actions.length>=100} onClick={()=>patch({actions:[...edit.data.actions,{id:crypto.randomUUID(),title:'',done:false,pilot:'',due:''}]})}><Plus size={14}/> Ajouter une action</button>}</div>
            {edit.data.actions.length>0&&<div className="ticket-action-column-labels" aria-hidden="true"><span>Action à réaliser</span><span>Pilote</span><span>Délai</span></div>}
            {!edit.data.actions.length&&<p className="ticket-action-empty">Ajoutez les étapes à réaliser pour résoudre ce ticket.</p>}
            <div className="ticket-action-table">{edit.data.actions.map((a,i)=><div className={'ticket-action-row '+(a.done?'ticket-action-done':'')} key={a.id}
              data-ticket-action-id={a.id} tabIndex={-1}>
              <span className="ticket-action-number" aria-hidden="true">{i+1}</span>
              <label className="ticket-action-toggle"><input className="sr-only" type="checkbox" aria-label={'Action '+(i+1)+' réalisée'} checked={a.done} onChange={e=>patch({actions:edit.data.actions.map(x=>x.id===a.id?{...x,done:e.target.checked}:x)})}/><span aria-hidden="true"><Check size={15}/></span></label>
              <input disabled={!canEdit} className="ticket-action-title" aria-label={'Action '+(i+1)} placeholder="Action à réaliser" maxLength={500} value={a.title} onChange={e=>patch({actions:edit.data.actions.map(x=>x.id===a.id?{...x,title:e.target.value}:x)})}/>
              <TicketPilotPicker className="ticket-action-owner" label={'Pilote de l’action '+(i+1)} options={people} value={a.pilot} onChange={pilot=>patch({actions:edit.data.actions.map(x=>x.id===a.id?{...x,pilot}:x)})} disabled={formLocked||!canEdit}/>
              <input disabled={!canEdit} className="ticket-action-date" aria-label={'Délai de l’action '+(i+1)} type="date" value={a.due} onChange={e=>patch({actions:edit.data.actions.map(x=>x.id===a.id?{...x,due:e.target.value}:x)})}/>
              {canEdit&&<button className="ticket-action-remove" aria-label={'Retirer l’action '+(i+1)} title="Retirer l’action" onClick={()=>removeAction(a.id)}><X size={14}/></button>}
            </div>)}</div>
          </fieldset>;
 return <Dialog open={!!edit} onOpenChange={v=>{if(!v)closeSheet()}}>
  <DialogContent className="hub-ticket-dialog ticket-reference-sheet" showCloseButton={false} onCloseAutoFocus={onCloseAutoFocus}
   onOpenAutoFocus={event=>{if(initialActionId&&viewAction(initialActionId))event.preventDefault()}}>
    <DialogTitle className="sr-only">{edit?.data.title||'Nouveau ticket'}</DialogTitle>
    <DialogDescription className="sr-only">Signalement, attribution, plan d’actions et activité du ticket.</DialogDescription>
    {edit&&<>
      <header className="ticket-sheet-toolbar">
        <fieldset className="ticket-meta-fields" disabled={coreLocked}>
          <div className="ticket-meta-creator" aria-label="Créateur du ticket"><PersonAvatar id={!edit.id?account.id:authorId(edit.author)} name={edit.author||(!edit.id?account.displayName:'?')}/><span><small>Créateur</small><strong data-no-translate>{edit.author||(!edit.id?account.displayName:'Créateur non renseigné')}</strong></span></div>
          <div className="ticket-meta-pilot"><span className="ticket-meta-label">Pilote</span><TicketPilotPicker label="Pilote du ticket" options={people} value={edit.data.pilot} onChange={pilot=>patch({pilot})} disabled={coreLocked}/></div>
          <label className="ticket-meta-due"><CalendarDays size={16}/><span className="sr-only">Échéance du ticket</span><input aria-label="Échéance du ticket" type="date" value={edit.data.due} onChange={e=>patch({due:e.target.value})}/></label>
          <TicketVisualSelect label="Catégorie du ticket" value={edit.data.category} onChange={category=>patch(category===edit.data.category?{category}:{category,topicTags:[]})} options={categories.map(c=>({id:c,name:c}))} disabled={coreLocked}/>
          <label className="ticket-meta-status" data-status={edit.data.status}><CircleCheck size={16}/><span className="sr-only">Statut du ticket</span><select aria-label="Statut du ticket" value={edit.data.status} onChange={e=>patch({status:e.target.value})}>{ticketStatuses.map(s=><option key={s} disabled={s==='Clôturé'&&(!edit.data.pilot||edit.data.actions.some(a=>!a.done))}>{s}</option>)}</select></label>
        </fieldset>
        <div className="ticket-sheet-tools"><span className="ticket-sheet-id">{edit.id?'#'+edit.id.slice(0,8):'Nouveau ticket'}</span>{canEdit&&edit.id&&<button className="ticket-toolbar-button" title={edit.data.archivedAt?'Restaurer ce ticket':edit.data.status!=='Clôturé'?'Clôturez le ticket avant de l’archiver.':dirty||comment?'Enregistrez vos modifications et publiez ou effacez le commentaire avant d’archiver.':'Archiver le ticket et conserver son historique'} disabled={dirty||busy||uploading||!!comment||!edit.data.archivedAt&&edit.data.status!=='Clôturé'} onClick={archiveTicket}>{edit.data.archivedAt?<><ArchiveRestore size={15}/> Restaurer</>:<><Archive size={15}/> Archiver</>}</button>}{!coreReadOnly&&<TicketAnalysisMenu analysis={edit.data.analysis} disabled={coreLocked}
         onChange={analysis=>{patch({analysis});setShowAnalysisRequest(request=>request+1)}} onRemove={()=>void removeAnalysis()} onShow={()=>setShowAnalysisRequest(request=>request+1)}/>}</div><button type="button" className="ticket-sheet-close" aria-label="Fermer le ticket" disabled={busy||uploading} onClick={closeSheet}><X size={17}/></button>
      </header>
      <div className="ticket-sheet-scroll" tabIndex={0} aria-label="Contenu du ticket"><div className="hub-modal-messages">{modalError&&<p className="error" role="alert">{modalError}</p>}{modalNotice&&<p className="success" role="status">{modalNotice}</p>}</div>
      {edit.data.archivedAt&&<p className="ticket-archive-banner"><Archive size={17}/> Archivé le {new Date(edit.data.archivedAt).toLocaleString('fr-FR')} par {edit.data.archivedBy}. Restaurez le ticket pour reprendre les échanges ou le modifier.</p>}
      <div className="hub-ticket-columns">
        <div className="hub-ticket-form ticket-sheet-content">
          <fieldset className="ticket-sheet-core" disabled={coreLocked}>
            <div className="ticket-sheet-title">{coreReadOnly?<h2 className="ticket-sheet-title-text" data-no-translate>{edit.data.title}</h2>:<label><span className="sr-only">Titre du ticket</span><textarea aria-label="Titre du ticket" placeholder="Quel problème souhaitez-vous signaler ?" rows={2} maxLength={200} value={edit.data.title} onChange={e=>patch({title:e.target.value})}/></label>}</div>

            <section className="ticket-sheet-description">{coreReadOnly?<><h3 className="ticket-sheet-label"><AlignLeft size={14}/> Description</h3><p className="ticket-description-text" data-no-translate>{edit.data.description||'Aucune description renseignée.'}</p></>:<label><span className="ticket-sheet-label"><AlignLeft size={14}/> Description</span><textarea rows={6} placeholder="Décrivez le constat, le lieu et les informations utiles…" maxLength={10000} value={edit.data.description} onChange={e=>patch({description:e.target.value})}/></label>}</section>
            <TicketLabelFields ticket={edit.data} onChange={patch} disabled={coreLocked}/>
            <div className="ticket-sheet-services"><Users size={16} aria-hidden="true"/><TicketSearchPicker compact label="Services concernés" options={meta.teams.filter(t=>coreLocked||!meta.editableTeams||meta.editableTeams.includes(t.id))} value={edit.data.teams} onChange={teams=>patch({teams})} disabled={coreLocked}/></div>
          </fieldset>
          <details className="ticket-responsibles"><summary><Users size={14}/> Responsables à notifier <span>{edit.data.responsibles.length}</span></summary><TicketSearchPicker compact kind="person" label="Autres responsables à notifier" options={people} value={edit.data.responsibles} onChange={responsibles=>patch({responsibles})} disabled={coreLocked}/></details>
          <div className="ticket-sheet-links">
            {vgpRecordLink&&<a href={vgpRecordLink}>Ouvrir la fiche VGP →</a>}
            {vgpLink&&<a href={vgpLink}>Ouvrir le passage VGP et son rapport →</a>}
            {edit.data.qualityActionId&&<a href={'/plan-actions?id='+encodeURIComponent(edit.data.qualityActionId)}>Voir la cotation et l’efficacité dans le plan d’actions →</a>}
            {edit.data.gmaoOrderId&&<p><a href={'/maintenance?order='+encodeURIComponent(edit.data.gmaoOrderId)}>Ouvrir l’intervention GMAO →</a><small>Le traitement et l’état se pilotent depuis Maintenance.</small></p>}
            {edit.id&&!edit.data.gmaoOrderId&&!edit.data.qualityActionId&&!edit.data.archivedAt&&edit.data.status!=='Clôturé'&&canEdit&&meta.editableTeams?.includes('maintenance')&&<a href={'/maintenance?ticket='+encodeURIComponent(edit.id)}>Transformer en demande d’intervention →</a>}
            {edit.data.source&&<a href={'/routines?routine='+edit.data.source.routineId+'&date='+edit.data.source.date}>Voir l’audit à l’origine du ticket →</a>}
          </div>
          {edit.data.analysis&&<TicketAnalysisFields analysis={edit.data.analysis} problem={edit.data.title} description={edit.data.description} actions={edit.data.actions} actionPlan={actionPlan} people={people} onViewAction={viewAction}
           disabled={busy||uploading} readOnly={coreReadOnly} showRequest={showAnalysisRequest}
           onChange={(analysis,action)=>patch(action?{analysis,actions:[...edit.data.actions,action]}:{analysis})}/>}
          {edit.data.analysis?.method!=='8d'&&actionPlan}
          {!edit.data.gmaoOrderId&&edit.data.status!=='Clôturé'&&!edit.data.archivedAt&&(!edit.data.pilot||edit.data.actions.some(a=>!a.done))&&<p className="ticket-closure-hint"><ShieldCheck size={15}/> Pour clôturer : {!edit.data.pilot?'désigner un pilote':''}{!edit.data.pilot&&edit.data.actions.some(a=>!a.done)?' et ':''}{edit.data.actions.some(a=>!a.done)?'terminer les actions restantes':''}.</p>}
          <section className="hub-attachments ticket-sheet-attachments"><h3><Paperclip size={16}/> Pièces jointes <span className="ticket-count">{files.length}</span></h3>{!edit.id?<p>Enregistrez le ticket pour joindre des documents.</p>:<>{canContribute&&!edit.data.archivedAt&&<label className="hub-file-input">{uploading?'Ajout en cours…':'Joindre une photo ou un document'}<input type="file" disabled={busy||uploading||dirty} accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.docx,.xlsx" onChange={e=>{const f=e.target.files?.[0];e.target.value='';upload?.(f)}}/></label>}<small>15 Mo par fichier · 20 fichiers maximum. {dirty?'Enregistrez vos modifications avant l’ajout.':''}</small><div className="hub-file-list">{files.map(f=><a key={f.id} href={'/api/ticket-files?id='+f.id}>{['image/jpeg','image/png','image/gif','image/webp'].includes(f.mime)&&<img src={'/api/ticket-files?id='+f.id+'&preview=1'} alt={f.name}/>}<span>{f.name}<small>{(f.size/1024).toLocaleString('fr-FR',{maximumFractionDigits:0})} Ko · {f.author}</small></span></a>)}</div></>}</section>
        </div>
        <aside className="hub-comments ticket-activity-rail">
          <h3><MessageSquare size={16}/> Activité <span className="ticket-count">{comments.length}</span></h3>
          <div className="ticket-activity-feed">
            {edit.author&&edit.created_at&&<p className="ticket-created-event"><PersonAvatar id={authorId(edit.author)} name={edit.author}/><span><strong data-no-translate>{edit.author}</strong> a ouvert ce ticket<time>{new Date(edit.created_at).toLocaleString('fr-FR')}</time></span></p>}
            {comments.map(c=><article key={c.id}><header><PersonAvatar id={c.author_id} name={c.author}/><div><strong data-no-translate>{c.author}</strong><time>{new Date(c.created_at).toLocaleString('fr-FR')}</time></div></header><p data-no-translate>{c.body}</p></article>)}
            {!comments.length&&<div className="ticket-comments-empty"><MessageSquare size={24}/><strong>Aucun échange pour le moment</strong><p>Les commentaires de l’équipe apparaîtront ici.</p></div>}
          </div>
          {canContribute&&!edit.data.archivedAt&&<div className="ticket-comment-composer"><textarea aria-label="Nouveau commentaire" placeholder={edit.id?'Ajouter un commentaire…':'Enregistrez d’abord le ticket.'} disabled={!edit.id||busy||uploading} rows={3} maxLength={10000} value={comment} onChange={e=>setComment?.(e.target.value)}/><label className="hub-check"><input type="checkbox" checked={notifyComment} onChange={e=>setNotifyComment?.(e.target.checked)}/> Notifier les pilotes et les responsables</label><button className="primary" disabled={!edit.id||busy||uploading||!comment.trim()||dirty} onClick={sendComment}><Send size={15}/> Publier</button>{dirty&&<small>Enregistrez le ticket avant de publier le commentaire.</small>}</div>}
        </aside>
      </div>
      <footer className="ticket-sheet-footer"><button type="button" className="outline" disabled={busy||uploading} onClick={closeSheet}>Fermer</button><span className={dirty?'ticket-save-state is-dirty':'ticket-save-state'}>{dirty?'Modifications non enregistrées':!edit.id?'Nouveau ticket · à enregistrer':'Enregistré · version '+edit.revision}</span>{canContribute&&!edit.data.archivedAt&&<><button className="outline" disabled={!edit.id||dirty||busy||uploading||!recipientIds.length} onClick={notify}>Notifier les responsables</button><button className="primary" disabled={busy||uploading||!!edit.id&&!dirty} onClick={save}>{busy?'Enregistrement…':saveLabel}</button></>}</footer>
      </div>
    </>}
    {analysisConfirmation}
    {children}
  </DialogContent>
 </Dialog>;
}

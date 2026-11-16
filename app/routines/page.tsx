'use client';
import {AuditBuilder} from '@/components/audit-builder';
import {AuditRunEditor,type AuditEditorState} from '@/components/audit-run-editor';
import {useConfirmation} from '@/components/use-confirmation';
import {useEffect,useState} from 'react';
import {serviceHref} from '@/lib/navigation';
import {AccountGate,type Account} from '@/components/account-gate';
import {HubFrame,hubRequest,useHubMeta,useServiceFilter} from '@/components/hub-layout';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {auditQuestionType,auditCompletionError,scheduledAuditDates,routineError,validDate,todayParis,type Routine,type Row,type Run} from '@/lib/hub';
import {MoreHorizontal,Trash2,ListChecks,Play,Search,Plus,ChevronLeft,ChevronRight,ClipboardCheck,CalendarDays,CheckCircle2,Clock3} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {ListPagination,useListPage} from '@/components/list-pagination';
const frenchDate=(date:string)=>!validDate(date)?'Date à préciser':new Intl.DateTimeFormat('fr-FR',{dateStyle:'medium',timeZone:'Europe/Paris'}).format(new Date(date+'T12:00:00Z'));
const labelRepeat={none:'Ponctuelle',daily:'Tous les jours',weekly:'Toutes les semaines',monthly:'Tous les mois'};
export default function Page(){return <AccountGate>{account=><Routines account={account}/>}</AccountGate>}
function Routines({account}:{account:Account}){
const [view,setView]=useState<'list'|'calendar'>('list'),[search,setSearch]=useState('');
const [schedule,setSchedule]=useState<{routine:Row<Routine>;date:string;time:string}|null>(null);
const [scheduleError,setScheduleError]=useState('');
const [deleteTarget,setDeleteTarget]=useState<Row<Routine>|null>(null);
const [deleteText,setDeleteText]=useState(''),[deleteError,setDeleteError]=useState('');
const {askConfirm,confirmation}=useConfirmation();const [team,setTeam]=useServiceFilter();const {meta,error:metaError}=useHubMeta(),[month,setMonth]=useState(todayParis().slice(0,7)),[rows,setRows]=useState<Row<Routine>[]>([]),[runs,setRuns]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[edit,setEdit]=useState<Row<Routine>|null>(null),[baseline,setBaseline]=useState(''),[runEdit,setRunEdit]=useState<AuditEditorState|null>(null),[runBaseline,setRunBaseline]=useState(''),[modalError,setModalError]=useState(''),[notice,setNotice]=useState('');const canFill=account.role!=='reader'&&(account.role==='admin'||!!runEdit&&runEdit.routine.data.teams.length>0&&runEdit.routine.data.teams.every(t=>meta.contributingTeams?.includes(t))),canEdit=account.role!=='reader'&&(account.role==='admin'||(team?!!meta.editableTeams?.includes(team):!!meta.editableTeams?.length)),from=month+'-01',to=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10),dirty=edit?JSON.stringify(edit.data)!==baseline:runEdit?JSON.stringify(runEdit.data)!==runBaseline:false;
async function load(){setLoading(true);try{const d=await hubRequest('/api/hub?scope=routines&from='+from+'&to='+to+'&team='+encodeURIComponent(team));setRows(d.routines);setRuns(d.runs);setError('')}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
useEffect(()=>{let live=true;setLoading(true);hubRequest('/api/hub?scope=routines&from='+from+'&to='+to+'&team='+encodeURIComponent(team)).then(d=>{if(live){setRows(d.routines);setRuns(d.runs);setError('')}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[month,team]);
useEffect(()=>{const q=new URLSearchParams(location.search),date=q.get('date');if(q.get('routine')&&date&&/^\d{4}-\d{2}-\d{2}$/.test(date)){setMonth(date.slice(0,7));openRun(q.get('routine')!,date)}},[]);
useEffect(()=>{if(!dirty)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty]);
function shift(n:number){const d=new Date(from+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+n);setMonth(d.toISOString().slice(0,7))}
async function close(){if(busy)return;if(dirty&&!await askConfirm('Fermer sans enregistrer les modifications ?'))return;setEdit(null);setRunEdit(null);history.replaceState(null,'',serviceHref('/routines',team))}
function openRoutine(r?:Row<Routine>){if(busy)return;setRunEdit(null);const v=r?structuredClone(r):{id:'',revision:0,data:{mode:'catalog' as const,title:'',description:'',teams:meta.editableTeams?.includes(team)?[team]:[],pilot:'',start:todayParis(),time:'09:00',repeat:'none' as const,interval:1,end:'',active:true,questions:[{id:crypto.randomUUID(),label:''}]}};setEdit(v);setBaseline(JSON.stringify(v.data));setModalError('')}
function duplicateRoutine(r:Row<Routine>){const copy=structuredClone(r);copy.id='';copy.revision=0;copy.has_runs=0;copy.data.title=copy.data.title.slice(0,188)+' · copie';copy.data.start=todayParis();copy.data.end='';copy.data.active=true;if(copy.data.mode==='scheduled-copy')copy.data.mode='catalog';openRoutine(copy);setBaseline('')}
async function openRun(id:string,date:string){setBusy(true);setError('');setModalError('');try{const d=await hubRequest('/api/hub?scope=run&id='+id+'&date='+date+'&team='+encodeURIComponent(new URLSearchParams(location.search).get('team')||''));const data:Run=d.run?.data||{answers:d.routine.data.questions.map((q:any)=>({...q,result:auditQuestionType(q)==='conformity'?'À faire':'Information',value:'',comment:''})),notes:'',completed:false};setRunEdit({routine:d.routine,date,revision:d.run?.revision||0,data,tickets:d.tickets});setRunBaseline(JSON.stringify(data));history.replaceState(null,'',serviceHref('/routines?routine='+encodeURIComponent(id)+'&date='+date,team))}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
async function saveRoutine(){if(!edit)return;const issue=routineError(edit.data);if(issue){setModalError(issue);return}setBusy(true);try{await hubRequest('/api/hub',{action:'routine',id:edit.id||undefined,revision:edit.revision,data:edit.data});setEdit(null);setNotice('Audit enregistré.');await load()}catch(e){setModalError((e as Error).message)}finally{setBusy(false)}}
async function saveRun(){if(!runEdit)return null;if(runEdit.data.completed){const issue=auditCompletionError(runEdit.data);if(issue){setModalError(issue);return null}}setBusy(true);setModalError('');try{const r=await hubRequest('/api/hub',{action:'run',routineId:runEdit.routine.id,date:runEdit.date,revision:runEdit.revision,data:runEdit.data});const data:Run=r.data;setRunEdit({...runEdit,revision:r.revision,data});setRunBaseline(JSON.stringify(data));setNotice(data.completed?'Audit terminé. Le compte rendu PDF est disponible.':'Compte rendu enregistré.');await load();return {data,revision:r.revision}}catch(e){setModalError((e as Error).message);return null}finally{setBusy(false)}}

const canUse=(routine:Row<Routine>,capability:'coordinate'|'contribute')=>{
 const teams=capability==='coordinate'?meta.editableTeams:meta.contributingTeams;
 return account.role==='admin'||account.role!=='reader'&&routine.data.teams.length>0&&routine.data.teams.every(id=>teams?.includes(id));
};
function canDelete(routine:Row<Routine>){
 return !routine.data.archivedAt&&(account.role==='admin'||account.role==='editor'&&
  routine.data.teams.length>0&&routine.data.teams.every(teamId=>meta.managedTeams?.includes(teamId)));
}
function requestDelete(routine:Row<Routine>){
 if(busy||!canDelete(routine))return;
 setDeleteText('');setDeleteError('');setDeleteTarget(routine);
}
async function deleteAudit(){
 if(!deleteTarget||deleteText!=='SUPPRIMER'||busy)return;
 setBusy(true);setDeleteError('');
 try{
  await hubRequest('/api/hub',{action:'delete-audit',id:deleteTarget.id,revision:deleteTarget.revision,confirmation:deleteText});
  setDeleteTarget(null);setEdit(null);setNotice('Audit retiré de la liste et du calendrier.');
  await load();
 }catch(error){setDeleteError((error as Error).message)}
 finally{setBusy(false)}
}
async function createSession(routine:Row<Routine>,intent:'now'|'schedule',date?:string,time?:string){
 if(busy)return;
 setBusy(true);setError('');setScheduleError('');
 try{
  const session=await hubRequest('/api/hub',{action:'audit-session',intent,routineId:routine.id,date,time});
  if(intent==='now'){
   await load();
   await openRun(session.id,session.date);
  }else{
   setSchedule(null);
   setNotice('Audit programmé le '+frenchDate(session.date)+' à '+time+'.');
   await load();
  }
 }catch(error){
  const message=(error as Error).message;
  if(intent==='schedule')setScheduleError(message);else setError(message);
 }finally{setBusy(false)}
}

const visible=rows.filter(r=>!team||r.data.teams.includes(team));
const events=visible.flatMap(r=>scheduledAuditDates(r.data,from,to).map(date=>({routine:r,date})));
const otherReports=runs.filter(run=>visible.some(row=>row.id===run.routine_id&&row.data.mode!=='on-demand'&&!row.data.archivedAt)&&
 !events.some(event=>event.routine.id===run.routine_id&&event.date===run.date));
const padding=(new Date(from+'T12:00:00Z').getUTCDay()+6)%7,days=Number(to.slice(8));
const name=(id:string)=>meta.users.find(u=>u.id===id)?.display_name||'Pilote à désigner';
const matches=(r:Row<Routine>)=>[r.data.title,r.data.description,name(r.data.pilot)].join(' ').toLocaleLowerCase('fr').includes(search.trim().toLocaleLowerCase('fr'));
const archived=visible.filter(r=>r.data.archivedAt&&r.has_runs&&matches(r));
const catalogue=visible.filter(r=>!r.data.archivedAt&&r.data.mode!=='on-demand'&&r.data.mode!=='scheduled-copy'&&matches(r)).sort((a,b)=>a.data.title.localeCompare(b.data.title,'fr'));
const sessions=visible.filter(r=>!r.data.archivedAt&&(r.data.mode==='on-demand'||r.data.mode==='scheduled-copy')&&matches(r))
 .sort((a,b)=>b.data.start.localeCompare(a.data.start)||b.data.time.localeCompare(a.data.time));
const sessionPage=useListPage(sessions,JSON.stringify([team,search]));
const teamFilter=<select aria-label="Équipe" value={team} onChange={event=>setTeam(event.target.value)}><option value="">Toutes les équipes</option>{meta.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>;

return <HubFrame active="Routines"><div className="audit-routines-page">
 <div className="hub-heading audit-page-heading">
  <div className="audit-page-title"><span className="audit-page-symbol"><ClipboardCheck size={28}/></span><div><h1>Audits & routines</h1><p>Choisissez une grille, réalisez l’audit sur le terrain et retrouvez son compte rendu.</p></div></div>
  {canEdit&&<button className="primary" disabled={busy} onClick={()=>openRoutine()}><Plus size={17}/>Créer un audit</button>}
 </div>
 {(error||metaError)&&<p className="error" role="alert">{error||metaError}</p>}
 {notice&&<p role="status" className="success">{notice}</p>}
 <div className="hub-filters audit-view-controls" role="group" aria-label="Vue des audits">
  <button className={view==='list'?'primary':'outline'} aria-pressed={view==='list'} onClick={()=>setView('list')}><ListChecks size={17}/>Liste des audits</button>
  <button className={view==='calendar'?'primary':'outline'} aria-pressed={view==='calendar'} onClick={()=>setView('calendar')}><CalendarDays size={17}/>Calendrier</button>
  {teamFilter}
 </div>
 {view==='list'?<>
  <div className="hub-section-heading"><h2>Grilles d’audit</h2><label className="audit-list-search"><Search size={16}/><input aria-label="Rechercher un audit" placeholder="Rechercher un audit…" value={search} onChange={event=>setSearch(event.target.value)}/></label></div>
  {loading?<p role="status">Chargement des audits…</p>:<div className="hub-routine-list">
   {catalogue.map(r=>{
    const {data}=r;
    const planned=data.mode!=='catalog'&&data.active;
    return <article key={r.id}><div>
     <h3>{data.title}</h3>
     <p>{name(data.pilot)} · {data.questions.length} point(s) de contrôle</p>
     <small>{!data.active?'Suspendu':!planned?'À la demande':data.repeat==='none'?'Programmé le '+frenchDate(data.start):labelRepeat[data.repeat]+' · '+data.time}</small>
    </div><div className="audit-routine-actions">
     {data.active&&canUse(r,'contribute')&&<button className="primary" disabled={busy} onClick={()=>void createSession(r,'now')}><Play size={16}/>Réaliser maintenant</button>}
     {data.active&&canUse(r,'coordinate')&&<button className="outline" disabled={busy} onClick={()=>{setScheduleError('');setSchedule({routine:r,date:todayParis(),time:data.time||'09:00'})}}><CalendarDays size={16}/>Programmer</button>}
     {planned&&data.repeat==='none'&&<button className="outline" disabled={busy} onClick={()=>void openRun(r.id,data.start)}>{r.scheduled_run_complete?'Compte rendu':'Ouvrir l’audit programmé'}</button>}
     {canUse(r,'coordinate')&&<><button className="outline" disabled={busy} onClick={()=>openRoutine(r)}>Modifier</button><button className="outline" disabled={busy} onClick={()=>duplicateRoutine(r)}>Dupliquer</button></>}
     {canDelete(r)&&<AuditDeleteMenu title={data.title} disabled={busy} onDelete={()=>requestDelete(r)}/>}
    </div></article>;
   })}
   {!catalogue.length&&<p>Aucun audit pour cette sélection.</p>}
  </div>}
  {sessions.length>0&&<section className="audit-session-list">
   <div className="hub-section-heading"><h2>Audits lancés depuis la liste</h2></div>
   <div className="hub-routine-list">{sessionPage.rows.map(r=><article key={r.id}><div>
    <h3>{r.data.title}</h3>
    <p>{frenchDate(r.data.start)} · {r.data.time} · {r.data.mode==='on-demand'?'Ponctuel':'Programmé'}</p>
    <small>{r.scheduled_run_complete?'Réalisé':r.has_runs?'En cours':r.data.active?'À réaliser':'Suspendu'}</small>
   </div><div className="audit-routine-actions">
    <button className="outline" disabled={busy} onClick={()=>void openRun(r.id,r.data.start)}>{r.scheduled_run_complete?'Voir le compte rendu':'Ouvrir l’audit'}</button>
    {r.data.mode==='scheduled-copy'&&canUse(r,'coordinate')&&<button className="outline" disabled={busy} onClick={()=>openRoutine(r)}>Modifier</button>}
    {canDelete(r)&&<AuditDeleteMenu title={r.data.title} disabled={busy} onDelete={()=>requestDelete(r)}/>}
   </div></article>)}</div>
   <ListPagination page={sessionPage.page} pages={sessionPage.pages} total={sessions.length} onChange={sessionPage.setPage}/>
  </section>}
  {archived.length>0&&<details className="audit-session-list audit-archive">
   <summary>Comptes rendus des audits archivés ({archived.length})</summary>
   <div className="hub-routine-list">{archived.map(row=><ArchivedAuditReports key={row.id+':'+team} audit={row} team={team} busy={busy} onOpen={date=>void openRun(row.id,date)}/>)}</div>
  </details>}
 </>:<>
 <div className="audit-page-stats" aria-label="Bilan du mois affiché"><article><span className="audit-stat-icon"><CalendarDays size={20}/></span><div><small>Occurrences programmées</small><strong>{loading?'—':events.length}</strong></div><span>Ce mois-ci</span></article><article data-tone="success"><span className="audit-stat-icon"><CheckCircle2 size={20}/></span><div><small>Comptes rendus terminés</small><strong>{loading?'—':runs.filter(r=>r.data.completed&&events.some(event=>event.routine.id===r.routine_id&&event.date===r.date)).length}</strong></div><span>Ce mois-ci</span></article><article data-tone="warning"><span className="audit-stat-icon"><Clock3 size={20}/></span><div><small>À rattraper</small><strong>{loading?'—':events.filter(e=>e.date<todayParis()&&!runs.some(r=>r.routine_id===e.routine.id&&r.date===e.date&&r.data.completed)).length}</strong></div><span>Ce mois-ci</span></article></div>
 <div className="hub-filters">
  <button className="outline" aria-label="Mois précédent" onClick={()=>shift(-1)}><ChevronLeft size={18}/></button>
  <input aria-label="Mois du calendrier" type="month" value={month} onChange={event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))setMonth(event.target.value)}}/>
  <button className="outline" aria-label="Mois suivant" onClick={()=>shift(1)}><ChevronRight size={18}/></button>
 </div>
 {loading?<p role="status">Chargement du calendrier…</p>:<div className="hub-calendar-scroll"><div className="hub-calendar">{['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><strong className="calendar-day-name" key={d}>{d}</strong>)}{Array.from({length:padding},(_,i)=><div className="calendar-pad" key={'p'+i}/>)}{Array.from({length:days},(_,i)=>{const date=month+'-'+String(i+1).padStart(2,'0');return <div className={'calendar-day '+(date===todayParis()?'today':'')} key={date}><time>{i+1}</time>{events.filter(e=>e.date===date).map(e=>{const done=runs.find(r=>r.routine_id===e.routine.id&&r.date===date)?.data.completed;return <button disabled={busy} className={'calendar-event '+(done?'complete':'')} key={e.routine.id} onClick={()=>openRun(e.routine.id,date)}><small>{e.routine.data.time} · {done?'Réalisé':date<todayParis()?'À rattraper':'Planifié'}</small>{e.routine.data.title}</button>})}</div>})}</div></div>}
 {otherReports.length>0&&<section className="audit-session-list"><h2>Comptes rendus conservés</h2><div className="audit-routine-actions">{otherReports.map(run=>
  <button className="outline" key={run.id} disabled={busy} onClick={()=>void openRun(run.routine_id,run.date)}>{visible.find(row=>row.id===run.routine_id)?.data.title} · {frenchDate(run.date)}</button>)}</div></section>}
 </>}
 <Dialog open={!!schedule} onOpenChange={open=>{if(!open&&!busy)setSchedule(null)}}>
  <DialogContent className="hub-form-dialog" showCloseButton={!busy}>
   <DialogTitle>Programmer un audit</DialogTitle>
   <DialogDescription>{schedule?.routine.data.title}</DialogDescription>
   {schedule&&<form onSubmit={event=>{event.preventDefault();void createSession(schedule.routine,'schedule',schedule.date,schedule.time)}}>
    <fieldset className="hub-fields" disabled={busy}>
     <label>Date<input type="date" required min={todayParis()} value={schedule.date} onChange={event=>setSchedule({...schedule,date:event.target.value})}/></label>
     <label>Heure · France<input type="time" required value={schedule.time} onChange={event=>setSchedule({...schedule,time:event.target.value})}/></label>
    </fieldset>
    {scheduleError&&<p className="error" role="alert">{scheduleError}</p>}
    <div className="audit-routine-actions"><button type="button" className="outline" disabled={busy} onClick={()=>setSchedule(null)}>Annuler</button><button className="primary" disabled={busy||!validDate(schedule.date)||!schedule.time} type="submit">Programmer l’audit</button></div>
   </form>}
  </DialogContent>
 </Dialog>
<Dialog open={!!edit||!!runEdit} onOpenChange={v=>{if(!v)close()}}><DialogContent className={'hub-form-dialog '+(edit?'audit-builder-dialog':'')} showCloseButton={!busy}><DialogTitle>{edit?<><img className="ab-dialog-logo" src="/polytechs-logo.png" alt="Polytechs"/><span className="ab-dialog-divider"/><span>{edit.id?'Modifier un audit':'Créer un audit'}</span></>:runEdit?.routine.data.title}</DialogTitle>{edit?.id&&canDelete(edit)&&<div className="audit-editor-menu"><AuditDeleteMenu title={edit.data.title} disabled={busy||dirty} onDelete={()=>requestDelete(edit)}/></div>}<DialogDescription>{edit?'Organisez la grille, testez le formulaire et programmez sa réalisation.':(runEdit?.routine.data.mode==='on-demand'?'Audit ponctuel du ':'Compte rendu du ')+(runEdit?frenchDate(runEdit.date):'')+' · '+runEdit?.routine.data.time}</DialogDescription>{modalError&&<p role="alert" className="error">{modalError}</p>}{edit&&<AuditBuilder key={edit.id||'new'} value={edit.data} meta={meta} busy={busy} locked={!!edit.has_runs} existing={!!edit.id} onChange={data=>setEdit({...edit,data})} onSave={saveRoutine} onConfirm={askConfirm}/>}{runEdit&&<AuditRunEditor audit={runEdit} canFill={canFill} canEdit={canUse(runEdit.routine,'coordinate')} busy={busy} dirty={dirty} team={team} onChange={data=>setRunEdit({...runEdit,data})} onSave={saveRun} onSaved={(data,revision)=>{setRunEdit({...runEdit,data,revision});setRunBaseline(JSON.stringify(data));load()}} onBusy={setBusy} onError={setModalError}/> }</DialogContent></Dialog><Dialog open={!!deleteTarget} onOpenChange={open=>{if(!open&&!busy)setDeleteTarget(null)}}>
 <DialogContent className="hub-form-dialog audit-delete-dialog" showCloseButton={!busy}>
  <DialogTitle>Supprimer cet audit</DialogTitle>
  <DialogDescription><strong>{deleteTarget?.data.title}</strong> sera retiré de la liste et du calendrier. Ses comptes rendus éventuels restent consultables dans les archives.</DialogDescription>
  <form onSubmit={event=>{event.preventDefault();void deleteAudit()}}>
   <label>Saisissez <strong>SUPPRIMER</strong> en majuscules<input autoFocus autoComplete="off" spellCheck={false} value={deleteText} disabled={busy} onChange={event=>setDeleteText(event.target.value)}/></label>
   {deleteError&&<p className="error" role="alert">{deleteError}</p>}
   <div className="audit-routine-actions">
    <button type="button" className="outline" disabled={busy} onClick={()=>setDeleteTarget(null)}>Annuler</button>
    <button type="submit" className="audit-delete-confirm" disabled={busy||deleteText!=='SUPPRIMER'}>{busy?'Suppression…':'Supprimer l’audit'}</button>
   </div>
  </form>
 </DialogContent>
</Dialog>
</div>{confirmation}</HubFrame>
}

function AuditDeleteMenu({title,disabled,onDelete}:{title:string;disabled:boolean;onDelete:()=>void}){
 return <DropdownMenu modal={false}>
  <DropdownMenuTrigger asChild><button type="button" className="outline audit-more" aria-label={'Actions pour '+title} disabled={disabled}><MoreHorizontal size={20}/></button></DropdownMenuTrigger>
  <DropdownMenuContent align="end"><DropdownMenuItem variant="destructive" onSelect={onDelete}><Trash2 size={16}/>Supprimer l’audit</DropdownMenuItem></DropdownMenuContent>
 </DropdownMenu>;
}

function ArchivedAuditReports({audit,team,busy,onOpen}:{audit:Row<Routine>;team:string;busy:boolean;onOpen:(date:string)=>void}){
 const [reports,setReports]=useState<{date:string;completed:number}[]|null>(null);
 const [loading,setLoading]=useState(false),[error,setError]=useState('');
 async function loadReports(){
  if(loading||reports)return;
  setLoading(true);setError('');
  try{
   const result=await hubRequest('/api/hub?scope=audit-history&id='+encodeURIComponent(audit.id)+'&team='+encodeURIComponent(team));
   setReports(result.reports);
  }catch(error){setError((error as Error).message)}
  finally{setLoading(false)}
 }
 return <article><div><h3>{audit.data.title}</h3>
  {loading&&<p role="status">Chargement des comptes rendus…</p>}
  {error&&<p className="error" role="alert">{error}</p>}
  {reports&&<div className="audit-routine-actions">{reports.length?reports.map(report=><button key={report.date} className="outline" disabled={busy}
   onClick={()=>onOpen(report.date)}>{frenchDate(report.date)} · {report.completed?'Réalisé':'Brouillon'}</button>):<p>Aucun compte rendu enregistré.</p>}</div>}
 </div>{!reports&&<button className="outline" disabled={loading||busy} onClick={()=>void loadReports()}>{error?'Réessayer':'Voir les comptes rendus'}</button>}</article>;
}

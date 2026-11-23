'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ServiceSidebar} from '@/components/service-sidebar';
import {IndicatorBlock} from '@/components/indicator-block';
import {WidgetResize} from '@/components/widget-resize';
import {DashboardDataEntry} from '@/components/dashboard-data-entry';
import {WorkspaceNav} from '@/components/hub-layout';
import {GmaoOverview} from '@/components/gmao-overview';
import {DashboardOverview} from '@/components/dashboard-overview';
import {DashboardCover} from './dashboard-cover';
import {DashboardToolbar,dashboardZoom} from './dashboard-toolbar';
import {DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {WidgetAppearance,CustomContent} from '@/components/widget-customizer';
import {MetricChart} from '@/components/metric-chart';
import {TeamTree,type Team,type BoardLink} from '@/components/team-navigation';
import {teamSettingsHref} from '@/lib/team-organization';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AccountGate,type Account} from '@/components/account-gate';
import {widgetLabels,newWidget,defaultBoard,boardError,duplicateWidget,reorderWidgets,readableInk,actionSummary,parisToday,type Board,type Widget} from '@/lib/unit-dashboard';
import {riskScore,riskBand} from '@/lib/evrp';
import {ArrowUp,ArrowDown,Copy,Eye,EyeOff,Maximize2,Pencil,Plus,RefreshCw,Settings2,Trash2} from 'lucide-react';
import './style.css';
import './dashboard.css';
type Payload={id:string;canContribute?:boolean;team:Team;scope:string;unit:{code:string;name:string;roles:any[]};board:Board;revision:number;updatedAt:string;updatedBy:string;risks:any[];actions:any[]};
async function request(url:string,options?:RequestInit){const r=await fetch(url,options),d=await r.json() as any;if(!r.ok)throw Error(d.error||'Chargement impossible.');return d}
const colors:Record<string,string>={green:'#92D050',yellow:'#FFFF00',orange:'#F79646',red:'#FF0000',unknown:'#cbd5e1'};
export default function Page(){return <AccountGate>{(account,logout)=><Dashboard account={account} logout={logout}/>}</AccountGate>}
function Dashboard({account,logout}:{account:Account;logout:()=>void}){
const [showOverview,setShowOverview]=useState(true),[zoom,setZoom]=useState<number>(dashboardZoom.initial),[playing,setPlaying]=useState(false),[nativeFullscreen,setNativeFullscreen]=useState(false),[expanded,setExpanded]=useState(false),[defaultBoardId,setDefaultBoardId]=useState('');
const fullscreen=nativeFullscreen||expanded;
const stageRef=useRef<HTMLElement>(null);
const [editableTeams,setEditableTeams]=useState<string[]>([]);
const [catalogReady,setCatalogReady]=useState(false);
const [missions,setMissions]=useState({epiManager:false,pdpAccess:false,budgetManager:false});
const [teams,setTeams]=useState<Team[]>([]),[boards,setBoards]=useState<BoardLink[]>([]),[selected,setSelected]=useState(''),[activeTeam,setActiveTeam]=useState(''),[data,setData]=useState<Payload|null>(null),[draft,setDraft]=useState<Board|null>(null),[scope,setScope]=useState(''),[targetTeam,setTargetTeam]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[tick,setTick]=useState(0),[year,setYear]=useState(new Date().getFullYear()),[addType,setAddType]=useState<Widget['type']>('indicator'),[newBoardOpen,setNewBoardOpen]=useState(false),[formName,setFormName]=useState(''),[formTeam,setFormTeam]=useState('direction'),[formError,setFormError]=useState(''),[dragId,setDragId]=useState(''),[preview,setPreview]=useState(false),[removed,setRemoved]=useState<{w:Widget;i:number}|null>(null);
useEffect(()=>{
 const controller=new AbortController();
 request('/api/dashboards',{signal:controller.signal}).then(d=>{
  if(controller.signal.aborted)return;
  const availableTeams=d.teams as Team[],availableBoards=d.boards as BoardLink[];
  setMissions({epiManager:!!d.epiManager,pdpAccess:!!d.pdpAccess,budgetManager:!!d.budgetManager});
  setTeams(availableTeams);setBoards(availableBoards);setEditableTeams(d.editableTeams||[]);setCatalogReady(true);
  const query=new URLSearchParams(location.search);
  const requestedBoard=query.get('board')||(query.get('unit')?'legacy-'+query.get('unit'):'');
  const service=availableTeams.find(t=>t.id===query.get('team'))||availableTeams.find(t=>t.id==='direction')||availableTeams[0];
  const serviceBoards=availableBoards.filter(b=>b.team_id===service?.id);
  const preferred=service&&localStorage.getItem('polytechs-default-board-'+account.id+'-'+service.id);
  const current=availableBoards.find(b=>b.id===requestedBoard)||
   (!query.has('board')&&query.get('view')!=='activity'?(serviceBoards.find(b=>b.id===preferred)||(!query.has('team')?serviceBoards[0]:undefined)):undefined);
  setSelected(current?.id||'');
  setActiveTeam(current?.team_id||service?.id||'');
 }).catch(e=>{if(e.name!=='AbortError')setError(e.message)});
 return()=>controller.abort();
},[account.id,tick]);
useEffect(()=>{setData(null);if(!selected)return;const c=new AbortController();setError('');request('/api/dashboards?id='+encodeURIComponent(selected),{signal:c.signal}).then(d=>{setData(d);setScope(d.scope);setTargetTeam(d.team.id)}).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>c.abort()},[selected,tick]);
useEffect(()=>{if(!draft&&!newBoardOpen)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[draft,newBoardOpen]);
const zoomKey='polytechs-board-zoom-'+(selected||'service-'+activeTeam);
useEffect(()=>{
 setShowOverview(localStorage.getItem('polytechs-overview-'+selected)!=='hidden');
 const stored=Number(localStorage.getItem(zoomKey));
 setZoom(stored>=dashboardZoom.min&&stored<=dashboardZoom.max?stored:dashboardZoom.initial);
},[selected,zoomKey]);
useEffect(()=>{setDefaultBoardId(localStorage.getItem('polytechs-default-board-'+account.id+'-'+activeTeam)||'')},[account.id,activeTeam]);
useEffect(()=>{const changed=()=>setNativeFullscreen(document.fullscreenElement===stageRef.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[]);
useEffect(()=>{
 if(!expanded)return;
 const escape=(event:KeyboardEvent)=>{
  if(event.key==='Escape'&&!document.querySelector('[role="dialog"][data-state="open"]'))setExpanded(false);
 };
 document.addEventListener('keydown',escape);
 return()=>document.removeEventListener('keydown',escape);
},[expanded]);
const unit=data?.scope||'',board=draft||(data?.id===selected?data.board:undefined),today=parisToday(),stats=actionSummary(data?.actions||[],today,year),editable=account.role==='admin'||account.role==='editor'&&editableTeams.includes(activeTeam),team=teams.find(t=>t.id===activeTeam),teamBoards=boards.filter(b=>b.team_id===activeTeam),boardIndex=teamBoards.findIndex(b=>b.id===selected);
function selectBoard(id:string,teamId=activeTeam){
 if(id!==selected)setData(null);
 setSelected(id);
 const service=boards.find(b=>b.id===id)?.team_id||teamId;
 setActiveTeam(service);setNotice('');setError('');
 const url=id?'/unites?board='+encodeURIComponent(id):'/unites?'+new URLSearchParams({team:service,view:'activity'});
 history.replaceState(null,'',url);
}
function chooseBoard(id:string){setPlaying(false);selectBoard(id)}
function selectTeam(team:Team){
 if(team.id==='maintenance'){location.assign('/maintenance');return}
 setPlaying(false);
 const preferred=localStorage.getItem('polytechs-default-board-'+account.id+'-'+team.id);
 const board=boards.find(b=>b.id===preferred&&b.team_id===team.id);
 selectBoard(board?.id||'',team.id);
}
function changeZoom(next:number){
 const value=Math.max(dashboardZoom.min,Math.min(dashboardZoom.max,next));
 localStorage.setItem(zoomKey,String(value));
 setZoom(value);
}
function stepBoard(delta:-1|1){
 if(!teamBoards.length)return;
 const next=boardIndex<0?(delta===1?0:teamBoards.length-1):(boardIndex+delta+teamBoards.length)%teamBoards.length;
 chooseBoard(teamBoards[next].id);
}
function toggleSlideshow(){
 if(playing){setPlaying(false);return}
 if(teamBoards.length<2)return;
 if(boardIndex<0)selectBoard(teamBoards[0].id);
 setPlaying(true);
}
function toggleDefault(){
 if(!selected)return;
 const key='polytechs-default-board-'+account.id+'-'+activeTeam;
 if(defaultBoardId===selected){localStorage.removeItem(key);setDefaultBoardId('')}
 else{localStorage.setItem(key,selected);setDefaultBoardId(selected)}
}
function toggleActivity(){
 localStorage.setItem('polytechs-overview-'+selected,showOverview?'hidden':'shown');
 setShowOverview(!showOverview);
}
function refreshBoard(){setPlaying(false);setError('');setNotice('');setTick(t=>t+1)}
async function toggleFullscreen(){
 if(expanded){setExpanded(false);return}
 if(nativeFullscreen){await document.exitFullscreen();return}
 const stage=stageRef.current;
 if(!stage)return;
 try{await stage.requestFullscreen()}
 catch{setExpanded(true)}
}
useEffect(()=>{
 if(!playing||draft||busy||!board||boardIndex<0||teamBoards.length<2)return;
 const nextId=teamBoards[(boardIndex+1)%teamBoards.length].id;
 const timer=setTimeout(()=>selectBoard(nextId),10000);
 return()=>clearTimeout(timer);
},[playing,draft,busy,data,selected,activeTeam,boards]);
function openBoardForm(){
 setPlaying(false);setFormName('');setFormTeam(activeTeam);setFormError('');setNewBoardOpen(true);
}
async function submitForm(e:React.FormEvent){
 e.preventDefault();setBusy(true);setFormError('');
 try{
  const board=defaultBoard();board.title=formName.trim();board.widgets=[];
  const r=await request('/api/dashboards',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({action:'create',teamId:formTeam,scope:'',board})});
  history.replaceState(null,'','/unites?board='+encodeURIComponent(r.id));
  setNewBoardOpen(false);setTick(t=>t+1);setNotice('Tableau créé. Vous pouvez maintenant le personnaliser.');
 }catch(e){setFormError((e as Error).message)}finally{setBusy(false)}
}
function update(id:string,patch:Partial<Widget>){setDraft(b=>b&&({...b,widgets:b.widgets.map(w=>w.id===id?{...w,...patch}:w)}))}
function removeWidget(w:Widget,i:number){setRemoved({w,i});setDraft(b=>b&&({...b,widgets:b.widgets.filter(x=>x.id!==w.id)}))}
async function copyBoard(){if(!data)return;setPlaying(false);setBusy(true);setError('');try{const r=await request('/api/dashboards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',teamId:data.team.id,scope:data.scope,board:{...structuredClone(data.board),title:(data.board.title+' · copie').slice(0,100)}})});history.replaceState(null,'','/unites?board='+r.id);setTick(t=>t+1);setNotice('Copie indépendante créée.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
function move(i:number,delta:number){setDraft(b=>{if(!b)return b;const widgets=[...b.widgets];[widgets[i],widgets[i+delta]]=[widgets[i+delta],widgets[i]];return {...b,widgets}})}
async function save(){if(!draft||!data)return;const issue=boardError(draft);if(issue){setError(issue);return}setBusy(true);setError('');try{await request('/api/dashboards',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'save',id:data.id,teamId:targetTeam,scope,revision:data.revision,board:draft})});history.replaceState(null,'','/unites?board='+encodeURIComponent(data.id));setDraft(null);setTick(t=>t+1);setNotice('Tableau enregistré.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
const href=(tab='risks')=>'/duerp?'+(unit&&unit!=='*'?'unit='+encodeURIComponent(unit)+'&':'')+'tab='+tab;
function content(w:Widget){if(!data)return null;if(['links','checklist','table','chart','heading','embed'].includes(w.type))return <CustomContent w={w} editing={false} disabled={busy} onChange={p=>update(w.id,p)}/>;if(!data.scope&&!['note','indicator'].includes(w.type))return <p className="board-muted">Les évaluations sont consultables dans le DUERP. Ajoutez ici des indicateurs et contenus propres au service.</p>;const applicable=data.risks.filter(r=>r.data.applicable),ranked=applicable.map(r=>({...r,score:riskScore(r.data)})).sort((a,b)=>(b.score??-1)-(a.score??-1));
if(w.type==='risks')return <><div className="board-number">{applicable.length}<small>situations applicables</small></div><div className="risk-bars">{['red','orange','yellow','green','unknown'].map(b=>{const n=ranked.filter(r=>riskBand(r.score).key===b).length;return <div key={b}><span style={{background:colors[b]}}/><label>{b==='unknown'?'À coter':riskBand({red:41,orange:20,yellow:8,green:0}[b]??null).label}</label><strong>{n}</strong></div>})}</div><p className="board-muted">{data.risks.length-applicable.length} non applicables · {data.risks.filter(r=>r.data.reviewReasons?.length&&r.status!=='Validé').length} anomalies à vérifier</p><a href={href()}>Ouvrir les évaluations →</a></>;
if(w.type==='priorities')return <>{ranked.filter(r=>r.score!==null).slice(0,w.limit||5).map(r=><a className="board-risk" href={href()+'&risk='+encodeURIComponent(r.id)} key={r.id}><span className="score-chip" style={{borderColor:colors[riskBand(r.score).key]}}>{r.score}</span><span><strong>{r.data.risk}</strong><small>{r.data.factor}{r.data.reviewReasons?.length&&r.status!=='Validé'?' · À vérifier':''}</small></span></a>)}{!ranked.some(r=>r.score!==null)&&<p>Aucune situation cotée.</p>}<p className="board-muted">Les {w.limit||5} cotations les plus élevées, selon le code couleurs du DUERP.</p></>;
if(w.type==='actions'){const rows=[...data.actions].filter(a=>a.status!=='Clôturée').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));return <><div className="board-kpis"><div><strong>{stats.open}</strong>ouvertes</div><div className={stats.late?'late':''}><strong>{stats.late}</strong>en retard</div><div><strong>{stats.verify}</strong>à vérifier</div></div><div className="board-action-list">{rows.slice(0,w.limit||8).map(a=><a href={href('actions')+'&action='+encodeURIComponent(a.id)} key={a.id}><strong>{a.description}</strong><small>{a.owner||'Pilote à désigner'} · {a.status}</small><span className={a.due&&a.due<today?'late':''}>{a.due?new Date(a.due+'T12:00:00').toLocaleDateString('fr-FR'):'Échéance à définir'}</span></a>)}</div>{!rows.length&&<p>Aucune action ouverte.</p>}<p className="board-muted">Toutes années · {stats.undated} sans échéance · {rows.length>(w.limit||8)?(w.limit||8)+' premières actions affichées':''}</p><a href={href('actions')}>Gérer les actions de l’unité →</a></>}
if(w.type==='program')return <><label className="board-year">Année <input type="number" min="2020" max="2100" value={year} onChange={e=>setYear(Number(e.target.value))}/></label><div className="board-number">{stats.total?Math.round(stats.closed/stats.total*100)+' %':'—'}<small>{stats.closed} / {stats.total} actions clôturées</small></div><progress aria-label="Avancement du programme" max={stats.total||1} value={stats.closed}/><p className="board-muted">Clôture avec vérification d’efficacité. {stats.total===0?'Aucune action inscrite pour cette année.':''}</p><a href={href('program')+'&year='+year}>Ouvrir le PAPRIPACT →</a></>;
if(w.type==='team')return <><p className="board-muted">Métiers issus du DUERP</p>{data.unit.roles.map((r,i)=><details key={i}><summary>{r.job||r.subcode}</summary><p>{r.mission}</p><p>{r.tasks}</p></details>)}{!data.unit.roles.length&&<p>Aucun métier renseigné.</p>}</>;
if(w.type==='note')return <p className="board-note">{w.text||'Ajoutez les consignes, les points de vigilance et les décisions du point d’équipe en personnalisant ce bloc.'}</p>;
return <IndicatorBlock key={data.id+':'+w.id} w={w} boardId={data.id} revision={data.revision} canContribute={!draft&&!!data.canContribute} canCreateTicket={!draft&&editable} onSaved={()=>setTick(t=>t+1)}/>;
}
function editBoard(){
 if(!data)return;
 setPlaying(false);setDraft(structuredClone(data.board));setScope(data.scope);
 setTargetTeam(data.team.id);setPreview(false);setRemoved(null);setNotice('');
}
const hasMeasures=!!(board&&data?.canContribute&&board.widgets.some(w=>w.type==='indicator'));
const commands=draft?<>
 <button type="button" className="dashboard-tool" disabled={busy} onClick={()=>{setDraft(null);setPreview(false);setRemoved(null);setError('')}}>Annuler</button>
 <button type="button" className="dashboard-tool" disabled={busy} onClick={()=>setPreview(!preview)}>{preview?'Éditeur':'Aperçu'}</button>
 <button type="button" className="primary" disabled={busy} onClick={save}>{busy?'Enregistrement…':'Enregistrer'}</button>
</>:(editable||hasMeasures)?<>
 {editable&&<button type="button" className="dashboard-tool icon-only" aria-label="Nouveau tableau" title="Nouveau tableau" disabled={busy} onClick={openBoardForm}>
  <Plus size={17} aria-hidden="true"/>
 </button>}
 {editable&&selected&&<button type="button" className="dashboard-tool" aria-label="Modifier" title="Modifier le tableau" disabled={busy||!board} onClick={editBoard}>
  <Pencil size={15} aria-hidden="true"/><span className="dashboard-tool-label">Modifier</span>
 </button>}
 {hasMeasures&&data&&<DashboardDataEntry key={data.id+':'+data.revision} id={data.id} revision={data.revision}
  widgets={data.board.widgets} onSaved={()=>setTick(t=>t+1)}/>}
</>:null;

return <div className="team-workspace dashboard-workspace">
 <a className="skip-link" href="#workspace-content">Aller au contenu</a>
 <ServiceSidebar {...missions} rhAccess={teams.some(t=>t.id==='rh')}>
  <p className="navlabel">SERVICES ET TABLEAUX</p>
  <TeamTree teams={teams} boards={boards} selected={selected} disabled={!!draft||busy} onSelect={chooseBoard} onTeam={selectTeam}/>
  {account.role==='admin'&&<button className="outline" disabled={!!draft||busy} onClick={()=>location.assign('/equipes?nouvelle=1')}><Plus size={16}/> Ajouter un service</button>}
  <div className="hub-account">{account.displayName}<button disabled={!!draft||busy} onClick={logout}>Déconnexion</button></div>
 </ServiceSidebar>
 <div className="unit-board" style={{background:board?.background||'#f3f5f7'}}>
  <WorkspaceNav active="Dashboard" teamId={activeTeam} teamName={team?.name} disabled={!!draft||busy}/>
  <main ref={stageRef} className={expanded?'dashboard-expanded':undefined} id="workspace-content" tabIndex={-1}>
   {team&&<DashboardToolbar boards={teamBoards} selected={selected} busy={busy} editing={!!draft}
    fullscreen={fullscreen} playing={playing} zoom={zoom} isDefault={defaultBoardId===selected} commands={commands}
    onSelect={chooseBoard} onStep={stepBoard} onFullscreen={toggleFullscreen} onPlay={toggleSlideshow}
    onZoom={changeZoom} onDefault={toggleDefault} options={<>
     <DropdownMenuItem onSelect={refreshBoard}><RefreshCw aria-hidden="true"/>Actualiser</DropdownMenuItem>
     {selected&&board&&<DropdownMenuItem onSelect={toggleActivity}>
      {showOverview?<EyeOff aria-hidden="true"/>:<Eye aria-hidden="true"/>}{showOverview?'Masquer l’activité':'Afficher l’activité'}
     </DropdownMenuItem>}
     {editable&&selected&&board&&<DropdownMenuItem onSelect={()=>void copyBoard()}><Copy aria-hidden="true"/>Dupliquer le tableau</DropdownMenuItem>}
     {account.role==='admin'&&<DropdownMenuItem asChild>
      <a href={teamSettingsHref(team.id)}><Settings2 aria-hidden="true"/>Modifier l’équipe</a>
     </DropdownMenuItem>}
    </>}/>}
   {error&&<div role="alert" className="error">{error}</div>}
   {notice&&<div role="status" className="success">{notice}</div>}
   {(!catalogReady||selected&&!data)&&!error&&<p role="status">Chargement du tableau de bord…</p>}
   {catalogReady&&!selected&&!team&&<p className="board-empty">Aucun service accessible avec ce compte.</p>}
   <div className="board-canvas" style={{zoom:zoom/100} as CSSProperties}
    onFocusCapture={playing?()=>setPlaying(false):undefined} onPointerDownCapture={playing?()=>setPlaying(false):undefined}>
   {!selected&&team&&<>
    <DashboardCover team={team} title={team.name} activity={activeTeam!=='maintenance'}/>
    {activeTeam==='maintenance'?<GmaoOverview refresh={tick}/>:<DashboardOverview key={activeTeam}
     teamId={activeTeam} teamName={team.name} teams={teams} refresh={tick}/>}
    {teamBoards.length>0&&<section className="dashboard-team-boards">
     <h2 className="board-section-title">Tableaux du service</h2>
     <div className="team-board-list">{teamBoards.map(b=><button className="board-card" key={b.id} onClick={()=>chooseBoard(b.id)}>
      <h3>{b.title}</h3><span>Ouvrir le tableau →</span>
     </button>)}</div>
    </section>}
   </>}
{data&&board&&<>
{draft&&<div className="board-title-editor"><label>Nom du tableau<input className="board-title-input" disabled={busy} maxLength={100} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label></div>}<DashboardCover team={data.team} title={board.title} activity={!draft&&showOverview&&activeTeam!=='maintenance'} custom={!!board.widgets.length}/>
{draft&&!preview&&<div className="board-builder"><label>Colonnes <select disabled={busy} value={draft.columns||3} onChange={e=>setDraft({...draft,columns:Number(e.target.value)})}>{[1,2,3,4,5,6].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label>Fond du tableau <input type="color" disabled={busy} value={draft.background||'#ffffff'} onChange={e=>setDraft({...draft,background:e.target.value})}/></label><label>Espacement <input type="range" min={8} max={40} step={1} disabled={busy} value={draft.gap||18} onChange={e=>setDraft({...draft,gap:Number(e.target.value)})}/></label><label>Équipe <select disabled={busy} value={targetTeam} onChange={e=>setTargetTeam(e.target.value)}>{teams.filter(t=>account.role==='admin'||editableTeams.includes(t.id)).map(t=><option key={t.id} value={t.id}>{t.name} · rang {t.rank}</option>)}</select></label><label>Ajouter un bloc <select value={addType} onChange={e=>setAddType(e.target.value as Widget['type'])}>{Object.entries(widgetLabels).filter(([k])=>!['risks','priorities','actions','program','team'].includes(k)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><button className="outline" disabled={busy||draft.widgets.length>=60} onClick={()=>setDraft({...draft,widgets:[...draft.widgets,newWidget(addType)]})}><Plus size={16}/> Ajouter</button><span>Glissez les blocs par leur poignée ou utilisez les flèches. Les modifications s’appliquent uniquement à ce tableau.</span>{removed&&<button className="outline" disabled={busy||draft.widgets.length>=60} onClick={()=>{const widgets=[...draft.widgets];widgets.splice(Math.min(removed.i,widgets.length),0,removed.w);setDraft({...draft,widgets});setRemoved(null)}}>Rétablir le dernier bloc retiré</button>}</div>}{!draft&&<div id="dashboard-activity" hidden={!showOverview}>
 {showOverview&&(activeTeam==='maintenance'?<GmaoOverview refresh={tick}/>:<DashboardOverview key={activeTeam}
  teamId={activeTeam} teamName={data.team.name} teams={teams} refresh={tick}/>)}
</div>}
{(!!board.widgets.length||editable)&&<section id="dashboard-custom" className="dashboard-custom">
 <h2 className="board-section-title">Blocs personnalisés</h2>
 <div className={'board-grid custom-grid '+(draft&&!preview?'grid-editing':'')} style={{'--board-columns':board.columns||3,gap:board.gap||18} as CSSProperties}>{board.widgets.map((w,i)=><article className={'board-card custom-card '+(draft&&!preview?'is-editing':'')} key={w.id} style={{'--indicator-plot-height':Math.max(120,Math.min(400,(w.minHeight||280)-160))+'px','--block-span':Math.min(w.span||(w.wide?2:1),board.columns||3),'--block-ink':readableInk(w.background||'#ffffff'),'--block-font':(w.fontSize||16)+'px',minHeight:w.minHeight||160,background:w.background||'#ffffff',color:readableInk(w.background||'#ffffff'),borderTop:'4px solid '+(w.accent||'#005eaa'),textAlign:w.align||'left'} as CSSProperties} onDragOver={e=>{if(draft&&!preview&&!busy&&dragId){e.preventDefault();e.dataTransfer.dropEffect='move'}}} onDrop={e=>{e.preventDefault();if(draft&&!preview&&!busy&&dragId)setDraft({...draft,widgets:reorderWidgets(draft.widgets,dragId,w.id)});setDragId('')}}>{draft&&!preview?<details className="board-block-editor"><summary>Configurer le bloc</summary><div className="board-edit"><button className="drag-handle" type="button" disabled={busy} draggable={!busy} onDragStart={e=>{setDragId(w.id);e.dataTransfer.setData('text/plain',w.id);e.dataTransfer.effectAllowed='move'}} onDragEnd={()=>setDragId('')} aria-label={'Déplacer '+w.title}>⠿ Déplacer</button><input disabled={busy} aria-label="Titre du bloc" maxLength={120} value={w.title} onChange={e=>update(w.id,{title:e.target.value})}/><div><button title="Monter" aria-label={'Monter '+w.title} disabled={busy||i===0} onClick={()=>move(i,-1)}><ArrowUp size={16}/></button><button title="Descendre" aria-label={'Descendre '+w.title} disabled={busy||i===board.widgets.length-1} onClick={()=>move(i,1)}><ArrowDown size={16}/></button><button title="Changer la largeur" aria-label={'Changer la largeur de '+w.title} aria-pressed={w.wide} disabled={busy} onClick={()=>update(w.id,{span:(w.span||(w.wide?2:1))===1?2:1,wide:!w.wide})}><Maximize2 size={16}/></button><button title="Dupliquer le bloc" aria-label={'Dupliquer '+w.title} disabled={busy||board.widgets.length>=60} onClick={()=>{const widgets=[...draft.widgets];widgets.splice(i+1,0,duplicateWidget(w));setDraft({...draft,widgets})}}>Copier</button><button title="Retirer" aria-label={'Retirer '+w.title} disabled={busy} onClick={()=>removeWidget(w,i)}><Trash2 size={16}/></button></div><WidgetAppearance w={w} disabled={busy} onChange={p=>update(w.id,p)}/></div></details>:!w.hideTitle&&<h3>{w.title}</h3>}{draft&&!preview&&<><h3>{w.title}</h3><WidgetResize w={w} columns={board.columns||3} disabled={busy} onChange={p=>update(w.id,p)}/></>}{draft&&!preview?<details className="board-block-editor"><summary>Modifier le contenu</summary>{draft&&!preview&&['links','checklist','table','chart','heading','embed'].includes(w.type)?<CustomContent w={w} editing disabled={busy} onChange={p=>update(w.id,p)}/>:draft&&!preview&&(w.type==='note'||w.type==='indicator')?<div className="board-fields">{w.type==='indicator'&&<>{(['value','unit','target','date'] as const).map(k=><label key={k}>{{value:'Valeur mesurée',unit:'Unité (%, jours, kg…)',target:'Objectif',date:'Date de mesure'}[k]}<input disabled={busy} type={k==='date'?'date':'text'} maxLength={120} value={w[k]} onChange={e=>update(w.id,{[k]:e.target.value})}/></label>)}</>}<label>{w.type==='note'?'Consignes et décisions':'Commentaire / source de la mesure'}<textarea disabled={busy} maxLength={4000} rows={5} value={w.text} onChange={e=>update(w.id,{text:e.target.value})}/></label>{w.type==='indicator'&&<label>Sens de l’objectif<select disabled={busy} value={w.targetDirection||'at-least'} onChange={e=>update(w.id,{targetDirection:e.target.value as Widget['targetDirection']})}><option value="at-least">Minimum à atteindre (≥)</option><option value="at-most">Maximum à ne pas dépasser (≤)</option></select></label>}{w.type==='indicator'&&<CustomContent w={{...w,type:'chart'}} editing disabled={busy} onChange={p=>update(w.id,p)}/>}</div>:content(w)}</details>:null}{content(w)}</article>)}</div>{!board.widgets.length&&<div className="board-empty">{draft?'Ajoutez un bloc depuis la barre d’édition.':'Ouvrez « Modifier » pour ajouter vos blocs.'}</div>}
</section>}</>}
   </div>
  </main>
  <Dialog open={newBoardOpen} onOpenChange={open=>{if(!open&&!busy)setNewBoardOpen(false)}}>
   <DialogContent>
    <DialogTitle>Nouveau tableau de bord</DialogTitle>
    <DialogDescription>Chaque service peut contenir plusieurs tableaux personnalisables.</DialogDescription>
    <form className="board-fields" onSubmit={submitForm}>
     <label>Nom<input required maxLength={100} disabled={busy} value={formName} onChange={e=>setFormName(e.target.value)}/></label>
     <label>Équipe<select required disabled={busy} value={formTeam} onChange={e=>setFormTeam(e.target.value)}>
      {teams.filter(t=>account.role==='admin'||editableTeams.includes(t.id)).map(t=>
       <option key={t.id} value={t.id}>{t.name} · rang {t.rank}</option>)}
     </select></label>
     {formError&&<p role="alert" className="error">{formError}</p>}
     <button className="primary" disabled={busy}>{busy?'Enregistrement…':'Créer'}</button>
    </form>
   </DialogContent>
  </Dialog>
 </div></div>
}

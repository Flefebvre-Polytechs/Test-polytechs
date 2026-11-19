'use client';

import {useEffect,useRef,useState} from 'react';
import {Boxes,CalendarDays,ClipboardList,LayoutDashboard,Plus,ShieldCheck} from 'lucide-react';
import {AccountGate,type Account} from '@/components/account-gate';
import {HubFrame,hubRequest,useHubMeta} from '@/components/hub-layout';
import {todayParis} from '@/lib/hub';
import {VgpFamilies} from './families';
import {VgpPriorities,VgpRegister} from './register';
import {VgpRecordSheet,type VgpSheetRequest} from './record-sheet';
import {displayDate,type RegisterRow,type ReportFollowUp,type SheetTarget} from './model';
import './style.css';

type View='priorites'|'materiel'|'controles'|'observations';
type Registry={records:RegisterRow[];pendingReports:ReportFollowUp[];pendingResults?:ReportFollowUp[]};
const views=[
 {key:'priorites',label:'Priorités',icon:LayoutDashboard},
 {key:'materiel',label:'Familles et matériel',icon:Boxes},
 {key:'controles',label:'Contrôles',icon:CalendarDays},
 {key:'observations',label:'Observations',icon:ClipboardList},
] as const;

export default function Page(){
 return <AccountGate>{account=><Vgp account={account}/>}</AccountGate>;
}

function Vgp({account}:{account:Account}){
 const {meta}=useHubMeta();
 const [registry,setRegistry]=useState<Registry|null>(null),[error,setError]=useState('');
 const [view,setView]=useState<View>('priorites'),[registerPreset,setRegisterPreset]=useState({status:'',revision:0});
 const [sheet,setSheet]=useState<VgpSheetRequest|null>(null),[sheetKey,setSheetKey]=useState(0);
 const requestSequence=useRef(0),returnFocus=useRef<HTMLElement|null>(null);
 const canEdit=account.role==='admin'||account.role==='editor'&&!!meta.editableTeams?.includes('qsse');
 const today=todayParis();

 async function load(){
  const sequence=++requestSequence.current;
  try{
   const data:Registry=await hubRequest('/api/vgp');
   if(sequence===requestSequence.current){setRegistry(data);setError('')}
  }catch(e){if(sequence===requestSequence.current)setError((e as Error).message)}
 }

 useEffect(()=>{
  const query=new URLSearchParams(location.search);
  const routeView=query.get('vue');
  if(views.some(item=>item.key===routeView))setView(routeView as View);
  const id=query.get('id');
  if(id)setSheet({id,passageId:query.get('passage')||undefined});
  void load();
  return ()=>{requestSequence.current++};
 },[]);

 function updateURL(nextView:View,id?:string,passageId?:string){
  const url=new URL(location.href);
  if(nextView==='priorites')url.searchParams.delete('vue');else url.searchParams.set('vue',nextView);
  if(id)url.searchParams.set('id',id);else url.searchParams.delete('id');
  if(id&&passageId)url.searchParams.set('passage',passageId);else url.searchParams.delete('passage');
  history.replaceState(null,'',url.pathname+url.search);
 }
 function selectView(next:View){
  if(next!==view)setRegisterPreset({status:'',revision:0});
  setView(next);updateURL(next);
 }
 function register(kind:RegisterRow['kind'],status:string){
  const next=kind==='control'?'controles':'observations';
  setRegisterPreset(previous=>({status,revision:previous.revision+1}));
  setView(next);updateURL(next);
 }
 function open(target:SheetTarget,fromSheet=false){
  if(!fromSheet)returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setSheetKey(previous=>previous+1);setSheet(target);updateURL(view,target.id,target.passageId);
 }
 function create(kind:RegisterRow['kind'],family?:string){
  returnFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;
  setSheetKey(previous=>previous+1);setSheet({kind,family});
 }
 function close(){setSheet(null);updateURL(view)}
 function changed(id:string,passageId?:string){updateURL(view,id,passageId);void load()}

 const records=registry?.records||[];
 const controlCount=records.filter(record=>record.kind==='control').length;
 const observationCount=records.length-controlCount;
 const observationView=view==='observations'||view==='materiel';
 return <HubFrame active="VGP" teamId="qsse" className="vgp-workspace">
  <div className="vgp-shell">
   <header className="vgp-heading">
    <div className="vgp-heading-content">
     <span className="vgp-heading-section"><ShieldCheck size={17} aria-hidden="true"/> PRÉVENTION</span>
     <h1>VGP et contrôles périodiques</h1>
     <p>Échéances du parc, rapports de contrôle et suivi des écarts.</p>
    </div>
    <div className="vgp-heading-side">
     <time dateTime={today}><CalendarDays size={15} aria-hidden="true"/> {displayDate(today)}</time>
     {canEdit&&<button className="primary vgp-add" type="button" onClick={()=>create(observationView?'observation':'control')}>
      <Plus size={18} aria-hidden="true"/> {observationView?'Nouvelle observation':'Nouveau contrôle'}
     </button>}
    </div>
   </header>
   <nav className="vgp-tabs" aria-label="Vues du registre VGP">
    {views.map(({key,label,icon:Icon})=><button type="button" key={key} aria-pressed={view===key} onClick={()=>selectView(key)}>
     <Icon size={17} aria-hidden="true"/><span>{label}</span>
     {registry&&(key==='controles'||key==='observations')&&<b>{key==='controles'?controlCount:observationCount}</b>}
    </button>)}
   </nav>
   {error&&<p className="vgp-message" data-tone="red" role="alert">{error}
    <button className="vgp-text-action" type="button" onClick={()=>void load()}>Recharger le registre</button></p>}
   {!registry&&!error&&<p className="vgp-sheet-loading" role="status">Chargement du registre…</p>}
   {registry&&view==='priorites'&&<VgpPriorities records={records} users={meta.users} today={today} busy={!!sheet}
    pendingReports={registry.pendingReports} pendingResults={registry.pendingResults??[]} onOpen={open} onRegister={register}/>}
   {registry&&view==='materiel'&&<VgpFamilies records={records} busy={!!sheet} onOpen={open}
    onAdd={canEdit?family=>create('observation',family):undefined}/>}
   {registry&&(view==='controles'||view==='observations')&&<VgpRegister key={view+':'+registerPreset.revision}
    kind={view==='controles'?'control':'observation'} records={records} users={meta.users} initialStatus={registerPreset.status}
    today={today} busy={!!sheet} onOpen={open}/>}
  </div>
  {sheet&&<VgpRecordSheet key={sheetKey} request={sheet} records={records} users={meta.users} today={today} canEdit={canEdit}
   returnFocus={returnFocus.current} onClose={close} onFollow={target=>open(target,true)} onChanged={changed}/>}
 </HubFrame>;
}

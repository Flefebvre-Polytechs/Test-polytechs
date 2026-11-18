'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ShieldCheck,Plus,Search,CalendarClock,FileText,Ticket,ArrowRight,AlertTriangle} from 'lucide-react';
import {AccountGate,type Account} from '@/components/account-gate';
import {HubFrame,hubRequest,useHubMeta} from '@/components/hub-layout';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {ListPagination,useListPage} from '@/components/list-pagination';
import {useConfirmation} from '@/components/use-confirmation';
import {blankVgp,nextVgpDate,vgpTiming,vgpStatuses,type VgpRecord} from '@/lib/vgp';
import {todayParis} from '@/lib/hub';
import './style.css';

type FileRow={id:string;name:string;author:string;created_at:string};
type HistoryRow={snapshot:string;saved_at:string;saved_by:string};
const displayDate=(date:string)=>date?new Date(date+'T12:00:00Z').toLocaleDateString('fr-FR'):'—';
export default function Page(){return <AccountGate>{account=><Vgp account={account}/>}</AccountGate>}
function Vgp({account}:{account:Account}){
 const {meta}=useHubMeta(),{askConfirm,confirmation}=useConfirmation();
 const [records,setRecords]=useState<VgpRecord[]|null>(null),[error,setError]=useState('');
 const [kind,setKind]=useState<'control'|'observation'>('control'),[query,setQuery]=useState(''),[domain,setDomain]=useState(''),[filter,setFilter]=useState('');
 const [edit,setEdit]=useState<VgpRecord|null>(null),[baseline,setBaseline]=useState(''),[files,setFiles]=useState<FileRow[]>([]),[history,setHistory]=useState<HistoryRow[]>([]);
 const [busy,setBusy]=useState(false),[detailError,setDetailError]=useState(''),[loadingDetail,setLoadingDetail]=useState(false);
 const sequence=useRef(0);
 const canEdit=account.role==='admin'||account.role==='editor'&&!!meta.editableTeams?.includes('qsse');
 const dirty=!!edit&&JSON.stringify(edit)!==baseline;
 const today=todayParis();
 async function load(){try{const data=await hubRequest('/api/vgp');setRecords(data.records);setError('')}catch(e){setError((e as Error).message)}}
 async function open(id:string){
  const request=++sequence.current;setLoadingDetail(true);
  try{
   const data=await hubRequest('/api/vgp?id='+encodeURIComponent(id));
   if(request!==sequence.current)return;
   setEdit(data.record);setBaseline(JSON.stringify(data.record));setFiles(data.files);setHistory(data.history);setDetailError('');
   window.history.replaceState(null,'','/vgp?id='+encodeURIComponent(id));
  }catch(e){setError((e as Error).message)}finally{if(request===sequence.current)setLoadingDetail(false)}
 }
 useEffect(()=>{void load();const id=new URLSearchParams(location.search).get('id');if(id)void open(id)},[]);
 useEffect(()=>{
  if(!dirty)return;
  const prevent=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
  window.addEventListener('beforeunload',prevent);return()=>window.removeEventListener('beforeunload',prevent);
 },[dirty]);
 async function close(){if(busy)return;if(dirty&&!await askConfirm('Abandonner les modifications non enregistrées ?'))return;sequence.current++;setEdit(null);window.history.replaceState(null,'','/vgp')}
 function create(){const record=blankVgp(kind);setEdit(record);setBaseline(JSON.stringify(record));setFiles([]);setHistory([]);setDetailError('')}
 function patch(field:keyof VgpRecord,value:string|number|null){setEdit(record=>record&&({...record,[field]:value}))}
 async function save(operation='save'){
  if(!edit)return;setBusy(true);setDetailError('');
  try{
   const result=await hubRequest('/api/vgp',{operation,id:edit.id,revision:edit.revision,data:edit});
   await open(result.id);await load();
   if(operation==='ticket')location.assign('/tickets?id='+encodeURIComponent(result.ticketId));
  }catch(e){setDetailError((e as Error).message)}finally{setBusy(false)}
 }
 async function upload(file?:File){
  if(!file||!edit)return;setBusy(true);setDetailError('');
  try{
   const form=new FormData();form.set('recordId',edit.id);form.set('file',file);
   const response=await fetch('/api/vgp/files',{method:'POST',body:form});const result=await response.json() as {error?:string};
   if(!response.ok)throw Error(result.error||'Dépôt impossible.');await open(edit.id);
  }catch(e){setDetailError((e as Error).message)}finally{setBusy(false)}
 }
 const scoped=(records||[]).filter(record=>record.kind===kind);
 const domains=[...new Set(scoped.map(record=>record.domain).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr'));
 const filtered=useMemo(()=>scoped.filter(record=>(!domain||record.domain===domain)&&(!filter||vgpTiming(record,today)===filter)&&
  (record.title+' '+record.location+' '+record.reference+' '+record.description+' '+record.provider).toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')))
  .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title,'fr')),[records,kind,domain,filter,query,today]);
 const list=useListPage(filtered,[kind,domain,filter,query].join('|'),50);
 function field(key:keyof VgpRecord,label:string,type='text'){
  if(!edit)return null;
  return <label key={key}>{label}{type==='textarea'?<textarea rows={4} maxLength={10000} value={String(edit[key]||'')} onChange={e=>patch(key,e.target.value)}/>
   :<input type={type} maxLength={key==='title'?300:10000} value={String(edit[key]||'')} onChange={e=>patch(key,e.target.value)}/>}</label>;
 }
 return <HubFrame active="VGP" teamId="qsse" className="vgp-workspace">
  <header className="vgp-heading"><div><span className="vgp-eyebrow">PRÉVENTION · SUIVI DES CONTRÔLES</span><h1><ShieldCheck/> VGP et contrôles périodiques</h1><p>Organiser les vérifications, conserver les rapports et suivre les écarts.</p></div>
   {canEdit&&<button className="primary" disabled={loadingDetail} onClick={create}><Plus size={17}/>{kind==='control'?'Ajouter un contrôle':'Ajouter une observation'}</button>}
  </header>
  <nav className="vgp-tabs" aria-label="Registre VGP">{([['control','Contrôles'],['observation','Observations']] as const).map(([value,label])=><button key={value} aria-pressed={kind===value} onClick={()=>{setKind(value);setDomain('');setFilter('');setQuery('')}}>{label}<span>{records?.filter(record=>record.kind===value).length??'—'}</span></button>)}</nav>
  <div className="vgp-stats">{[['En retard','À rattraper'],['Sous 30 jours','À anticiper'],['À planifier','Échéance à renseigner'],[kind==='control'?'À jour':'Levée',kind==='control'?'Échéance future':'Observations levées']].map(([status,label])=><button key={status} data-status={status} aria-pressed={filter===status} onClick={()=>setFilter(filter===status?'':status)}><span>{label}</span><strong>{scoped.filter(record=>vgpTiming(record,today)===status).length}</strong><small>{status}</small></button>)}</div>
  <div className="vgp-filters"><label className="vgp-search"><Search size={17}/><span className="sr-only">Rechercher</span><input placeholder="Équipement, site, référence, prestataire…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
   <label><span className="sr-only">Domaine</span><select value={domain} onChange={e=>setDomain(e.target.value)}><option value="">Tous les domaines</option>{domains.map(value=><option key={value}>{value}</option>)}</select></label>
   <label><span className="sr-only">Suivi</span><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Tous les états</option>{['En retard','Sous 30 jours','À planifier','À jour',...(kind==='observation'?['Levée']:[])].map(value=><option key={value}>{value}</option>)}</select></label>
  </div>
  {error&&<p role="alert" className="error">{error} <button className="outline" onClick={()=>void load()}>Réessayer</button></p>}
  {loadingDetail&&<p role="status">Ouverture de la fiche…</p>}
  {!records&&!error?<p role="status">Chargement du registre…</p>:<>
   <div className="vgp-table-wrap"><table className="vgp-table"><thead><tr><th>Équipement / observation</th><th>Domaine</th><th>{kind==='control'?'Dernier contrôle':'Date source'}</th><th>Échéance</th><th>Prévu le</th><th>Suivi</th><th><span className="sr-only">Ouvrir</span></th></tr></thead><tbody>{list.rows.map(record=><tr key={record.id}>
    <td><button className="vgp-record-link" disabled={loadingDetail} onClick={()=>void open(record.id)}>{record.title}</button><small>{record.location||record.provider||record.reference}{kind==='observation'&&' · '+record.sourceSheet}</small></td><td>{record.domain}</td><td>{displayDate(record.lastDate)}</td><td>{displayDate(record.due)}</td><td>{displayDate(record.plannedDate)}</td><td><span className="vgp-badge" data-status={vgpTiming(record,today)}>{vgpTiming(record,today)}</span>{kind==='observation'&&<small>{record.status}</small>}</td><td><button className="vgp-open" disabled={loadingDetail} onClick={()=>void open(record.id)} aria-label={'Ouvrir '+record.title}><ArrowRight size={18}/></button></td>
   </tr>)}</tbody></table>{!filtered.length&&<p className="vgp-empty">Aucun résultat pour ces filtres.</p>}</div>
   <ListPagination page={list.page} pages={list.pages} total={filtered.length} onChange={list.setPage}/>
  </>}
  <p className="vgp-source-note">Les périodicités et échéances importées reprennent le classeur de suivi. Une intervention prévue conserve l’échéance initiale jusqu’à sa mise à jour.</p>
  <Dialog open={!!edit} onOpenChange={value=>{if(!value)void close()}}><DialogContent className="vgp-dialog" showCloseButton={!busy}>
   <DialogTitle>{edit?.title|| (kind==='control'?'Nouveau contrôle':'Nouvelle observation')}</DialogTitle><DialogDescription>Échéances, suivi, rapports et historique de la fiche.</DialogDescription>
   {edit&&<>{detailError&&<p className="error" role="alert">{detailError}</p>}
    <div className="vgp-detail-scroll"><fieldset disabled={!canEdit||busy} className="vgp-form">
     {field('title','Désignation')}{field('domain','Domaine')}
     {edit.kind==='observation'&&<label className="vgp-wide">Contrôle associé<select value={edit.controlId||''} onChange={e=>patch('controlId',e.target.value)}><option value="">À rattacher</option>{(records||[]).filter(record=>record.kind==='control').map(record=><option key={record.id} value={record.id}>{record.domain} · {record.title}</option>)}</select></label>}{field('location','Site / localisation')}{field('reference','Référence équipement / rapport')}
     {field('provider','Entreprise de vérification')}
     <label>Pilote du suivi<select value={edit.pilotId} onChange={e=>patch('pilotId',e.target.value)}><option value="">À attribuer</option>{meta.users.map(user=><option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label>
     {field('lastDate',edit.kind==='control'?'Dernière vérification':'Date du relevé / source','date')}
     <label>Périodicité (mois)<input type="number" min="1" max="240" value={edit.months??''} onChange={e=>patch('months',e.target.value?Number(e.target.value):null)}/></label>
     {field('due','Échéance de contrôle / traitement','date')}{field('plannedDate','Intervention prévue le','date')}
     {edit.kind==='control'&&<div className="vgp-wide"><button type="button" className="outline" disabled={!nextVgpDate(edit.lastDate,edit.months)} onClick={()=>patch('due',nextVgpDate(edit.lastDate,edit.months))}><CalendarClock size={15}/> Calculer depuis le dernier contrôle</button></div>}
     <label>Caractère réglementaire<select value={edit.regulatory} onChange={e=>patch('regulatory',e.target.value)}><option value="">Non renseigné</option><option>Oui</option><option>Non</option></select></label>
     {edit.kind==='observation'&&<label>Traitement de l’observation<select value={edit.status} onChange={e=>patch('status',e.target.value)}>{vgpStatuses.map(value=><option key={value}>{value}</option>)}</select></label>}
     <div className="vgp-wide">{field('description',edit.kind==='control'?'Objet du contrôle':'Non-conformité / observation','textarea')}</div>
     <div className="vgp-wide">{field('note','Suivi, actions et justification de levée','textarea')}</div>
    </fieldset>
    {edit.kind==='control'&&<section className="vgp-detail-section"><h3><AlertTriangle size={17}/> Observations associées</h3>{(records||[]).filter(record=>record.controlId===edit.id&&record.kind==='observation').map(record=><button key={record.id} className="vgp-file" disabled={busy||dirty} onClick={()=>void open(record.id)}>{record.title} · {record.status}<ArrowRight size={15}/></button>)}{!(records||[]).some(record=>record.controlId===edit.id&&record.kind==='observation')&&<p>Aucune observation rattachée à ce contrôle.</p>}</section>}
    <section className="vgp-detail-section"><h3><Ticket size={17}/> Ticket de suivi</h3>{edit.ticketId?<a className="outline" href={'/tickets?id='+encodeURIComponent(edit.ticketId)}>Ouvrir le ticket lié <ArrowRight size={15}/></a>:canEdit?<button className="outline" disabled={busy||dirty||!edit.id} onClick={()=>void save('ticket')}>Créer un ticket de suivi</button>:<p>Aucun ticket lié.</p>}{canEdit&&(!edit.id||dirty)&&<small>Enregistrez la fiche pour ouvrir son ticket.</small>}</section>
    <section className="vgp-detail-section"><h3><FileText size={17}/> Rapports et preuves PDF</h3>{files.map(file=><a className="vgp-file" key={file.id} href={'/api/vgp/files?id='+encodeURIComponent(file.id)} target="_blank" rel="noreferrer"><FileText size={16}/><span>{file.name}<small>{file.author} · {new Date(file.created_at).toLocaleDateString('fr-FR')}</small></span><ArrowRight size={15}/></a>)}{!files.length&&<p>Aucun PDF déposé.</p>}{canEdit&&<label className="vgp-upload">Déposer un rapport PDF · 15 Mo maximum<input type="file" accept="application/pdf,.pdf" disabled={busy||dirty||!edit.id} onChange={e=>{const file=e.target.files?.[0];e.target.value='';void upload(file)}}/></label>}</section>
    {!!Object.keys(edit.raw||{}).length&&<details className="vgp-detail-section"><summary>Données du classeur · {edit.sourceSheet}, ligne {edit.sourceRow}</summary><dl className="vgp-source-data">{Object.entries(edit.raw).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details>}
    {!!history.length&&<details className="vgp-detail-section"><summary>Historique des modifications</summary>{history.map((entry,index)=>{const old=JSON.parse(entry.snapshot) as VgpRecord;return <details key={index}><summary>{new Date(entry.saved_at).toLocaleString('fr-FR')} · {entry.saved_by}</summary><p>{old.title||'Création de la fiche'}</p><p>Échéance précédente {displayDate(old.due)} · Prévu le {displayDate(old.plannedDate)}</p><p>{old.note}</p></details>})}</details>}
    </div>
    <footer className="vgp-footer"><button className="outline" disabled={busy} onClick={()=>void close()}>Fermer</button><span>{dirty?'Modifications à enregistrer':''}</span>{canEdit&&<button className="primary" disabled={busy} onClick={()=>void save()}>{busy?'Enregistrement…':'Enregistrer la fiche'}</button>}</footer>
   </>}
  </DialogContent></Dialog>{confirmation}
 </HubFrame>;
}

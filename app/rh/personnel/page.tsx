'use client';
import {useCallback,useEffect,useMemo,useState,type FormEvent} from 'react';
import {AccountGate} from '@/components/account-gate';
import {HubFrame} from '@/components/hub-layout';
import {ArrowUpRight,BriefcaseBusiness,CheckCircle2,ChevronRight,FileBadge,LockKeyhole,Plus,RefreshCw,Search,ShieldAlert,ShieldCheck,UserRound,UsersRound,UserRoundCheck,UserRoundX} from 'lucide-react';
import './style.css';

type Person={id:string;first_name:string;last_name:string;service:string;active:number;revision:number;created_at:string;updated_at:string};
type Summary={total:number;valid:number;expired:number;other:number;dueSoon:number};
type Directory={people:Person[];summaries:Record<string,Summary>;canEdit:boolean};
const EMPTY:Summary={total:0,valid:0,expired:0,other:0,dueSoon:0};
const normalize=(v:string)=>v.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export default function Page(){return <AccountGate>{()=><PersonnelDirectory/>}</AccountGate>}
function PersonnelDirectory(){
 const [data,setData]=useState<Directory|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const [query,setQuery]=useState(''),[status,setStatus]=useState<'active'|'inactive'|'all'>('active'),[service,setService]=useState('');
 const [selectedId,setSelectedId]=useState(''),[adding,setAdding]=useState(false);
 const [newPerson,setNewPerson]=useState({firstName:'',lastName:'',service:''});
 const [form,setForm]=useState({firstName:'',lastName:'',service:''}),[confirmation,setConfirmation]=useState('');
 const [confirmDeactivate,setConfirmDeactivate]=useState(false);
 const load=useCallback(async(preferred?:string)=>{
  try{
   const response=await fetch('/api/habilitations?scope=directory',{cache:'no-store'});
   const payload=await response.json() as Directory&{error?:string};
   if(!response.ok)throw Error(payload.error||'Chargement impossible.');
   setData(payload);setError('');setSelectedId(previous=>preferred||previous||payload.people.find(p=>p.active)?.id||payload.people[0]?.id||'');
  }catch(e){setError((e as Error).message)}
 },[]);
 useEffect(()=>{void load()},[load]);
 const people=data?.people||[];
 const selected=people.find(p=>p.id===selectedId)||null;
 useEffect(()=>{if(selected)setForm({firstName:selected.first_name,lastName:selected.last_name,service:selected.service})},[selected?.id,selected?.revision]);
 const services=useMemo(()=>[...new Set(people.map(p=>p.service).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr')),[people]);
 const filtered=useMemo(()=>people.filter(p=>{
  if(status==='active'&&!p.active||status==='inactive'&&p.active)return false;
  if(service&&p.service!==service)return false;
  return !query.trim()||normalize([p.first_name,p.last_name,p.service].join(' ')).includes(normalize(query.trim()));
 }),[people,query,status,service]);
 const activeCount=people.filter(p=>p.active).length;
 const qualifications=Object.values(data?.summaries||{});
 const validated=qualifications.reduce((n,x)=>n+x.valid,0),expired=qualifications.reduce((n,x)=>n+x.expired,0);
 const canEdit=!!data?.canEdit;
 async function request(body:Record<string,unknown>,preferred?:string){
  setBusy(true);setError('');setNotice('');
  try{
   const response=await fetch('/api/habilitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
   const result=await response.json() as {id?:string;error?:string};
   if(!response.ok)throw Error(result.error||'Enregistrement impossible.');
   await load(preferred||result.id);
   setNotice('Fiche du personnel enregistrée.');
   return true;
  }catch(e){setError((e as Error).message);return false}
  finally{setBusy(false)}
 }
 async function create(e:FormEvent){e.preventDefault();const done=await request({action:'create-person',...newPerson});if(done){setAdding(false);setNewPerson({firstName:'',lastName:'',service:''});setStatus('all');setService('');setQuery('')}}
 async function update(e:FormEvent){e.preventDefault();if(!selected)return;await request({action:'update-person',personId:selected.id,revision:selected.revision,...form,active:!!selected.active},selected.id)}
 async function changeActive(){
  if(!selected)return;
  const closing=!!selected.active;
  if(closing&&confirmation!=='SUPPRIMER')return;
  const ok=await request(closing?{action:'deactivate-person',personId:selected.id,revision:selected.revision,confirmation:'SUPPRIMER'}:{action:'update-person',personId:selected.id,revision:selected.revision,...form,active:true},selected.id);
  if(ok){setConfirmDeactivate(false);setConfirmation('');setStatus('all')}
 }
 return <HubFrame active="Personnel" teamId="rh"><div className="rh-directory">
  <nav className="rh-directory-breadcrumb" aria-label="Emplacement"><a href="/unites?team=rh">Ressources humaines</a><ChevronRight size={14}/><span>Personnel</span></nav>
  <header className="rh-directory-hero">
   <div><div className="rh-directory-eyebrow"><UsersRound size={15}/> RÉPERTOIRE RH · POLYTECHS</div><h1>Liste du personnel</h1><p>Un seul dossier par collaborateur, relié à ses autorisations et habilitations. Toutes les mises à jour sont partagées entre les deux modules.</p></div>
   {canEdit&&<button type="button" className="rh-directory-primary" onClick={()=>{setAdding(x=>!x);setConfirmDeactivate(false)}}><Plus size={18}/> Ajouter un salarié</button>}
  </header>
  {error&&<p className="rh-directory-message rh-directory-error" role="alert">{error}</p>}
  {notice&&<p className="rh-directory-message rh-directory-success" role="status">{notice}</p>}
  {!data?<section className="rh-directory-panel rh-directory-restricted">
   <LockKeyhole size={32}/><h2>{error==='Accès au service RH nécessaire.'?'Accès réservé au service RH':'Répertoire indisponible'}</h2>
   <p>{error==='Accès au service RH nécessaire.'?'Les fiches du personnel sont confidentielles. Un administrateur peut vous attribuer un accès au service RH depuis « Membres et accès ».':'Vérifiez votre connexion puis rechargez le répertoire.'}</p>
   <button type="button" className="rh-directory-secondary" onClick={()=>void load()}><RefreshCw size={16}/> Réessayer</button>
  </section>:<>
   <div className="rh-directory-metrics">
    <div className="rh-directory-metric"><UsersRound size={20}/><strong>{people.length}</strong><span>Fiches du personnel</span></div>
    <div className="rh-directory-metric"><UserRoundCheck size={20}/><strong>{activeCount}</strong><span>Collaborateurs actifs</span></div>
    <div className="rh-directory-metric"><ShieldCheck size={20}/><strong>{validated}</strong><span>Habilitations valides</span></div>
    <div className={'rh-directory-metric'+(expired?' rh-directory-metric-alert':'')}><ShieldAlert size={20}/><strong>{expired}</strong><span>Habilitations expirées</span></div>
   </div>
   {adding&&canEdit&&<form className="rh-directory-panel rh-directory-add" onSubmit={create}>
    <div><h2>Nouveau collaborateur</h2><p>Cette fiche sera également disponible dans la gestion des habilitations.</p></div>
    <div className="rh-directory-form-grid">
     <label>Prénom<input required maxLength={80} autoFocus value={newPerson.firstName} onChange={e=>setNewPerson(x=>({...x,firstName:e.target.value}))}/></label>
     <label>Nom<input required maxLength={80} value={newPerson.lastName} onChange={e=>setNewPerson(x=>({...x,lastName:e.target.value}))}/></label>
     <label>Service / atelier<input maxLength={100} value={newPerson.service} onChange={e=>setNewPerson(x=>({...x,service:e.target.value}))}/></label>
    </div>
    <div className="rh-directory-form-actions"><button type="button" className="rh-directory-secondary" onClick={()=>setAdding(false)}>Annuler</button><button className="rh-directory-primary" disabled={busy}>{busy?'Enregistrement…':'Créer la fiche'}</button></div>
   </form>}
   <div className="rh-directory-main">
    <section className="rh-directory-panel rh-directory-list">
     <div className="rh-directory-list-heading"><div><h2>Collaborateurs</h2><p>{filtered.length} résultat{filtered.length>1?'s':''}</p></div><button type="button" className="rh-directory-refresh" aria-label="Actualiser la liste" title="Actualiser la liste" onClick={()=>void load()}><RefreshCw size={18}/></button></div>
     <div className="rh-directory-filters">
      <label className="rh-directory-search"><Search size={17}/><input aria-label="Rechercher dans le personnel" placeholder="Nom, prénom, service…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <select aria-label="Filtrer par statut" value={status} onChange={e=>setStatus(e.target.value as typeof status)}><option value="active">Actifs</option><option value="all">Tous les salariés</option><option value="inactive">Inactifs</option></select>
      <select aria-label="Filtrer par service" value={service} onChange={e=>setService(e.target.value)}><option value="">Tous les services</option>{services.map(s=><option key={s} value={s}>{s}</option>)}</select>
     </div>
     <div className="rh-directory-scroll">
      {filtered.map(p=>{const summary=data.summaries[p.id]||EMPTY;return <button type="button" key={p.id} className={'rh-directory-person'+(selectedId===p.id?' is-selected':'')} aria-pressed={selectedId===p.id} onClick={()=>{setSelectedId(p.id);setConfirmation('');setConfirmDeactivate(false)}}>
       <span className="rh-directory-avatar">{p.first_name.slice(0,1)}{p.last_name.slice(0,1)}</span>
       <span className="rh-directory-person-label"><strong>{p.last_name} {p.first_name}</strong><small>{p.service||'Service à renseigner'}</small></span>
       <span className="rh-directory-person-stats">{!p.active?<span className="rh-directory-status inactive">Inactif</span>:summary.expired?<span className="rh-directory-status warning">{summary.expired} expirée{summary.expired>1?'s':''}</span>:summary.valid?<span className="rh-directory-status valid">{summary.valid} valide{summary.valid>1?'s':''}</span>:<span className="rh-directory-status neutral">À compléter</span>}</span>
       <ChevronRight size={18} className="rh-directory-chevron"/>
      </button>})}
      {!filtered.length&&<p className="rh-directory-empty">{people.length?'Aucun salarié ne correspond aux filtres.':'Aucun collaborateur enregistré. Ajoutez la première fiche pour commencer.'}</p>}
     </div>
    </section>
    <section className="rh-directory-panel rh-directory-details">
     {selected?<><div className="rh-directory-person-header"><span className="rh-directory-avatar large">{selected.first_name.slice(0,1)}{selected.last_name.slice(0,1)}</span><div><span className="rh-directory-meta">FICHE COLLABORATEUR</span><h2>{selected.first_name} {selected.last_name}</h2><p>{selected.service||'Service non renseigné'}</p></div><span className={'rh-directory-status '+(selected.active?'valid':'inactive')}>{selected.active?'Actif':'Inactif'}</span></div>
      <div className="rh-directory-person-summary">
       <div><strong>{(data.summaries[selected.id]||EMPTY).total}</strong><span>Habilitations enregistrées</span></div>
       <div><strong>{(data.summaries[selected.id]||EMPTY).valid}</strong><span>Valides</span></div>
       <div><strong>{(data.summaries[selected.id]||EMPTY).dueSoon}</strong><span>Échéances à 30 jours</span></div>
      </div>
      <a className="rh-directory-action" href={'/habilitations?person='+encodeURIComponent(selected.id)}><span><FileBadge size={21}/><span><strong>Gérer les habilitations</strong><small>Autorisations de conduite, CACES, justificatifs et badge QR</small></span></span><ArrowUpRight size={20}/></a>
      {canEdit&&<form className="rh-directory-edit" onSubmit={update}><div className="rh-directory-form-title"><h3>Informations du salarié</h3><small>Modifications synchronisées avec les habilitations.</small></div><div className="rh-directory-form-grid">
       <label>Prénom<input required maxLength={80} disabled={busy} value={form.firstName} onChange={e=>setForm(x=>({...x,firstName:e.target.value}))}/></label>
       <label>Nom<input required maxLength={80} disabled={busy} value={form.lastName} onChange={e=>setForm(x=>({...x,lastName:e.target.value}))}/></label>
       <label>Service / atelier<input maxLength={100} disabled={busy} value={form.service} onChange={e=>setForm(x=>({...x,service:e.target.value}))}/></label>
      </div><div className="rh-directory-form-actions"><button className="rh-directory-secondary" disabled={busy}>Enregistrer les modifications</button></div></form>}
      {canEdit&&<div className="rh-directory-lifecycle"><h3>Statut de la fiche</h3><p>{selected.active?'Lorsqu’un collaborateur quitte l’entreprise, désactivez sa fiche : son QR code ne sera plus utilisable et son historique sera conservé.':'Réactiver la fiche créera un nouveau badge QR. Les anciennes habilitations devront être revérifiées.'}</p>
       {!confirmDeactivate?<button type="button" className={selected.active?'rh-directory-danger':'rh-directory-secondary'} onClick={()=>{setConfirmDeactivate(true);setConfirmation('')}}>{selected.active?<><UserRoundX size={17}/> Désactiver la fiche</>:<><CheckCircle2 size={17}/> Réactiver la fiche</>}</button>:
       <div className="rh-directory-confirm"><p>{selected.active?'Tapez SUPPRIMER pour désactiver ce collaborateur et invalider son badge.':'Confirmer la réactivation de ce collaborateur ?'}</p>{!!selected.active&&<input aria-label="Confirmation de désactivation" placeholder="SUPPRIMER" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/>}<div className="rh-directory-form-actions"><button type="button" className="rh-directory-secondary" onClick={()=>setConfirmDeactivate(false)}>Annuler</button><button type="button" className={selected.active?'rh-directory-danger':'rh-directory-primary'} disabled={busy||!!selected.active&&confirmation!=='SUPPRIMER'} onClick={()=>void changeActive()}>{selected.active?'Confirmer la désactivation':'Réactiver'}</button></div></div>}
      </div>}
     </>:<div className="rh-directory-restricted"><UserRound size={38}/><h2>Aucun salarié sélectionné</h2><p>Sélectionnez une personne dans la liste pour consulter son dossier RH et ses habilitations.</p></div>}
    </section>
   </div>
   <footer className="rh-directory-footnote"><BriefcaseBusiness size={16}/> Répertoire réservé au personnel autorisé RH · Aucun justificatif médical n’est affiché dans cette liste.</footer>
  </>}
 </div></HubFrame>;
}

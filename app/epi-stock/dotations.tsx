'use client';
import {useConfirmation} from '@/components/use-confirmation';
import {useEffect,useState} from 'react';
import type {Account} from '@/components/account-gate';
import {blank,normalize,validate,flows,type QRecord} from '@/lib/workflows';
import type {Product} from './types';

const fresh=():QRecord=>({...blank,kind:'EPI',domain:'Sécurité',status:'À remettre',title:'',details:{equipment:'',reference:'',assignee:'',quantity:'',date:''}});
export function Dotations({account,products,onStockChange,canEdit}:{account:Account;products:Product[];onStockChange:()=>Promise<void>;canEdit:boolean}){const {askConfirm,confirmation}=useConfirmation();
  const [records,setRecords]=useState<QRecord[]>([]),[edit,setEdit]=useState<QRecord|null>(null),[base,setBase]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[query,setQuery]=useState(''),[page,setPage]=useState(0);
  const dirty=canEdit&&!!edit&&JSON.stringify(edit)!==base;useEffect(()=>{if(!dirty)return;const guard=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard)},[dirty]);
  async function load(){try{const response=await fetch('/api/records');const data=await response.json() as {records?:QRecord[];error?:string};if(!response.ok)throw Error(data.error);setRecords((data.records||[]).map(normalize).filter(r=>r.kind==='EPI'));setError('')}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  useEffect(()=>{const controller=new AbortController();fetch('/api/records',{signal:controller.signal}).then(async response=>{const data=await response.json() as {records?:QRecord[];error?:string};if(!response.ok)throw Error(data.error);setRecords((data.records||[]).map(normalize).filter(r=>r.kind==='EPI'))}).catch(e=>{if(!controller.signal.aborted)setError((e as Error).message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[]);
  const filtered=records.filter(r=>[r.title,r.details.equipment,r.details.reference,r.details.assignee].join(' ').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr')));
  const pageCount=Math.max(1,Math.ceil(filtered.length/10)),currentPage=Math.min(page,pageCount-1),visible=filtered.slice(currentPage*10,currentPage*10+10);
  function open(record:QRecord){const copy={...record,details:{...record.details}};setEdit(copy);setBase(JSON.stringify(copy));setError('');setNotice('')}
  async function close(){if(busy)return;if(account.role!=='reader'&&edit&&JSON.stringify(edit)!==base&&!await askConfirm('Fermer sans enregistrer les modifications ?'))return;setEdit(null);setError('')}
  function setField(key:string,value:string){if(edit)setEdit({...edit,details:{...edit.details,[key]:value}})}
  function chooseProduct(code:string){const product=products.find(p=>p.code===code);if(edit&&product)setEdit({...edit,title:edit.id?edit.title:'Dotation · '+product.name,details:{...edit.details,equipment:product.name,reference:product.code}})}
  async function save(event:React.FormEvent){event.preventDefault();if(!edit||account.role==='reader')return;const issues=validate(edit,records);if(issues.length){setError(issues.join(' '));return}setBusy(true);setError('');try{const response=await fetch('/api/records',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(edit)});const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error);setEdit(null);setNotice('Dotation enregistrée.');await Promise.all([load(),onStockChange()])}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const issued=!!edit?.id&&records.some(r=>r.id===edit.id&&r.status!=='À remettre');
  return <section className="stock-card dotations-view">
    <div className="stock-section-heading"><div><h2>Dotations EPI</h2><p>Le passage à « En service » débite automatiquement le stock inventorié. Une fiche « À remettre » réserve seulement la remise.</p></div>{canEdit&&<button className="primary" onClick={()=>open(fresh())}>Nouvelle dotation</button>}</div>
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
    {edit?<form className="dotation-form" onSubmit={save}><div className="dotation-form-head"><h3>{account.role==='reader'?'Consulter la dotation':edit.id?'Modifier la dotation':'Nouvelle dotation'}</h3><button type="button" className="outline" onClick={close}>Fermer</button></div>
      <fieldset className="stock-form-grid" disabled={!canEdit||busy}>
        <label>Article du catalogue<select disabled={issued} value={products.some(p=>p.code===edit.details.reference)?edit.details.reference:''} onChange={e=>chooseProduct(e.target.value)}><option value="">Choisir une référence</option>{products.filter(p=>p.catalog_status!=='Inactif'||p.code===edit.details.reference).map(p=><option key={p.code} value={p.code}>{p.family} · {p.name} · {p.code}</option>)}</select></label>
        <label>Intitulé<input required maxLength={200} value={edit.title} onChange={e=>setEdit({...edit,title:e.target.value})}/></label>
        <label>Type d’EPI<input required maxLength={5000} value={edit.details.equipment||''} onChange={e=>setField('equipment',e.target.value)}/></label>
        <label>Référence<input disabled={issued} maxLength={5000} value={edit.details.reference||''} onChange={e=>setField('reference',e.target.value)}/></label>
        <label>Bénéficiaire ou service<input disabled={issued} required maxLength={5000} value={edit.details.assignee||''} onChange={e=>setField('assignee',e.target.value)}/></label>
        <label>Quantité remise<input disabled={issued} type="number" min="1" step="1" required value={edit.details.quantity||''} onChange={e=>setField('quantity',e.target.value)}/></label>
        <label>Statut<select value={edit.status} onChange={e=>setEdit({...edit,status:e.target.value})}>{flows.EPI.states.filter(s=>issued?s!=='À remettre':s==='À remettre'||s==='En service').map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Date de remise<input type="date" value={edit.details.date||''} onChange={e=>setField('date',e.target.value)}/></label>
        <label>Responsable du suivi<input maxLength={150} value={edit.owner} onChange={e=>setEdit({...edit,owner:e.target.value})}/></label>
        <label>Prochain contrôle / renouvellement<input type="date" value={edit.due} onChange={e=>setEdit({...edit,due:e.target.value})}/></label>
        <label className="wide">Notes<textarea maxLength={5000} value={edit.description} onChange={e=>setEdit({...edit,description:e.target.value})}/></label>
      </fieldset>{canEdit&&<button className="primary" disabled={busy}>{busy?'Enregistrement…':'Enregistrer la dotation'}</button>}<p>Une remise en service exige une référence active et inventoriée, ainsi qu’un solde suffisant. Après la remise, la référence, le bénéficiaire et la quantité sont figés. Le retrait ne remet pas un EPI usagé en stock.</p>
    </form>:<><label className="dotations-search">Rechercher une dotation<input value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="Bénéficiaire, EPI ou code…"/></label>
      {loading?<p>Chargement…</p>:visible.length?<div className="dotation-list">{visible.map(r=><article key={r.id}><div><strong>{r.title}</strong><small>{r.details.assignee} · {r.details.reference||r.details.equipment} · quantité {r.details.quantity}</small></div><span>{r.status}</span><button className="outline" onClick={()=>open(r)}>{account.role==='reader'?'Consulter':'Ouvrir'}</button></article>)}</div>:<div className="stock-pick"><h3>Aucune dotation enregistrée</h3><p>Les références du catalogue sont dans l’onglet Stock. Les remises aux personnes apparaîtront ici après leur saisie.</p></div>}
      {pageCount>1&&<nav className="stock-pagination" aria-label="Pages des dotations"><button disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Précédent</button><span>Page {currentPage+1} / {pageCount}</span><button disabled={currentPage===pageCount-1} onClick={()=>setPage(currentPage+1)}>Suivant</button></nav>}</>}
  {confirmation}</section>
}

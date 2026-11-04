'use client';
import {useCallback,useEffect,useState} from 'react';
import {EpiQrScanner} from '@/components/epi-qr-scanner';
import {AccountGate,type Account} from '@/components/account-gate';
import {ArrowDownToLine,ArrowUpFromLine,ClipboardCheck,Package,ScanLine} from 'lucide-react';
import './scan.css';

type Product={code:string;supplier_reference:string;family:string;name:string;specifics:string;catalog_status:string;quantity:number|null;minimum:number|null;location:string;has_photo:number;photo_updated_at:string|null};
type ScanData={product:Product;canEdit:boolean};
export default function ScanPage(){return <AccountGate epiScan>{(account,logout)=> <StockScan account={account} logout={logout}/>}</AccountGate>}

function StockScan({account,logout}:{account:Account;logout:()=>void}){
  const [code,setCode]=useState(()=>typeof window==='undefined'?'':new URLSearchParams(window.location.search).get('code')||'');
  const [scanVersion,setScanVersion]=useState(0);
  const [scanning,setScanning]=useState(false);
  const closeScanner=useCallback(()=>setScanning(false),[]);
  const scanned=useCallback((nextCode:string)=>{setScanning(false);setData(null);setError('');setNotice('');setLoading(true);setAmount('');setRecipient('');setNote('');setKind('inventaire');window.history.replaceState(null,'','/epi-stock/scan?code='+encodeURIComponent(nextCode));setCode(nextCode);setScanVersion(x=>x+1)},[]);
  const [data,setData]=useState<ScanData|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [kind,setKind]=useState<'inventaire'|'entree'|'sortie'>('inventaire'),[amount,setAmount]=useState(''),[recipient,setRecipient]=useState(''),[note,setNote]=useState('');
  const load=useCallback(async()=>{if(!code){setError('QR code incomplet : aucune référence EPI.');setLoading(false);return}try{const response=await fetch('/api/epi-stock/scan?code='+encodeURIComponent(code),{cache:'no-store'});const result=await response.json() as ScanData&{error?:string};if(!response.ok)throw Error(result.error||'Chargement impossible.');setData(result);setError('');setKind(current=>result.product.quantity===null?'inventaire':current)}catch(e){setData(null);setError((e as Error).message)}finally{setLoading(false)}},[code,scanVersion]);
  useEffect(()=>{void load()},[load]);
  async function save(event:React.FormEvent){event.preventDefault();if(!data?.canEdit||busy)return;setBusy(true);setError('');setNotice('');try{const response=await fetch('/api/epi-stock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:data.product.code,kind,amount:Number(amount),recipient,note})});const result=await response.json() as {error?:string};if(!response.ok)throw Error(result.error||'Enregistrement impossible.');await load();setAmount('');setRecipient('');setNote('');setNotice('Stock mis à jour pour '+data.product.name+'.')}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
  const product=data?.product;
  return <main className="epi-scan"><div className="epi-scan-shell"><header><img src="/polytechs-logo.png" alt="Polytechs" width="135" height="75"/><div><small>GESTION DES EPI</small><h1>Mettre à jour le stock</h1></div></header><div className="epi-scan-session"><span>Connecté : {account.displayName}</span><button type="button" onClick={logout}>Se déconnecter</button></div>
    <button className="epi-scan-next" type="button" disabled={busy||loading} onClick={()=>{if((amount||recipient||note)&&!window.confirm('Une saisie n’est pas enregistrée. L’abandonner pour scanner un autre EPI ?'))return;setScanning(true)}}><ScanLine size={20}/> Scanner un autre EPI</button>
    {scanning&&<EpiQrScanner onScan={scanned} onClose={closeScanner}/>}
    {loading?<section className="epi-scan-card" role="status">Chargement de l’EPI…</section>:<>
      {error&&<p className="epi-scan-error" role="alert">{error}</p>}{notice&&<p className="epi-scan-success" role="status">{notice}</p>}
      {product&&<section className="epi-scan-card"><div className="epi-scan-product"><div className="epi-scan-photo">{product.has_photo?<img src={'/api/epi-stock/photo?code='+encodeURIComponent(product.code)+'&v='+encodeURIComponent(product.photo_updated_at||'')} alt={'Photo de '+product.name}/>:<Package size={38} aria-hidden="true"/>}</div><div><span className="epi-scan-family">{product.family}</span><h2>{product.name}</h2><p>{product.specifics}</p><p><strong>Référence fournisseur :</strong> {product.supplier_reference||product.code}</p><code>Code QR permanent : {product.code}</code></div></div>
        <div className="epi-scan-balance"><span>Stock actuel</span><strong>{product.quantity===null?'Non inventorié':product.quantity}</strong>{product.minimum!==null&&<small>Seuil d’alerte : {product.minimum}</small>}{product.location&&<small>Emplacement : {product.location}</small>}</div>
        {data.canEdit?<form onSubmit={save}><h3>Mouvement de stock</h3><div className="epi-scan-kinds" role="group" aria-label="Type de mouvement"><button type="button" aria-pressed={kind==='inventaire'} onClick={()=>setKind('inventaire')}><ClipboardCheck size={17}/> Inventaire</button><button type="button" aria-pressed={kind==='entree'} onClick={()=>setKind('entree')} disabled={product.quantity===null||product.catalog_status==='Inactif'}><ArrowDownToLine size={17}/> Entrée</button><button type="button" aria-pressed={kind==='sortie'} onClick={()=>setKind('sortie')} disabled={product.quantity===null}><ArrowUpFromLine size={17}/> Sortie</button></div>
          <label>{kind==='inventaire'?'Quantité comptée':'Quantité du mouvement'}<input type="number" inputMode="numeric" min={kind==='inventaire'?0:1} max="1000000" step="1" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
          {kind==='sortie'&&<label>Bénéficiaire ou service<input required maxLength={150} value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>}
          <label>Motif / référence de pièce <span>(facultatif)</span><input maxLength={1000} value={note} onChange={e=>setNote(e.target.value)}/></label>
          <button className="epi-scan-submit" disabled={busy}>{busy?'Enregistrement…':'Enregistrer pour cet EPI'}</button></form>:<p className="epi-scan-error">Votre compte ne dispose pas du droit de modification du stock QSSE.</p>}
      </section>}
    </>}
  </div></main>;
}

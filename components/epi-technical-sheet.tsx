'use client';
import {useEffect,useRef,useState} from 'react';
import {FileText,Upload,Download,ExternalLink,Trash2} from 'lucide-react';
import './epi-technical-sheet.css';
type Sheet={name:string;size:number;version:string;author:string;updatedAt:string};
export function EpiTechnicalSheet({code,canManage=false}:{code:string;canManage?:boolean}){
 const [sheet,setSheet]=useState<Sheet|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const input=useRef<HTMLInputElement>(null),url='/api/epi-stock/technical-sheet?code='+encodeURIComponent(code);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setSheet(null);setError('');fetch(url+'&meta=1',{signal:controller.signal,cache:'no-store'}).then(async r=>{const d=await r.json() as {sheet:Sheet|null;error?:string};if(!r.ok)throw Error(d.error||'Chargement impossible.');if(!controller.signal.aborted)setSheet(d.sheet)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});return()=>controller.abort()},[url,reload]);
 async function mutate(file?:File){
  if(busy||loading)return;
  if(file&&(!file.name.toLowerCase().endsWith('.pdf')||!file.size||file.size>10*1024*1024)){setError('Choisissez un PDF de 10 Mo maximum.');return}
  if(!file&&!window.confirm('Supprimer la fiche technique PDF de cet EPI ?'))return;
  if(file&&sheet&&!window.confirm('Remplacer la fiche technique actuelle par « '+file.name+' » ?'))return;
  setBusy(true);setError('');setNotice('');
  try{const form=new FormData();form.set('code',code);form.set('version',sheet?.version||'');if(file)form.set('file',file);
   const response=await fetch('/api/epi-stock/technical-sheet',{method:file?'POST':'DELETE',...(file?{body:form}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({code,version:sheet?.version})})});
   const data=await response.json() as {error?:string};if(!response.ok)throw Error(data.error||'Enregistrement impossible.');setNotice(file?'Fiche technique enregistrée.':'Fiche technique supprimée.');setReload(v=>v+1);
  }catch(e){setError((e as Error).message)}finally{setBusy(false);if(input.current)input.current.value=''}
 }
 return <section className="epi-technical-sheet"><header><span className="epi-pdf-icon"><FileText size={23}/></span><div><h3>Fiche technique</h3><p>Documentation PDF de cet équipement</p></div></header>
  {loading?<p role="status">Chargement…</p>:<>{sheet?<div className="epi-pdf-info"><strong>{sheet.name}</strong><small>{(sheet.size/1024/1024).toLocaleString('fr-FR',{maximumFractionDigits:2})} Mo · ajouté le {new Date(sheet.updatedAt).toLocaleDateString('fr-FR')} par {sheet.author}</small><div className="epi-pdf-actions"><a href={url+'&v='+sheet.version} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/> Consulter le PDF</a><a href={url+'&download=1'}><Download size={16}/> Télécharger</a></div></div>:!error&&<p>Aucune fiche technique déposée.</p>}
  {canManage&&<div className="epi-pdf-actions"><input ref={input} type="file" accept="application/pdf,.pdf" aria-label="Choisir une fiche technique PDF" disabled={busy} onChange={e=>{const file=e.target.files?.[0];if(file)void mutate(file);e.target.value=''}} hidden/><button type="button" disabled={busy} onClick={()=>input.current?.click()}><Upload size={16}/>{busy?'Enregistrement…':sheet?'Remplacer le PDF':'Ajouter un PDF'}</button>{sheet&&<button type="button" disabled={busy} onClick={()=>void mutate()}><Trash2 size={16}/> Supprimer</button>}<small>PDF uniquement · 10 Mo maximum</small></div>}</>}
  {error&&<div role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={()=>setReload(v=>v+1)}>Recharger</button></div>}{notice&&<p role="status">{notice}</p>}
 </section>;
}

'use client';
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
import {ArrowLeft,Printer} from 'lucide-react';
import {AccountGate} from '@/components/account-gate';
import type {Product} from '../types';
import './labels.css';

type Label={code:string;reference:string;name:string;family:string;qr:string};
const perSheet=18;
export default function LabelsPage(){return <AccountGate>{()=> <Labels/>}</AccountGate>}

function Labels(){
  const [labels,setLabels]=useState<Label[]>([]),[loading,setLoading]=useState(true),[printing,setPrinting]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const controller=new AbortController();async function prepare(){try{
    const response=await fetch('/api/epi-stock',{signal:controller.signal,cache:'no-store'});
    const data=await response.json() as {products?:Product[];error?:string};
    if(!response.ok)throw Error(data.error||'Chargement du catalogue impossible.');
    const products=(data.products||[]).sort((a,b)=>a.family.localeCompare(b.family,'fr')||a.name.localeCompare(b.name,'fr')||a.code.localeCompare(b.code));
    const results=await Promise.all(products.map(async p=>({code:p.code,reference:p.supplier_reference||p.code,name:p.name,family:p.family,qr:await QRCode.toDataURL(window.location.origin+'/epi-stock/scan?code='+encodeURIComponent(p.code),{width:320,margin:2,errorCorrectionLevel:'M',color:{dark:'#143653',light:'#ffffff'}})})));
    if(!controller.signal.aborted){setLabels(results);setLoading(false)}
  }catch(e){if(!controller.signal.aborted){setError((e as Error).message);setLoading(false)}}}void prepare();return()=>controller.abort()},[]);
  async function printLabels(){setPrinting(true);try{await Promise.all(Array.from(document.querySelectorAll<HTMLImageElement>('.epi-label img')).map(img=>img.decode().catch(()=>{})));window.print()}finally{setPrinting(false)}}
  const pages=Array.from({length:Math.ceil(labels.length/perSheet)},(_,i)=>labels.slice(i*perSheet,(i+1)*perSheet));
  return <main className="epi-labels-page"><header className="epi-labels-toolbar"><div><a href="/epi-stock"><ArrowLeft size={17}/> Retour aux EPI</a><h1>Étiquettes QR des EPI</h1><p>Planche A4 de 18 étiquettes · 3 colonnes × 6 lignes · {labels.length} références · {pages.length} feuilles</p></div><button type="button" onClick={printLabels} disabled={loading||printing||!labels.length}><Printer size={18}/>{printing?'Préparation…':'Imprimer toutes les feuilles'}</button></header>
    {loading&&<p role="status" className="epi-labels-message">Préparation des QR codes…</p>}
    {error&&<p role="alert" className="epi-labels-error">{error}</p>}
    {!loading&&!error&&!labels.length&&<p className="epi-labels-message">Aucune référence EPI à imprimer.</p>}
    {pages.map((page,index)=><div className="epi-labels-preview" key={index}><p className="epi-labels-page-number">Feuille {index+1} / {pages.length}</p><section className="epi-labels-sheet" aria-label={'Feuille '+(index+1)}>{page.map(label=><article className="epi-label" key={label.code}><img src={label.qr} alt={'QR code de '+label.code}/><div className="epi-label-copy"><strong>POLYTECHS · EPI</strong><b>{label.name}</b><span>Réf. {label.reference}</span><small>QR : {label.code} · {label.family}</small></div></article>)}</section></div>)}
  </main>;
}

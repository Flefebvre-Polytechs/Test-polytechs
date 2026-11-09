'use client';
import {useCallback,useEffect,useState} from 'react';
import {ShieldCheck,ShieldX,ShieldAlert,RefreshCw,ScanLine,Clock3,Truck,GraduationCap,LockKeyhole} from 'lucide-react';
import './verification.css';
type Entry={kind:string;title:string;category:string;equipment:string;zone:string;validFrom:string;validUntil:string;status:'valid'|'expired'|'pending'|'suspended'|'revoked'|'draft';statusLabel:string};
type Data={person:{firstName:string;lastName:string;service:string};authorizations:Entry[];verifiedAt:string};
export function BadgeCheckView({token}:{token:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const res=await fetch('/api/habilitations/verify/'+encodeURIComponent(token),{cache:'no-store',credentials:'omit'});
   const json=await res.json() as Data&{error?:string};
   if(!res.ok)throw Error(json.error||'Vérification impossible.');
   setData(json);
  }catch(e){setData(null);setError((e as Error).message)}
  finally{setLoading(false)}
 },[token]);
 useEffect(()=>{void load()},[load]);
 const valid=data?.authorizations.filter(x=>x.status==='valid')||[],alerts=data?.authorizations.filter(x=>x.status!=='valid')||[];
 return <main className="badge-check"><div className="badge-check-inner">
  <header className="badge-public-top"><img src="/polytechs-logo.png" alt="Polytechs"/><div><span>POLYTECHS CONNECT</span><strong>Contrôle des habilitations</strong></div></header>
  <div className="badge-public-hero"><ScanLine size={24}/><span>VÉRIFICATION TERRAIN · CONSULTATION SANS COMPTE</span></div>
  {loading?<section className="badge-public-card" role="status"><RefreshCw className="badge-spin"/> Vérification des données en cours…</section>:error?<section className="badge-public-card badge-public-invalid" role="alert"><ShieldX size={38}/><h1>Badge non vérifiable</h1><p>{error}</p><strong>Ne considérez aucune autorisation comme valide sans contrôle auprès des RH / QSSE.</strong></section>:data&&<>
   <section className="badge-public-card badge-public-person"><span className="badge-label">IDENTITÉ DU TITULAIRE</span><h1>{data.person.firstName} {data.person.lastName}</h1>{data.person.service&&<p>{data.person.service}</p>}<div className={'badge-global '+(alerts.length?'badge-global-attention':valid.length?'badge-global-ok':'badge-global-attention')}>{alerts.length||!valid.length?<ShieldAlert size={20}/>:<ShieldCheck size={20}/>}<strong>{!data.authorizations.length?'Aucune habilitation active enregistrée':alerts.length?'Certaines habilitations nécessitent une vérification':'Habilitations enregistrées valides'}</strong></div></section>
   <div className="badge-public-section-title"><h2>Habilitations consultables</h2><small>{data.authorizations.length} fiche(s)</small></div>
   {!data.authorizations.length&&<section className="badge-public-card"><ShieldX size={25}/><p>Aucune autorisation de travail ou de conduite n’est actuellement attestée sur ce badge.</p></section>}
   {data.authorizations.map((a,i)=><article key={i} className={'badge-public-card badge-qualification '+(a.status==='valid'?'ok':'warning')}><div className="badge-qualification-top"><span className="badge-kind">{a.kind==='CACES / formation'?<GraduationCap size={16}/>:<Truck size={16}/>} {a.kind}</span><span className={'badge-result '+a.status}>{a.status==='valid'?<ShieldCheck size={16}/>:<ShieldX size={16}/>} {a.statusLabel}</span></div><h3>{a.title}</h3><div className="badge-qualification-details">{a.category&&<p><b>Catégorie</b><span>{a.category}</span></p>}{a.equipment&&<p><b>Équipement</b><span>{a.equipment}</span></p>}{a.zone&&<p><b>Périmètre autorisé</b><span>{a.zone}</span></p>}{a.validUntil&&<p><b>Date de fin inscrite</b><span>{new Date(a.validUntil+'T12:00:00').toLocaleDateString('fr-FR')}</span></p>}</div>{a.kind==='CACES / formation'&&<p className="badge-disclaimer">Formation / CACES : ne constitue pas à lui seul une autorisation de conduite.</p>}</article>)}
   <p className="badge-verified"><Clock3 size={15}/> Vérifié le {new Date(data.verifiedAt).toLocaleString('fr-FR')}</p>
  </>}
  <button className="badge-reload" type="button" disabled={loading} onClick={()=>void load()}><RefreshCw size={17}/> Actualiser la vérification</button>
  <footer><LockKeyhole size={16}/><span>Lecture seule · Données actualisées · Aucun justificatif RH ou renseignement médical accessible ici.</span></footer>
 </div></main>;
}

'use client';
import {useMemo,useState,type ChangeEvent} from 'react';
import {ArrowDownToLine,CheckCircle2,ClipboardPaste,FileSpreadsheet,UploadCloud,X} from 'lucide-react';
import {environmentSites,type EnvironmentSite} from '@/lib/environment-consumptions';
import {parseWaterTable,waterImportMonthName} from '@/lib/environment-water-import';

const yearOptions=Array.from({length:101},(_,i)=>2100-i);
const waterMetric='water_consumed_m3';
type ImportResponse={ok?:boolean;inserted?:number;skipped?:number;error?:string};
export function EnvironmentBulkImport({onSuccess}:{onSuccess:(latestPeriod:string,site:EnvironmentSite)=>void}){
 const [open,setOpen]=useState(false),[input,setInput]=useState(''),[year,setYear]=useState(''),[site,setSite]=useState('');
 const [source,setSource]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const parsed=useMemo(()=>parseWaterTable(input),[input]);
 const production=parsed.rows.reduce((n,r)=>n+r.production,0),water=parsed.rows.reduce((n,r)=>n+r.water,0),ratio=production>0?water/production:null;
 const permitted=parsed.rows.length>0&&!parsed.errors.length&&year!==''&&site!==''&&!!source.trim()&&confirmed&&!busy;
 function close(){if(busy)return;setOpen(false);setError('')}
 function selectFile(e:ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;if(file.size>10000){setError('Le fichier doit contenir au maximum 10 Ko de données mensuelles.');return}void file.text().then(s=>{setInput(s);setConfirmed(false);setError('')}).catch(()=>setError('Lecture du fichier impossible.'))}
 async function save(){
  if(!permitted)return;
  setBusy(true);setError('');setSuccess('');
  try{
   const r=await fetch('/api/environnement/consommations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'import-production-water',year:Number(year),site,waterMetric,source:source.trim(),rows:parsed.rows})});
   const response=await r.json() as ImportResponse;
   if(!r.ok)throw Error(response.error||'Importation impossible.');
   setSuccess((response.inserted??0)+' mesures importées · '+(response.skipped??0)+' déjà présentes (ignorées).');
   onSuccess(year+'-'+String(Math.max(...parsed.rows.map(x=>x.month))).padStart(2,'0'),site as EnvironmentSite);
   setConfirmed(false);
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false)}
 }
 return <div className="env-import-container"><button className="env-outlined" type="button" onClick={()=>{setOpen(true);setError('');setSuccess('')}}><ClipboardPaste size={16}/> Importer un tableau</button>
 {open&&<div className="env-import-backdrop" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="env-import-title" className="env-import-modal">
  <header className="env-import-heading"><div><span className="env-panel-eyebrow">IMPORTATION CONTRÔLÉE</span><h2 id="env-import-title">Production et consommation d’eau de ville</h2><p>Colle un tableau à trois colonnes (mois, tonnes produites, m³ d’eau) ou importe un fichier CSV. Aucun chiffre n’est enregistré avant ta validation.</p></div><button type="button" className="env-close" onClick={close} disabled={busy} aria-label="Fermer l’importation"><X size={19}/></button></header>
  <div className="env-import-fields">
   <label>Année des relevés<select value={year} onChange={e=>{setYear(e.target.value);setConfirmed(false)}} required><option value="">Choisir une année</option>{yearOptions.map(y=><option value={y} key={y}>{y}</option>)}</select></label>
   <label>Périmètre du relevé<select value={site} onChange={e=>{setSite(e.target.value);setConfirmed(false)}} required><option value="">Choisir le site</option>{environmentSites.map(s=><option value={s.id} key={s.id}>{s.label}</option>)}</select></label>
   <p>Consommation d’eau de ville uniquement · réseau public, en m³.</p>
  </div>
  <label className="env-import-paste-label">Tableau mensuel <span>Tu peux coller directement le tableau Markdown de la conversation.</span><textarea rows={8} maxLength={10000} value={input} onChange={e=>{setInput(e.target.value);setConfirmed(false)}} placeholder={'Janvier | 1 000,0000 | 3 500\nFévrier | 1 100,0000 | 3 700\n…'} /></label>
  <div className="env-import-file"><FileSpreadsheet size={18}/><label><span>Ou choisir un fichier .csv / .txt</span><input type="file" accept=".csv,.txt,text/plain,text/csv" onChange={selectFile} disabled={busy}/></label><small>Valeurs françaises acceptées, jusqu’à quatre décimales.</small></div>
  {parsed.rows.length>0&&<div className="env-import-preview">
   <div className="env-import-preview-title"><div><strong>Aperçu — {parsed.rows.length} mois détectés</strong><small>Les colonnes restent séparées en tonnes et en m³.</small></div><div className="env-import-stats"><span>{production.toLocaleString('fr-FR',{minimumFractionDigits:3,maximumFractionDigits:4})} t</span><span>{water.toLocaleString('fr-FR',{maximumFractionDigits:4})} m³</span><span>{ratio===null?'—':ratio.toLocaleString('fr-FR',{maximumFractionDigits:3})} m³/t</span></div></div>
   <div className="env-import-preview-scroll"><table><thead><tr><th>Mois</th><th>Production (t)</th><th>Eau de ville (m³)</th><th>m³/t</th></tr></thead><tbody>{parsed.rows.map(r=><tr key={r.month}><td>{waterImportMonthName(r.month)} {year||'—'}</td><td>{r.production.toLocaleString('fr-FR',{minimumFractionDigits:4,maximumFractionDigits:4})}</td><td>{r.water.toLocaleString('fr-FR',{maximumFractionDigits:4})}</td><td>{r.production? (r.water/r.production).toLocaleString('fr-FR',{maximumFractionDigits:3}):'—'}</td></tr>)}</tbody></table></div>
  </div>}
  {parsed.errors.length>0&&<div className="env-error" role="alert">{parsed.errors.map((x,i)=><p key={i}>{x}</p>)}</div>}
  <label className="env-import-source">Source des données / référence du relevé<input required maxLength={160} value={source} onChange={e=>{setSource(e.target.value);setConfirmed(false)}} placeholder="Ex. : suivi mensuel de production et factures d’eau"/></label>
  <label className="env-import-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>Je confirme l’année, le périmètre, la nature du compteur et l’exactitude des valeurs. Les relevés existants seront ignorés et jamais écrasés.</span></label>
  {error&&<div className="env-error" role="alert">{error}</div>}{success&&<div className="env-notice" role="status"><CheckCircle2 size={18}/>{success}</div>}
  <footer className="env-import-footer"><span>Écriture réservée aux contributeurs QSSE · import atomique et historisé.</span><div><button type="button" className="env-outlined" onClick={close} disabled={busy}>{success?'Terminer':'Annuler'}</button><button type="button" className="env-primary" disabled={!permitted} onClick={()=>void save()}><UploadCloud size={17}/>{busy?'Enregistrement…':'Valider et importer '+(parsed.rows.length*2)+' mesures'}</button></div></footer>
 </section></div>}
 </div>;
}

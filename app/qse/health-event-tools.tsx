'use client';

import {useState} from 'react';
import {Link2,Plus} from 'lucide-react';
import {healthImportYear,type HealthImportRow} from '@/lib/health-events';
import {readHealthWorkbook} from '@/lib/health-workbook';
import type {QRecord} from '@/lib/workflows';

type Preview={sheet:string;line:number;date:string;type:string;state:string};
async function post<T>(endpoint:string,body:unknown):Promise<T>{
 const response=await fetch('/api/records/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const result=await response.json() as T&{error?:string};
 if(!response.ok)throw Error(result.error||'Opération impossible.');
 return result;
}

export function HealthEventImport({onImported}:{onImported:(message:string)=>void}){
 const [rows,setRows]=useState<HealthImportRow[]>([]),[preview,setPreview]=useState<Preview[]>([]),[issues,setIssues]=useState<string[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const pending=preview.filter(row=>row.state==='à importer').length;
 async function inspect(file:File){
  setBusy(true);setError('');setRows([]);setPreview([]);setIssues([]);
  try{
   const result=await readHealthWorkbook(file);
   setIssues(result.issues);
   if(!result.rows.length)throw Error('Aucun événement '+healthImportYear+' exploitable dans les feuilles attendues.');
   const checked=await post<{preview:Preview[]}>('health-import',{mode:'preview',rows:result.rows});
   setRows(result.rows);setPreview(checked.preview);
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 async function commit(){
  setBusy(true);setError('');
  try{
   const result=await post<{imported:number;skipped:number}>('health-import',{mode:'import',rows});
   setRows([]);setPreview([]);setIssues([]);
   onImported(result.imported+' fiche(s) reprise(s) · '+result.skipped+' écartée(s) ou déjà présente(s).');
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);}
 }
 return <details className="module-info">
  <summary>Importer le registre SSE {healthImportYear}</summary>
  <p>Reprend les événements {healthImportYear} des feuilles « Accidentologie », « 1ers soins » et « Accidento EE ».</p>
  <label>Classeur Excel <input type="file" accept=".xlsx" disabled={busy} onChange={event=>{
   const file=event.target.files?.[0];event.target.value='';if(file)void inspect(file);
  }}/></label>
  {issues.length>0&&<p role="status">Lignes Excel à vérifier : {issues.join(', ')}.</p>}
  {error&&<p role="alert" className="error">{error}</p>}
  {busy&&<p role="status">Traitement en cours…</p>}
  {preview.length>0&&<div>
   <p><strong>{pending} à importer</strong> · {preview.length-pending} écartée(s) ou à vérifier.</p>
   <ul className="health-import-preview">{preview.map(row=><li key={row.sheet+'-'+row.line}>{row.date} · {row.type} · {row.sheet}, ligne {row.line} — {row.state}</li>)}</ul>
   <button type="button" className="primary" disabled={busy||!pending} onClick={()=>void commit()}>Importer {pending} fiche(s)</button>
  </div>}
 </details>;
}

export function HealthEventTicket({record,canEdit,locked,onBusy,onLinked}:{
 record:QRecord;canEdit:boolean;locked:boolean;onBusy:(busy:boolean)=>void;onLinked:(ticketId:string,revision:number)=>void;
}){
 const [mode,setMode]=useState<'create'|'link'|'replace'|'unlink'|null>(null),[value,setValue]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const linked=record.details.linkedTicketId;
 function choose(next:typeof mode){
  setMode(next);setValue('');setError('');
 }
 async function save(){
  if(!mode||locked||busy||(mode!=='unlink'&&!value.trim()))return;
  setBusy(true);onBusy(true);setError('');
  try{
   const input=value.trim();
   let ticketId=input;
   if(['link','replace'].includes(mode)&&input.includes('/')){
    const url=new URL(input,location.origin);
    if(url.origin!==location.origin||url.pathname!=='/tickets')throw Error('Collez un lien vers un ticket Polytechs Connect.');
    ticketId=url.searchParams.get('id')||'';
   }
   const result=await post<{ticketId:string;revision:number}>('health-ticket',{
    recordId:record.id,revision:record.revision,mode,...(mode==='create'?{title:input}:{ticketId}),
   });
   choose(null);onLinked(result.ticketId,result.revision);
  }catch(error){setError((error as Error).message);}
  finally{setBusy(false);onBusy(false);}
 }
 const confirmLabels={create:'Créer le ticket',link:'Rattacher le ticket',replace:'Remplacer le lien',unlink:'Dissocier le ticket'};
 return <section className="linked-panel">
  <h3>Ticket de suivi</h3>
  <div className="health-ticket-bar">
   {linked&&<a className="outline" href={'/tickets?id='+encodeURIComponent(linked)} target="_blank" rel="noreferrer"><Link2 size={17}/> Ouvrir le ticket</a>}
   {canEdit&&(linked?<>
    <button type="button" className="outline" disabled={locked||busy} onClick={()=>choose('replace')}>Remplacer le lien</button>
    <button type="button" className="outline" disabled={locked||busy} onClick={()=>choose('unlink')}>Dissocier</button>
   </>:<>
    <button type="button" className="outline" disabled={locked||busy} onClick={()=>choose('link')}><Link2 size={16}/> Rattacher un ticket</button>
    <button type="button" className="primary" disabled={locked||busy} onClick={()=>choose('create')}><Plus size={16}/> Créer un ticket lié</button>
   </>)}
  </div>
  {!linked&&!canEdit&&<p>Aucun ticket rattaché.</p>}
  {mode&&canEdit&&<div className="edit-fields">
   {mode==='unlink'?<p>Le ticket reste dans l’espace Tickets et son lien sera retiré de cette fiche.</p>:<label>{mode==='create'?'Intitulé du ticket':'Lien ou identifiant du ticket'}
    <input autoFocus value={value} maxLength={mode==='create'?200:500} onChange={event=>setValue(event.target.value)} disabled={busy||locked}/>
   </label>}
   {mode==='create'&&<p>Le ticket est partagé avec l’équipe QSSE. Saisis un intitulé sans nom ni détail médical.</p>}
   <div className="health-ticket-bar">
    <button type="button" className="outline" disabled={busy} onClick={()=>choose(null)}>Annuler</button>
    <button type="button" className="primary" disabled={locked||busy||(mode!=='unlink'&&!value.trim())} onClick={()=>void save()}>
     {busy?'Enregistrement…':confirmLabels[mode]}
    </button>
   </div>
  </div>}
  {error&&<p role="alert" className="error">{error}</p>}
 </section>;
}

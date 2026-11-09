'use client';
import {useRef,useState} from 'react';
import {Upload,FileText} from 'lucide-react';

export function fileProblem(file:File){
  if(!file.size) return 'Ce fichier est vide.';
  if(file.size>15*1024*1024) return 'Le fichier dépasse la limite de 15 Mo.';
  if(!/\.(pdf|docx|xlsx|jpe?g|png)$/i.test(file.name)) return 'Choisissez un PDF, DOCX, XLSX, JPG ou PNG.';
  if(file.name.length>200) return 'Le nom du fichier doit contenir au plus 200 caractères.';
  return '';
}

export async function attachFile(versionId:string,revision:number,file:File){
  const body=new FormData();
  body.set('versionId',versionId);
  body.set('revision',String(revision));
  body.set('file',file);
  const response=await fetch('/api/ged-files',{method:'POST',credentials:'same-origin',body});
  if(!response.headers.get('content-type')?.includes('application/json')) throw Error('Réponse interrompue. Vérifiez les fichiers de cette version.');
  const result=await response.json() as {error?:string};
  if(!response.ok) throw Error(result.error||'Le dépôt a échoué.');
}

export function FileDeposit({file,disabled,onPick,onError}:{file?:File|null;disabled:boolean;onPick:(file:File)=>void;onError:(message:string)=>void}){
  const input=useRef<HTMLInputElement>(null);
  const [over,setOver]=useState(false);
  function select(files:FileList|null){
    if(disabled||!files?.length)return;
    if(files.length!==1){onError('Déposez un fichier à la fois.');return}
    const problem=fileProblem(files[0]);
    if(problem){onError(problem);return}
    onError('');onPick(files[0]);
  }
  return <div className={'ged-drop'+(over?' over':'')} onDragOver={e=>{e.preventDefault();setOver(!disabled)}} onDragLeave={()=>setOver(false)} onDrop={e=>{e.preventDefault();setOver(false);select(e.dataTransfer.files)}}>
    {file?<FileText aria-hidden="true"/>:<Upload aria-hidden="true"/>}
    <div><strong>{file?file.name:'Glissez votre fichier ici'}</strong><small>PDF, Word (.docx), Excel (.xlsx), JPG ou PNG · 15 Mo maximum</small></div>
    <input ref={input} type="file" hidden disabled={disabled} accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={e=>{select(e.target.files);e.target.value=''}}/>
    <button type="button" className="outline" disabled={disabled} onClick={()=>input.current?.click()}>{file?'Changer le fichier':'Choisir un fichier'}</button>
  </div>
}

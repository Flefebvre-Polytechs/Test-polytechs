'use client';

import {useId,useRef,useState} from 'react';
import {CircleCheck,GitBranch,Plus,Trash2} from 'lucide-react';
import {useConfirmation} from '@/components/use-confirmation';
import {maxFiveWhyCauses,maxFiveWhyDepth,type FiveWhyCause,type Task} from '@/lib/hub';

type CauseBranch=FiveWhyCause&{depth:number;children:CauseBranch[]};

export function FiveWhyTree({causes,problem,actions,readOnly,disabled,onChange}:{
 causes:FiveWhyCause[];problem:string;actions:Task[];readOnly:boolean;disabled:boolean;
 onChange:(causes:FiveWhyCause[],action?:Task)=>void;
}){
 const [selectedId,setSelectedId]=useState('');
 const [draftAction,setDraftAction]=useState('');
 const answerRef=useRef<HTMLTextAreaElement>(null);
 const fieldId=useId();
 const {askConfirm,confirmation}=useConfirmation();
 const roots:CauseBranch[]=[];
 const byId=new Map<string,CauseBranch>();
 for(const cause of causes){
  const parent=cause.parentId===null?undefined:byId.get(cause.parentId);
  const node={...cause,depth:(parent?.depth??0)+1,children:[]};
  byId.set(cause.id,node);
  (parent?.children??roots).push(node);
 }
 const current=byId.get(selectedId)??roots[0];
 const locked=readOnly||disabled;
 const atLimit=causes.length>=maxFiveWhyCauses;

 function select(id:string){
  setSelectedId(id);
  setDraftAction('');
 }
 function addCause(parentId:string|null){
  const id=crypto.randomUUID();
  onChange([...causes,{id,parentId,answer:''}]);
  select(id);
  requestAnimationFrame(()=>answerRef.current?.focus());
 }
 function updateCause(change:Partial<FiveWhyCause>,action?:Task){
  onChange(causes.map(cause=>cause.id===current?.id?{...cause,...change}:cause),action);
 }
 async function removeCause(){
  if(!current)return;
  const ids=new Set([current.id]);
  for(const cause of causes)if(cause.parentId&&ids.has(cause.parentId))ids.add(cause.id);
  const description=ids.size>1
   ?'Cette cause et ses '+(ids.size-1)+' sous-causes seront retirées de l’analyse à l’enregistrement. Les actions restent dans le ticket.'
   :'Cette cause sera retirée de l’analyse à l’enregistrement. Les actions restent dans le ticket.';
  if(!await askConfirm(description,{title:'Retirer cette cause ?',confirmLabel:'Retirer'}))return;
  onChange(causes.filter(cause=>!ids.has(cause.id)));
  select(current.parentId??'');
 }
 function addAction(){
  const title=draftAction.trim();
  if(!title||actions.length>=100)return;
  const action={id:crypto.randomUUID(),title,done:false,pilot:'',due:''};
  updateCause({actionId:action.id},action);
  setDraftAction('');
 }
 function renderBranches(nodes:CauseBranch[]){
  return <ul className="ticket-five-why-branches">{nodes.map(node=><li key={node.id}>
   <button type="button" className="ticket-five-why-node" aria-pressed={node.id===current?.id}
    aria-controls={fieldId+'-editor'} onClick={()=>{
     select(node.id);
     requestAnimationFrame(()=>answerRef.current?.scrollIntoView({block:'nearest'}));
    }}>
    <span className="ticket-five-why-level">Pourquoi {node.depth}</span>
    <span className="ticket-five-why-answer">{node.label?.trim()||node.answer.trim()||'Cause à renseigner'}</span>
    {!!node.actionId&&<CircleCheck size={14} aria-label="Action associée"/>}
   </button>
   {node.children.length>0&&renderBranches(node.children)}
  </li>)}</ul>;
 }

 const action=actions.find(entry=>entry.id===current?.actionId);
 const showConclusion=current&&(!current.children.length||current.conclusion||action);

 return <div className="ticket-five-why-layout">
  <div className="ticket-five-why-tree">
   <div className="ticket-five-why-problem"><strong>Problème</strong><span>{problem.trim()||'Titre du ticket à renseigner'}</span></div>
   {roots.length>0&&renderBranches(roots)}
   {!readOnly&&<button type="button" className="ticket-add-action" disabled={locked||atLimit} onClick={()=>addCause(null)}>
    <Plus size={15}/> Ajouter une cause au problème
   </button>}
   {atLimit&&<small className="ticket-five-why-limit">Maximum de {maxFiveWhyCauses} causes atteint.</small>}
  </div>
  {current&&<fieldset id={fieldId+'-editor'} className="ticket-analysis-fields ticket-five-why-editor" disabled={disabled}>
   <legend className="sr-only">Pourquoi {current.depth}</legend>
   {current.label!==undefined&&<div>
    <label htmlFor={fieldId+'-label'}>Nom de la piste</label>
    <input id={fieldId+'-label'} value={current.label} maxLength={100} readOnly={readOnly}
     onChange={event=>updateCause({label:event.target.value})}/>
   </div>}
   <div>
    <label htmlFor={fieldId+'-answer'}>Pourquoi {current.depth} · {current.parentId===null?'Pourquoi le problème est-il apparu ?':'Pourquoi cette cause est-elle apparue ?'}</label>
    <textarea ref={answerRef} id={fieldId+'-answer'} rows={3} maxLength={3000} readOnly={readOnly} value={current.answer}
     onChange={event=>updateCause({answer:event.target.value})}/>
   </div>
   {showConclusion&&<div>
    <label htmlFor={fieldId+'-conclusion'}>Cause racine retenue et preuve</label>
    <textarea id={fieldId+'-conclusion'} rows={2} maxLength={3000} readOnly={readOnly} value={current.conclusion??''}
     onChange={event=>updateCause({conclusion:event.target.value})}/>
   </div>}
   {showConclusion&&(!readOnly||action)&&<div>
    <label htmlFor={fieldId+'-action'}>Action corrective</label>
    {readOnly?<output id={fieldId+'-action'}>{action?.title}</output>:<>
     <select id={fieldId+'-action'} value={current.actionId??''} onChange={event=>updateCause({actionId:event.target.value||undefined})}>
      <option value="">Choisir une action du ticket</option>
      {actions.map((entry,i)=><option key={entry.id} value={entry.id}>{entry.title.trim()||'Action '+(i+1)+' à renseigner'}</option>)}
     </select>
     {!action&&actions.length<100&&<div className="ticket-five-why-new-action">
      <input aria-label="Intitulé de la nouvelle action" placeholder="Intitulé de la nouvelle action" maxLength={500}
       value={draftAction} onChange={event=>setDraftAction(event.target.value)}/>
      <button type="button" className="ticket-add-action" disabled={!draftAction.trim()} onClick={addAction}>
       <Plus size={14}/> Créer l’action
      </button>
     </div>}
    </>}
   </div>}
   {!readOnly&&<div className="ticket-five-why-controls">
    {current.depth<maxFiveWhyDepth&&<button type="button" className="ticket-add-action" disabled={atLimit} onClick={()=>addCause(current.id)}>
     <GitBranch size={15}/> Ajouter un pourquoi à cette cause
    </button>}
    <button type="button" className="ticket-five-why-remove" onClick={()=>void removeCause()}>
     <Trash2 size={14}/> Retirer
    </button>
   </div>}
  </fieldset>}
  {confirmation}
 </div>;
}

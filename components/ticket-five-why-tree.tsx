'use client';

import {useEffect,useRef,useState,type CSSProperties,type FormEvent} from 'react';
import {ClipboardCheck,ExternalLink,GitBranch,Link2,MoreHorizontal,Plus,Trash2} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {TicketPilotPicker} from '@/components/ticket-search-picker';
import {useConfirmation} from '@/components/use-confirmation';
import {maxFiveWhyCauses,maxFiveWhyDepth,type FiveWhyCause,type Task} from '@/lib/hub';
import '@/app/tickets/five-why.css';

type CauseBranch=FiveWhyCause&{depth:number;children:CauseBranch[]};
type PersonOption={id:string;name:string};
type Editor=
 | {kind:'cause';value:FiveWhyCause;depth:number;adding:boolean}
 | {kind:'action';causeId:string;title:string;pilot:string};

const causeTitle=(cause:FiveWhyCause)=>cause.label?.trim()||cause.answer.trim()||'Cause à renseigner';
const causeButton=(viewport:HTMLDivElement|null,id:string)=>viewport?.querySelector<HTMLButtonElement>(
 '[data-cause-id="'+CSS.escape(id)+'"] .ticket-five-why-node',
);

function CauseOptions({node,action,locked,canAddCause,canAddAction,onAddCause,onCreateAction,onViewAction,onRemove}:{
 node:CauseBranch;action?:Task;locked:boolean;canAddCause:boolean;canAddAction:boolean;
 onAddCause:(trigger:HTMLButtonElement|null)=>void;onCreateAction:(trigger:HTMLButtonElement|null)=>void;
 onViewAction:()=>void;onRemove:(trigger:HTMLButtonElement|null)=>void;
}){
 const trigger=useRef<HTMLButtonElement>(null);
 const afterMenu=useRef<(()=>void)|null>(null);
 return <DropdownMenu modal={false}>
  <DropdownMenuTrigger asChild>
   <button ref={trigger} type="button" className="ticket-five-why-more" disabled={locked}
    aria-label={'Options · Pourquoi '+node.depth+' · '+causeTitle(node)} title="Options de la cause">
    <MoreHorizontal size={19} aria-hidden="true"/>
   </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" onCloseAutoFocus={event=>{
   const next=afterMenu.current;
   if(!next)return;
   event.preventDefault();
   afterMenu.current=null;
   next();
  }}>
   <DropdownMenuItem disabled={!canAddCause} onSelect={()=>{afterMenu.current=()=>onAddCause(trigger.current)}}>
    <GitBranch size={16} aria-hidden="true"/>Ajouter une sous-cause
   </DropdownMenuItem>
   {action?<DropdownMenuItem onSelect={()=>{afterMenu.current=onViewAction}}>
    <ExternalLink size={16} aria-hidden="true"/>Voir l’action liée
   </DropdownMenuItem>:<DropdownMenuItem disabled={!canAddAction} onSelect={()=>{afterMenu.current=()=>onCreateAction(trigger.current)}}>
    <Plus size={16} aria-hidden="true"/>Créer une action
   </DropdownMenuItem>}
   <DropdownMenuSeparator/>
   <DropdownMenuItem variant="destructive" onSelect={()=>{afterMenu.current=()=>onRemove(trigger.current)}}>
    <Trash2 size={16} aria-hidden="true"/>Retirer la cause
   </DropdownMenuItem>
  </DropdownMenuContent>
 </DropdownMenu>;
}

export function FiveWhyTree({causes,problem,actions,people,readOnly,disabled,onChange,onViewAction}:{
 causes:FiveWhyCause[];problem:string;actions:Task[];people:PersonOption[];readOnly:boolean;disabled:boolean;
 onChange:(causes:FiveWhyCause[],action?:Task)=>void;onViewAction:(id:string)=>void;
}){
 const [selectedId,setSelectedId]=useState('');
 const [editor,setEditor]=useState<Editor|null>(null);
 const viewport=useRef<HTMLDivElement>(null);
 const problemCard=useRef<HTMLDivElement>(null);
 const addRoot=useRef<HTMLButtonElement>(null);
 const afterEditor=useRef<(()=>void)|null>(null);
 const {askConfirm,confirmation}=useConfirmation();
 const roots:CauseBranch[]=[];
 const byId=new Map<string,CauseBranch>();
 for(const cause of causes){
  const parent=cause.parentId===null?undefined:byId.get(cause.parentId);
  const node:CauseBranch={...cause,depth:(parent?.depth??0)+1,children:[]};
  byId.set(cause.id,node);
  (parent?.children??roots).push(node);
 }
 const actionsById=new Map(actions.map(action=>[action.id,action]));
 const leaves=Math.max(1,[...byId.values()].filter(node=>!node.children.length).length);
 const locked=readOnly||disabled;
 const atLimit=causes.length>=maxFiveWhyCauses;
 const canAddAction=actions.length<100;
 const problemTitle=problem.trim()||'Titre du ticket à renseigner';

 useEffect(()=>{
  const surface=viewport.current;
  if(!surface)return;
  function center(){
   if(!surface||surface.scrollWidth<=surface.clientWidth)return;
   const target=causeButton(surface,selectedId)??problemCard.current;
   if(!target)return;
   const card=target.getBoundingClientRect(),frame=surface.getBoundingClientRect();
   surface.scrollLeft+=card.left+card.width/2-frame.left-frame.width/2;
  }
  center();
  const resize=new ResizeObserver(center);
  resize.observe(surface);
  return()=>resize.disconnect();
 },[selectedId,leaves]);

 function openEditor(next:Editor,trigger:HTMLElement|null){
  afterEditor.current=()=>trigger?.focus({preventScroll:true});
  setEditor(next);
 }
 function openCause(node:CauseBranch,trigger:HTMLElement){
  const {id,parentId,answer,label,conclusion,actionId,depth}=node;
  setSelectedId(id);
  openEditor({kind:'cause',value:{id,parentId,answer,label,conclusion,actionId},depth,adding:false},trigger);
 }
 function addCause(parent:CauseBranch|null,trigger:HTMLElement|null){
  const depth=(parent?.depth??0)+1;
  if(locked||atLimit||depth>maxFiveWhyDepth)return;
  if(parent)setSelectedId(parent.id);
  openEditor({kind:'cause',value:{id:crypto.randomUUID(),parentId:parent?.id??null,answer:''},depth,adding:true},trigger);
 }
 function openAction(node:CauseBranch,trigger:HTMLElement|null){
  if(locked||!canAddAction)return;
  setSelectedId(node.id);
  openEditor({kind:'action',causeId:node.id,title:'',pilot:''},trigger);
 }
 function changeCause(change:Partial<FiveWhyCause>){
  setEditor(current=>current?.kind==='cause'?{...current,value:{...current.value,...change}}:current);
 }
 function changeAction(change:Partial<Pick<Task,'title'|'pilot'>>){
  setEditor(current=>current?.kind==='action'?{...current,...change}:current);
 }
 function saveEditor(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  if(!editor||locked)return;
  if(editor.kind==='cause'){
   const {value,adding}=editor;
   if(adding&&atLimit)return;
   onChange(adding?[...causes,value]:causes.map(cause=>cause.id===value.id?value:cause));
   setSelectedId(value.id);
   if(adding)afterEditor.current=()=>{
    const button=causeButton(viewport.current,value.id);
    button?.scrollIntoView({block:'nearest',inline:'nearest'});
    button?.focus({preventScroll:true});
   };
  }else{
   const title=editor.title.trim();
   const cause=byId.get(editor.causeId);
   if(!title||!canAddAction||!cause||cause.actionId&&actionsById.has(cause.actionId))return;
   const due=String(new FormData(event.currentTarget).get('due')??'');
   const action:Task={id:crypto.randomUUID(),title,pilot:editor.pilot,due,done:false};
   onChange(causes.map(node=>node.id===cause.id?{...node,actionId:action.id}:node),action);
  }
  setEditor(null);
 }
 async function removeCause(node:CauseBranch,trigger:HTMLElement|null){
  if(locked)return;
  const ids=new Set([node.id]);
  for(const cause of causes)if(cause.parentId&&ids.has(cause.parentId))ids.add(cause.id);
  const count=ids.size-1;
  const description=count>0
   ?'Cette cause et '+(count===1?'sa sous-cause':'ses '+count+' sous-causes')+' seront retirées à l’enregistrement du ticket.'
   :'Cette cause sera retirée à l’enregistrement du ticket.';
  if(!await askConfirm(description,{title:'Retirer cette cause ?',confirmLabel:'Retirer'})){
   requestAnimationFrame(()=>trigger?.focus({preventScroll:true}));
   return;
  }
  onChange(causes.filter(cause=>!ids.has(cause.id)));
  setSelectedId(node.parentId??'');
  requestAnimationFrame(()=>(causeButton(viewport.current,node.parentId??'')??addRoot.current)?.focus({preventScroll:true}));
 }
 function renderBranches(nodes:CauseBranch[]){
  return <ul className="ticket-five-why-branches">{nodes.map(node=>{
   const action=node.actionId?actionsById.get(node.actionId):undefined;
   const title=causeTitle(node);
   const hasCause=!!(node.label?.trim()||node.answer.trim());
   const rootWithAction=!!action&&(!!node.conclusion?.trim()||(hasCause&&!node.children.length));
   return <li key={node.id}>
    <div className="ticket-five-why-card" data-cause-id={node.id} data-active={selectedId===node.id}
     data-empty={!hasCause} data-root-action={rootWithAction}>
     <button type="button" className="ticket-five-why-node" aria-haspopup="dialog" disabled={disabled} title={title}
      onClick={event=>openCause(node,event.currentTarget)}>
      <span className="ticket-five-why-level">
       {rootWithAction?<><span className="sr-only">Pourquoi {node.depth} · </span>Cause racine</>:'Pourquoi '+node.depth}
      </span>
      <span className="ticket-five-why-answer">{title}</span>
      {action&&<span className="ticket-five-why-action" data-done={action.done}>
       {action.done?<ClipboardCheck size={13} aria-hidden="true"/>:<Link2 size={13} aria-hidden="true"/>}
       {action.done?'Action réalisée':'Action liée'}
      </span>}
     </button>
     {!readOnly&&<CauseOptions node={node} action={action} locked={disabled}
      canAddCause={!atLimit&&node.depth<maxFiveWhyDepth} canAddAction={canAddAction}
      onAddCause={trigger=>addCause(node,trigger)} onCreateAction={trigger=>openAction(node,trigger)}
      onViewAction={()=>{if(action)onViewAction(action.id)}}
      onRemove={trigger=>void removeCause(node,trigger)}/>}
    </div>
    {node.children.length>0&&renderBranches(node.children)}
   </li>;
  })}</ul>;
 }

 const editedNode=editor?.kind==='cause'?byId.get(editor.value.id):undefined;
 const linkedAction=editor?.kind==='cause'&&editor.value.actionId?actionsById.get(editor.value.actionId):undefined;
 const context=editor?.kind==='action'?byId.get(editor.causeId):editor?.value.parentId?byId.get(editor.value.parentId):undefined;
 const contextText=context?'Pourquoi '+context.depth+' · '+causeTitle(context):'Problème · '+problemTitle;

 return <div className="ticket-five-why-layout">
  <div className="ticket-five-why-viewport" ref={viewport} role="region" aria-label="Arbre des causes" tabIndex={0}>
   <div className="ticket-five-why-tree" style={{'--why-columns':leaves} as CSSProperties}>
    <div className="ticket-five-why-problem" ref={problemCard}>
     <small>Problème</small>
     <strong>{problemTitle}</strong>
     {!readOnly&&<button ref={addRoot} type="button" className="ticket-five-why-add-root"
      disabled={locked||atLimit} onClick={event=>addCause(null,event.currentTarget)}>
      <Plus size={15} aria-hidden="true"/>Ajouter une cause au problème
     </button>}
    </div>
    {roots.length>0&&renderBranches(roots)}
   </div>
  </div>
  {atLimit&&<small className="ticket-five-why-limit">Maximum de {maxFiveWhyCauses} causes atteint.</small>}
  <Dialog open={!!editor} onOpenChange={open=>{if(!open)setEditor(null)}}>
   {editor&&<DialogContent className="ticket-five-why-dialog" onCloseAutoFocus={event=>{
    event.preventDefault();
    afterEditor.current?.();
    afterEditor.current=null;
   }}>
    <DialogTitle>{editor.kind==='action'?'Créer une action':editor.adding?'Ajouter une cause · Pourquoi '+editor.depth:'Pourquoi '+editor.depth}</DialogTitle>
    <DialogDescription className="ticket-five-why-context">{contextText}</DialogDescription>
    <form className="ticket-five-why-form" onSubmit={saveEditor}>
     {editor.kind==='cause'?<>
      {editor.value.label!==undefined&&<label>Nom de la piste
       <input value={editor.value.label} maxLength={100} readOnly={locked} onChange={event=>changeCause({label:event.target.value})}/>
      </label>}
      <label>{editor.value.parentId===null?'Pourquoi le problème est-il apparu ?':'Pourquoi cette cause est-elle apparue ?'}
       <textarea rows={3} maxLength={3000} readOnly={locked} value={editor.value.answer}
        onChange={event=>changeCause({answer:event.target.value})}/>
      </label>
      {(!editedNode?.children.length||editor.value.conclusion||linkedAction)&&<label>Cause racine retenue et preuve
       <textarea rows={2} maxLength={3000} readOnly={locked} value={editor.value.conclusion??''}
        onChange={event=>changeCause({conclusion:event.target.value})}/>
      </label>}
      {!readOnly&&actions.length>0&&<label>Action liée
       <select disabled={disabled} value={editor.value.actionId??''} onChange={event=>changeCause({actionId:event.target.value||undefined})}>
        <option value="">Choisir une action du ticket</option>
        {actions.map((action,i)=><option key={action.id} value={action.id}>{action.title.trim()||'Action '+(i+1)+' à renseigner'}</option>)}
       </select>
      </label>}
      {readOnly&&linkedAction&&<button type="button" className="outline ticket-five-why-open-action"
       onClick={()=>{afterEditor.current=()=>onViewAction(linkedAction.id);setEditor(null)}}>
       <ExternalLink size={15} aria-hidden="true"/>Voir l’action liée
      </button>}
     </>:<>
      <label>Intitulé de l’action
       <input value={editor.title} maxLength={500} required readOnly={locked} placeholder="Action à réaliser"
        onChange={event=>changeAction({title:event.target.value})}/>
      </label>
      <div className="ticket-five-why-action-fields">
       <div><span>Pilote</span><TicketPilotPicker label="Pilote de l’action" options={people} value={editor.pilot}
        disabled={locked} onChange={pilot=>changeAction({pilot})}/></div>
       <label>Échéance de l’action
        <input type="date" name="due" readOnly={locked}/>
       </label>
      </div>
     </>}
     <footer className="ticket-five-why-dialog-actions">
      <button type="button" className="outline" onClick={()=>setEditor(null)}>{readOnly?'Fermer':'Annuler'}</button>
      {!readOnly&&<button type="submit" className="primary"
       disabled={locked||editor.kind==='action'&&(!editor.title.trim()||!canAddAction)}>
       {editor.kind==='action'?'Créer et lier l’action':editor.adding?'Ajouter la cause':'Appliquer'}
      </button>}
     </footer>
    </form>
   </DialogContent>}
  </Dialog>
  {confirmation}
 </div>;
}

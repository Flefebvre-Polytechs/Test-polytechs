'use client';

import {useEffect,useId,useRef,useState} from 'react';
import {ListChecks,MoreHorizontal,Plus,Trash2} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {useConfirmation} from '@/components/use-confirmation';
import {maxFiveWhyPaths,ticketAnalysisMethods,ticketFiveWhyPaths,type FiveWhyPath,type TicketAnalysis} from '@/lib/hub';

export function TicketAnalysisMenu({analysis,disabled,onChange,onRemove,onShow}:{
 analysis?:TicketAnalysis;disabled:boolean;onChange:(analysis:TicketAnalysis)=>void;onRemove:()=>void;onShow:()=>void;
}){
 const focusAnalysis=useRef(false);
 return <DropdownMenu modal={false}>
  <DropdownMenuTrigger asChild>
   <button type="button" className="ticket-toolbar-button ticket-analysis-menu" disabled={disabled} aria-label="Méthode d’analyse" title="Méthode d’analyse">
    <MoreHorizontal size={20}/>
   </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" onCloseAutoFocus={event=>{
   if(focusAnalysis.current)event.preventDefault();
   focusAnalysis.current=false;
  }}>
   <DropdownMenuLabel>Méthode d’analyse</DropdownMenuLabel>
   {analysis?<>
    <DropdownMenuItem onSelect={()=>{focusAnalysis.current=true;onShow()}}><ListChecks size={16}/>Aller à l’analyse</DropdownMenuItem>
    <DropdownMenuSeparator/><DropdownMenuItem variant="destructive" onSelect={onRemove}><Trash2 size={16}/>Retirer l’analyse</DropdownMenuItem>
   </>:Object.entries(ticketAnalysisMethods).map(([key,{label}])=><DropdownMenuItem key={key}
    onSelect={()=>{focusAnalysis.current=true;onChange({method:key as TicketAnalysis['method'],values:{}})}}><ListChecks size={16}/>{label}</DropdownMenuItem>)}
  </DropdownMenuContent>
 </DropdownMenu>;
}

export function TicketAnalysisFields({analysis,readOnly,disabled,showRequest,onChange}:{
 analysis:TicketAnalysis;readOnly:boolean;disabled:boolean;showRequest:number;onChange:(analysis:TicketAnalysis)=>void;
}){
 const heading=useRef<HTMLHeadingElement>(null);
 const id=useId();
 const method=ticketAnalysisMethods[analysis.method];
 useEffect(()=>{
  if(!showRequest||!heading.current)return;
  const target=heading.current;
  const frame=requestAnimationFrame(()=>{
   target.scrollIntoView({block:'nearest'});
   target.focus({preventScroll:true});
  });
  return ()=>cancelAnimationFrame(frame);
 },[showRequest]);
 const paths=analysis.method==='5p'?ticketFiveWhyPaths(analysis):null;
 const filled=method.fields.filter(([key])=>analysis.values[key]?.trim()).length;

 return <section className="ticket-analysis-section" aria-labelledby={id+'-heading'}>
  <header className="ticket-analysis-heading">
   <h3 id={id+'-heading'} ref={heading} tabIndex={-1}><ListChecks size={17} aria-hidden="true"/> Analyse · {method.label}</h3>
   <small>{paths?paths.length+(paths.length===1?' piste':' pistes'):`${filled}/${method.fields.length} renseignés`}</small>
  </header>
  {paths?<FiveWhyFields paths={paths} readOnly={readOnly} disabled={disabled}
   onChange={next=>onChange({method:'5p',values:{},paths:next})}/>
   :<fieldset className="ticket-analysis-fields" disabled={disabled}>
    <legend className="sr-only">{method.label}</legend>
    <AnalysisResponses method={analysis.method} values={analysis.values} readOnly={readOnly}
     onChange={values=>onChange({...analysis,values})}/>
   </fieldset>}
 </section>;
}

function FiveWhyFields({paths,readOnly,disabled,onChange}:{
 paths:FiveWhyPath[];readOnly:boolean;disabled:boolean;onChange:(paths:FiveWhyPath[])=>void;
}){
 const [selectedId,setSelectedId]=useState(paths[0].id);
 const current=paths.find(path=>path.id===selectedId)??paths[0];
 const index=paths.indexOf(current);
 const nameId=useId();
 const {askConfirm,confirmation}=useConfirmation();
 const updatePath=(change:Partial<FiveWhyPath>)=>onChange(paths.map(path=>path.id===current.id?{...path,...change}:path));
 function addPath(){
  const path={id:crypto.randomUUID(),name:'',values:{}};
  onChange([...paths,path]);
  setSelectedId(path.id);
 }
 async function removePath(){
  if((current.name.trim()||Object.values(current.values).some(value=>value.trim()))&&
   !await askConfirm('Cette piste et ses réponses seront retirées à l’enregistrement du ticket.',{
    title:'Retirer cette piste ?',confirmLabel:'Retirer la piste',
   }))return;
  const next=paths.filter(path=>path.id!==current.id);
  onChange(next);
  setSelectedId(next[Math.min(index,next.length-1)].id);
 }

 return <div className="ticket-five-whys">
  <div className="ticket-five-whys-nav" role="group" aria-label="Pistes du 5 Pourquoi">
   {paths.map((path,i)=><button type="button" key={path.id} className="ticket-five-whys-path"
    aria-pressed={path.id===current.id} onClick={()=>setSelectedId(path.id)}>
    <span>Piste {i+1}{path.name.trim()&&' · '+path.name.trim()}</span>
   </button>)}
   {!readOnly&&<button type="button" className="ticket-add-action ticket-five-whys-add"
    title={paths.length===maxFiveWhyPaths?'Maximum de '+maxFiveWhyPaths+' pistes atteint':undefined}
    disabled={disabled||paths.length===maxFiveWhyPaths} onClick={addPath}><Plus size={15}/> Ajouter une piste</button>}
  </div>
  <fieldset className="ticket-analysis-fields ticket-five-whys-fields" disabled={disabled}>
   <legend className="sr-only">Piste {index+1}</legend>
   {!readOnly&&<div>
    <label htmlFor={nameId}>Nom de la piste <small>(facultatif)</small></label>
    <input id={nameId} value={current.name} maxLength={100} placeholder="Ex. Consigne de tri"
     onChange={event=>updatePath({name:event.target.value})}/>
   </div>}
   <AnalysisResponses method="5p" values={current.values} readOnly={readOnly} onChange={values=>updatePath({values})}/>
   {!readOnly&&paths.length>1&&<button type="button" className="ticket-five-whys-remove" onClick={()=>void removePath()}>
    <Trash2 size={14}/> Retirer cette piste
   </button>}
  </fieldset>
  {confirmation}
 </div>;
}

function AnalysisResponses({method,values,readOnly,onChange}:{
 method:TicketAnalysis['method'];values:Record<string,string>;readOnly:boolean;onChange:(values:Record<string,string>)=>void;
}){
 const id=useId();
 return ticketAnalysisMethods[method].fields.map(([key,label])=><div key={key}>
  <label htmlFor={id+key}>{label}</label>
  <textarea id={id+key} rows={2} maxLength={3000} readOnly={readOnly} value={values[key]??''}
   onChange={event=>onChange({...values,[key]:event.target.value})}/>
 </div>);
}

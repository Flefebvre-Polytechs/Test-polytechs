'use client';

import {useEffect,useId,useRef,type ReactNode} from 'react';
import {ListChecks,MoreHorizontal,Trash2} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {FiveWhyTree} from '@/components/ticket-five-why-tree';
import {TicketEightD,TicketEightDLegacy} from '@/components/ticket-eight-d';
import {TicketIshikawa} from '@/components/ticket-ishikawa';
import {TicketCauseTreeFields} from '@/components/ticket-cause-tree';
import {ticketAnalysisMethods,ticketFiveWhyCauses,ticketIshikawaFamilies,type Task,type TicketAnalysis} from '@/lib/hub';

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

export function TicketAnalysisFields({analysis,problem,description,actions,actionPlan,people,readOnly,disabled,showRequest,onChange,onViewAction}:{
 analysis:TicketAnalysis;problem:string;description:string;actions:Task[];actionPlan?:ReactNode;people:{id:string;name:string}[];
 readOnly:boolean;disabled:boolean;showRequest:number;onChange:(analysis:TicketAnalysis,action?:Task)=>void;onViewAction:(id:string)=>void;
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
 const causes=analysis.method==='5p'?ticketFiveWhyCauses(analysis):null;
 const ishikawa=analysis.method==='ishikawa';
 const factCount=analysis.causeTree?.facts.length??0;
 const fields=ishikawa?ticketIshikawaFamilies:method.fields;
 const filled=fields.filter(([key])=>analysis.values[key]?.trim()).length;

 return <section className="ticket-analysis-section" aria-labelledby={id+'-heading'}>
  <header className="ticket-analysis-heading">
   <h3 id={id+'-heading'} ref={heading} tabIndex={-1}><ListChecks size={17} aria-hidden="true"/> Analyse · {method.label}</h3>
   {analysis.method==='8d'?<small>Rapport de réclamation</small>
    :analysis.method==='arbre-causes'?<small>{factCount} {factCount===1?'antécédent':'antécédents'}</small>
    :<small>{causes?causes.length+(causes.length===1?' cause':' causes'):`${filled}/${fields.length} ${ishikawa?'familles renseignées':'renseignés'}`}</small>}
  </header>
  {analysis.method==='8d'?<TicketEightD analysis={analysis} problem={problem} description={description} actions={actions}
   actionPlan={actionPlan} people={people} readOnly={readOnly} disabled={disabled} onChange={onChange} onViewAction={onViewAction}
   legacyResponses={<TicketEightDLegacy responses={analysis.values} fields={method.fields}
    disabled={readOnly||disabled} onChange={values=>onChange({...analysis,values})}/>}/>
   :causes?<FiveWhyTree causes={causes} problem={problem} actions={actions} people={people} readOnly={readOnly} disabled={disabled} onViewAction={onViewAction}
   onChange={(next,action)=>onChange({method:'5p',values:{},causes:next},action)}/>
   :ishikawa?<TicketIshikawa problem={problem} values={analysis.values} readOnly={readOnly} disabled={disabled}
    onChange={values=>onChange({...analysis,values})}/>
   :analysis.method==='arbre-causes'?<TicketCauseTreeFields tree={analysis.causeTree} problem={problem} readOnly={readOnly} disabled={disabled}
    onChange={causeTree=>onChange({...analysis,causeTree})}/>
   :<fieldset className="ticket-analysis-fields" disabled={disabled}>
    <legend className="sr-only">{method.label}</legend>
    <AnalysisResponses method={analysis.method} values={analysis.values} readOnly={readOnly}
     onChange={values=>onChange({...analysis,values})}/>
   </fieldset>}
 </section>;
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

'use client';

import {useEffect,useId,useRef} from 'react';
import {ListChecks,MoreHorizontal,Trash2} from 'lucide-react';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {ticketAnalysisMethods,type TicketAnalysis} from '@/lib/hub';

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
 const filled=method.fields.filter(([key])=>analysis.values[key]?.trim()).length;

 return <section className="ticket-analysis-section" aria-labelledby={id+'-heading'}>
  <header className="ticket-analysis-heading">
   <h3 id={id+'-heading'} ref={heading} tabIndex={-1}><ListChecks size={17} aria-hidden="true"/> Analyse · {method.label}</h3>
   <small>{filled}/{method.fields.length} renseignés</small>
  </header>
  <fieldset className="ticket-analysis-fields" disabled={disabled}>
   <legend className="sr-only">{method.label}</legend>
   {method.fields.map(([key,label])=><div key={key}>
    <label htmlFor={id+key}>{label}</label>
    <textarea id={id+key} rows={2} maxLength={3000} readOnly={readOnly} value={analysis.values[key]??''}
     onChange={event=>onChange({...analysis,values:{...analysis.values,[key]:event.target.value}})}/>
   </div>)}
  </fieldset>
 </section>;
}

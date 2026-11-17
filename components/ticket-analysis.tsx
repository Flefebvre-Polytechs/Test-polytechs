'use client';

import {useId,useRef,useState} from 'react';
import {ChevronRight,ListChecks} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {ticketAnalysisMethods,type TicketAnalysis} from '@/lib/hub';

export function TicketAnalysisButton({analysis,readOnly,disabled,onChange}:{
 analysis?:TicketAnalysis;readOnly:boolean;disabled:boolean;onChange:(analysis:TicketAnalysis|undefined)=>void;
}){
 const id=useId();
 const title=useRef<HTMLHeadingElement>(null);
 const [confirmRemove,setConfirmRemove]=useState(false);
 const method=analysis?ticketAnalysisMethods[analysis.method]:undefined;
 const filled=method?.fields.filter(([key])=>analysis?.values[key]?.trim()).length;

 return <Dialog onOpenChange={open=>{if(!open)setConfirmRemove(false)}}>
  <DialogTrigger asChild>
   <button type="button" className="ticket-toolbar-button ticket-analysis-button" disabled={disabled}
    aria-label={method?'Ouvrir l’analyse · '+method.label:'Ajouter une méthode d’analyse'}>
    <ListChecks size={15} aria-hidden="true"/>Analyse
   </button>
  </DialogTrigger>
  <DialogContent className="ticket-analysis-dialog" showCloseButton={false} onOpenAutoFocus={event=>{
   event.preventDefault();
   title.current?.focus();
  }}>
   <header className="ticket-analysis-header">
    <DialogTitle ref={title} tabIndex={-1}>{method?.label??'Méthode d’analyse'}</DialogTitle>
    <DialogDescription>{method?`${filled}/${method.fields.length} renseignés`:'Choisissez une méthode.'}</DialogDescription>
   </header>
   <div className="ticket-analysis-body">
    {method&&analysis?<fieldset className="ticket-analysis-fields" disabled={disabled}>
     <legend className="sr-only">{method.label}</legend>
     {method.fields.map(([key,label])=><div key={key}>
      <label htmlFor={id+key}>{label}</label>
      <textarea id={id+key} rows={2} maxLength={3000} readOnly={readOnly} value={analysis.values[key]??''}
       onChange={event=>onChange({...analysis,values:{...analysis.values,[key]:event.target.value}})}/>
     </div>)}
    </fieldset>:<div className="ticket-analysis-options">
     {Object.entries(ticketAnalysisMethods).map(([key,{label}])=><button type="button" key={key} disabled={disabled||readOnly}
      onClick={()=>{title.current?.focus();onChange({method:key as TicketAnalysis['method'],values:{}})}}>
      {label}<ChevronRight size={15} aria-hidden="true"/>
     </button>)}
    </div>}
   </div>
   <footer className="ticket-analysis-footer">
    {!readOnly&&analysis&&(confirmRemove?<div className="ticket-analysis-confirm">
     <p>Les réponses seront retirées à l’enregistrement du ticket.</p>
     <Button type="button" variant="ghost" size="sm" onClick={()=>{title.current?.focus();setConfirmRemove(false)}}>Annuler</Button>
     <Button type="button" variant="destructive" size="sm" disabled={disabled}
      onClick={()=>{title.current?.focus();onChange(undefined);setConfirmRemove(false)}}>Confirmer le retrait</Button>
    </div>:<Button type="button" variant="ghost" size="sm" disabled={disabled}
     onClick={()=>{title.current?.focus();setConfirmRemove(true)}}>Retirer l’analyse</Button>)}
    <DialogClose asChild><Button type="button" variant="outline" size="sm">Retour au ticket</Button></DialogClose>
   </footer>
  </DialogContent>
 </Dialog>;
}

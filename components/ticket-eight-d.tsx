'use client';

import {useId,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import {FiveWhyTree} from '@/components/ticket-five-why-tree';
import {eightDChecks,eightDFields,eightDRootCauses,eightDSteps,eightDValidations,eightDVerificationFields,type EightDField,type Task,type TicketAnalysis} from '@/lib/hub';

type ReportProps = {
 analysis: TicketAnalysis;
 problem: string;
 description: string;
 actions: Task[];
 actionPlan: ReactNode;
 readOnly: boolean;
 disabled: boolean;
 onChange: (analysis:TicketAnalysis,action?:Task)=>void;
 legacyResponses: ReactNode;
};

export function TicketEightD({analysis,problem,description,actions,actionPlan,readOnly,disabled,onChange,legacyResponses}:ReportProps){
 const {values}=analysis;
 const filledActions=actions.filter(action=>action.title.trim());
 const completedActions=filledActions.filter(action=>action.done).length;
 const patch=(key:string,value:string)=>onChange({...analysis,values:{...values,[key]:value}});
 const field=({id,label,kind,options}:EightDField)=>(
  <label className={kind==='textarea'?'ticket-8d-wide':undefined} key={id}>
   <span>{label}</span>
   {kind==='textarea'?<textarea rows={3} readOnly={readOnly} maxLength={3000} value={values[id]??''} onChange={event=>patch(id,event.target.value)}/>
    :options?<select disabled={readOnly} value={values[id]??''} onChange={event=>patch(id,event.target.value)}>
     <option value="">Non renseigné</option>
     {options.map(option=><option key={option}>{option}</option>)}
    </select>:<input readOnly={readOnly} type={kind==='date'?'date':kind==='quantity'?'number':'text'}
     min={kind==='quantity'?0:undefined} max={kind==='quantity'?999999999.999999:undefined}
     step={kind==='quantity'?0.000001:undefined} maxLength={3000} value={values[id]??''}
     onChange={event=>patch(id,event.target.value)}/>}
  </label>
 );
 const extraField=(key:string)=>field(eightDFields.get(key)!);

 return <div className="ticket-8d-report">
  {eightDSteps.map(step=><details key={step.number} open={step.number===1} className="ticket-8d-step">
   <summary>
    <span className="ticket-8d-number">D{step.number}</span>
    <span>{step.title}</span>
    {step.number===6&&filledActions.length>0&&<small>{completedActions}/{filledActions.length} réalisées</small>}
    <ChevronDown size={16} aria-hidden="true"/>
   </summary>
   {step.number===6?<div className="ticket-8d-body">{actionPlan}</div>
    :<fieldset className="ticket-8d-body" disabled={disabled}>
     <legend className="sr-only">{step.title}</legend>
     {step.number===2&&description.trim()&&<div className="ticket-8d-context">
      <strong>Description du ticket</strong><p>{description}</p>
     </div>}
     {step.number===4&&<div className="ticket-8d-checks">
      {eightDChecks.map(([id,label])=><div className="ticket-8d-control" key={id}>
       <h4>{label}</h4>
       <div className="ticket-8d-grid">{extraField(id+'Result')}{extraField(id+'Comment')}</div>
      </div>)}
     </div>}
     {step.number===5&&<div className="ticket-8d-root-causes">
      {eightDRootCauses.map(([id,label])=><label key={id}>
       <input type="checkbox" disabled={readOnly} checked={values['root-'+id]==='Oui'}
        onChange={event=>patch('root-'+id,event.target.checked?'Oui':'')}/>
       <span>{label}</span>
      </label>)}
     </div>}
     <div className="ticket-8d-grid">{step.fields.filter(field=>field.id!=='sampleQuantity'||values.sampleRequest==='Oui'||values.sampleQuantity).map(field)}</div>
     {step.number===4&&<div className="ticket-8d-why">
      <h4>5 Pourquoi</h4>
      <FiveWhyTree causes={analysis.causes??[]} problem={values.problem||problem} actions={actions}
       readOnly={readOnly} disabled={disabled}
       onChange={(causes,action)=>onChange({...analysis,causes},action)}/>
     </div>}
     {step.number===7&&<div className="ticket-8d-checks">
      {eightDVerificationFields.map((fields,index)=><div className="ticket-8d-control" key={index}>
       <h4>Contrôle {index+1}</h4>
       <div className="ticket-8d-grid">{fields.map(field)}</div>
      </div>)}
     </div>}
     {step.number===8&&<div className="ticket-8d-checks ticket-8d-validations">
      {eightDValidations.map(([id,label])=><div className="ticket-8d-control" key={id}>
       <h4>{label}</h4>
       <div className="ticket-8d-grid">{extraField('validated-'+id)}{extraField('validator-'+id)}</div>
      </div>)}
     </div>}
    </fieldset>}
  </details>)}
  {legacyResponses}
 </div>;
}

export function TicketEightDLegacy({responses,onChange,fields,disabled}:{
 responses:Record<string,string>;
 fields:readonly (readonly [string,string])[];
 onChange:(values:Record<string,string>)=>void;
 disabled:boolean;
}){
 const id=useId();
 const existing=fields.filter(([key])=>Object.hasOwn(responses,key));
 if(!existing.length)return null;
 return <details className="ticket-8d-step ticket-8d-legacy">
  <summary><span>Réponses du formulaire 8D précédent</span><ChevronDown size={16} aria-hidden="true"/></summary>
  <fieldset className="ticket-8d-body ticket-8d-grid" disabled={disabled}>
   <legend className="sr-only">Réponses du formulaire précédent</legend>
   {existing.map(([key,label])=><label key={key} className="ticket-8d-wide" htmlFor={id+key}>
    <span>{label}</span><textarea id={id+key} rows={2} maxLength={3000} value={responses[key]}
     onChange={event=>onChange({...responses,[key]:event.target.value})}/>
   </label>)}
  </fieldset>
 </details>;
}

'use client';

import {useState,type FormEvent,type ReactNode} from 'react';
import {Plus,UserMinus,UserPlus} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {PersonAvatar} from '@/components/person-avatar';
import {
  competenceLevels,formatAssessmentDate,type CompetenceAssessment,type CompetenceLevel,
  type CompetencePerson,type CompetenceSkill,
} from '@/lib/competences';

export type SaveCompetence = <T>(body:Record<string,unknown>)=>Promise<T>;

function CompetenceDialog({title,description,busy,close,children}:{
  title:string;description:string;busy:boolean;close:()=>void;children:ReactNode;
}) {
  return (
    <Dialog open onOpenChange={open=>{if(!open&&!busy)close()}}>
      <DialogContent className="skills-dialog" showCloseButton={false}>
        <header>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </header>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function FormFooter({busy,close,label,disabled=false}:{
  busy:boolean;close:()=>void;label:string;disabled?:boolean;
}) {
  return (
    <footer className="skills-dialog-footer">
      <button type="button" className="skills-button" disabled={busy} onClick={close}>Annuler</button>
      <button type="submit" className="skills-button primary" disabled={busy||disabled}>{busy?'Enregistrement…':label}</button>
    </footer>
  );
}

export function SkillDialog({skill,families,save,onSaved,close}:{
  skill?:CompetenceSkill;families:string[];save:SaveCompetence;onSaved:(skill:CompetenceSkill)=>void;close:()=>void;
}) {
  const [name,setName]=useState(skill?.name??'');
  const [family,setFamily]=useState(skill?.family??'');
  const [target,setTarget]=useState(String(skill?.target??2));
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try {
      const {skill:result}=await save<{skill:CompetenceSkill}>({
        action:'skill',id:skill?.id,revision:skill?.revision,name,family,target:Number(target),
      });
      onSaved(result);
    }catch(e) {setError((e as Error).message)}
    finally {setBusy(false)}
  }

  return (
    <CompetenceDialog title={skill?'Modifier la compétence':'Nouvelle compétence'}
      description="La cible indique le nombre de personnes autonomes souhaité dans ce service." busy={busy} close={close}>
      <form className="skills-form" onSubmit={submit}>
        <label>Nom de la compétence
          <input value={name} maxLength={120} required disabled={busy}
            placeholder="Ex. Régler une ligne de mélange" onChange={event=>setName(event.target.value)}/>
        </label>
        <label>Famille
          <input value={family} list="competence-families" maxLength={70} required disabled={busy}
            placeholder="Ex. Conduite de ligne" onChange={event=>setFamily(event.target.value)}/>
          <datalist id="competence-families">{families.map(item=><option key={item} value={item}/>)}</datalist>
        </label>
        <label>Cible de personnes autonomes
          <input type="number" value={target} min={1} max={99} required disabled={busy}
            onChange={event=>setTarget(event.target.value)}/>
        </label>
        {error&&<p className="skills-error" role="alert">{error}</p>}
        <FormFooter busy={busy} close={close} label={skill?'Enregistrer les modifications':'Ajouter la compétence'}/>
      </form>
    </CompetenceDialog>
  );
}

export function AssessmentDialog({skill,person,assessment,save,onSaved,close}:{
  skill:CompetenceSkill;person:CompetencePerson;assessment?:CompetenceAssessment;save:SaveCompetence;
  onSaved:(assessment:CompetenceAssessment)=>void;close:()=>void;
}) {
  const [level,setLevel]=useState<CompetenceLevel|''>(assessment?.level??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try {
      const data=await save<{assessment:CompetenceAssessment}>({
        action:'assessment',skillId:skill.id,personId:person.id,level,revision:assessment?.revision??0,
      });
      onSaved(data.assessment);
    }catch(e) {setError((e as Error).message)}
    finally {setBusy(false)}
  }

  return (
    <CompetenceDialog title="Évaluer la compétence" description={person.name+' · '+skill.name} busy={busy} close={close}>
      <form className="skills-form" onSubmit={submit}>
        <fieldset className="skills-level-options" disabled={busy}>
          <legend className="sr-only">Niveau de maîtrise</legend>
          {(Object.entries(competenceLevels) as [CompetenceLevel,(typeof competenceLevels)[CompetenceLevel]][]).map(([code,detail])=>(
            <label key={code}>
              <input type="radio" name="level" value={code} checked={level===code} onChange={()=>setLevel(code)}/>
              <span className="skills-level" data-level={code}>{code}</span>
              <span><strong>{detail.label}</strong><small>{detail.description}</small></span>
            </label>
          ))}
          {!!assessment?.level&&<label>
            <input type="radio" name="level" value="" checked={level===''} onChange={()=>setLevel('')}/>
            <span className="skills-level" data-level="">–</span>
            <span><strong>Retirer l’évaluation</strong></span>
          </label>}
        </fieldset>
        {!!assessment?.level&&(
          <p className="skills-evaluation-date">
            Évalué le <time dateTime={assessment.assessedAt}>{formatAssessmentDate(assessment.assessedAt)}</time>
            {assessment.assessedBy?' par '+assessment.assessedBy:'.'}
          </p>
        )}
        {error&&<p className="skills-error" role="alert">{error}</p>}
        <FormFooter busy={busy} close={close} label="Enregistrer l’évaluation" disabled={!level&&!assessment?.level}/>
      </form>
    </CompetenceDialog>
  );
}

export function RosterDialog({people,save,onSaved,close}:{
  people:CompetencePerson[];save:SaveCompetence;onSaved:(person:CompetencePerson)=>void;close:()=>void;
}) {
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');

  async function update(person?:CompetencePerson) {
    if(busy)return;
    setBusy(true);setError('');
    try {
      if(person) {
        const data=await save<Pick<CompetencePerson,'active'|'revision'>>({
          action:'person-status',id:person.id,revision:person.revision,active:!person.active,
        });
        onSaved({...person,...data});
      }else {
        const data=await save<{person:CompetencePerson}>({action:'person',name});
        onSaved(data.person);
        setName('');
      }
    }catch(e) {setError((e as Error).message)}
    finally {setBusy(false)}
  }

  return (
    <CompetenceDialog title="Effectif de la matrice"
      description="Les membres de l’équipe figurent dans la matrice. Ajoutez ici les collaborateurs sans compte Polytechs Connect."
      busy={busy} close={close}>
      <form className="skills-form skills-roster-form" onSubmit={event=>{event.preventDefault();void update()}}>
        <label>Nom du collaborateur
          <input value={name} onChange={event=>setName(event.target.value)} maxLength={100} required disabled={busy}
            placeholder="Prénom et nom"/>
        </label>
        <button type="submit" className="skills-button primary" disabled={busy||!name.trim()}><Plus size={16}/> Ajouter</button>
      </form>
      {error&&<p className="skills-error" role="alert">{error}</p>}
      {people.length>0&&<ul className="skills-roster">
        {people.map(person=>(
          <li key={person.id}>
            <PersonAvatar id={person.userId??undefined} name={person.name} size={30}/>
            <span><strong data-no-translate>{person.name}</strong><small>{person.userId?'Membre de l’équipe':person.active?'Sans compte':'Retiré de la matrice'}</small></span>
            {!person.userId&&(
              <button type="button" className="skills-button" disabled={busy}
                aria-label={(person.active?'Retirer ':'Réintégrer ')+person.name} onClick={()=>void update(person)}>
                {person.active?<UserMinus size={15}/>:<UserPlus size={15}/>} {person.active?'Retirer':'Réintégrer'}
              </button>
            )}
          </li>
        ))}
      </ul>}
      <footer className="skills-dialog-footer">
        <button type="button" className="skills-button" disabled={busy} onClick={close}>Fermer</button>
      </footer>
    </CompetenceDialog>
  );
}

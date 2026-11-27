'use client';

import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowRightLeft,Plus,UserMinus,UserPlus} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle} from '@/components/ui/dialog';
import {PersonAvatar} from '@/components/person-avatar';
import {hubRequest} from '@/lib/hub-request';
import {
  competenceLevels,formatAssessmentDate,type CompetenceAssessment,type CompetenceLevel,type CompetenceLibrarySkill,
  type CompetencePerson,type CompetenceProfileSkill,type CompetenceSkill,type CompetenceTeam,
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

export function LibrarySkillDialog({skill,families,service,save,onSaved,close}:{
  skill?:CompetenceLibrarySkill;families:string[];service:string;save:SaveCompetence;
  onSaved:(included:boolean)=>void;close:()=>void;
}) {
  const [name,setName]=useState(skill?.name??'');
  const [family,setFamily]=useState(skill?.family??'');
  const [target,setTarget]=useState('2');
  const [include,setInclude]=useState(!skill);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try {
      await save({
        action:'library-skill',id:skill?.id,revision:skill?.revision,name,family,target:include?Number(target):undefined,
      });
      onSaved(include);
    }catch(e) {setError((e as Error).message)}
    finally {setBusy(false)}
  }

  return (
    <CompetenceDialog title={skill?'Modifier dans la bibliothèque':'Nouvelle compétence'}
      description="Le nom et la famille sont communs à tous les services." busy={busy} close={close}>
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
        {!skill&&<label className="skills-checkline">
          <input type="checkbox" checked={include} disabled={busy} onChange={event=>setInclude(event.target.checked)}/>
          <span>Ajouter à la matrice du service {service}</span>
        </label>}
        {include&&<label>Cible de personnes autonomes
          <input type="number" value={target} min={1} max={99} required disabled={busy}
            onChange={event=>setTarget(event.target.value)}/>
        </label>}
        {error&&<p className="skills-error" role="alert">{error}</p>}
        <FormFooter busy={busy} close={close} label={skill?'Enregistrer les modifications':'Créer la compétence'}/>
      </form>
    </CompetenceDialog>
  );
}

export function TeamSkillDialog({skill,assignment,service,save,onSaved,close}:{
  skill:CompetenceLibrarySkill;assignment?:CompetenceSkill;service:string;save:SaveCompetence;
  onSaved:(removed:boolean)=>void;close:()=>void;
}) {
  const [target,setTarget]=useState(String(assignment?.target??2));
  const [remove,setRemove]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError('');
    try {
      await save({action:'team-skill',skillId:skill.id,revision:assignment?.revision,target:Number(target),remove});
      onSaved(remove);
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }

  return (
    <CompetenceDialog title={remove?'Retirer de la matrice':assignment?'Cible d’autonomie':'Ajouter à la matrice'}
      description={skill.name+' · '+service} busy={busy} close={close}>
      <form className="skills-form" onSubmit={submit}>
        {remove?<p className="skills-evaluation-date">Les évaluations restent dans la fiche des collaborateurs.</p>
          :<label>Cible de personnes autonomes
            <input type="number" value={target} min={1} max={99} required disabled={busy}
              onChange={event=>setTarget(event.target.value)}/>
          </label>}
        {assignment&&!remove&&<button type="button" className="skills-text-action skills-remove-action" disabled={busy}
          onClick={()=>{setRemove(true);setError('')}}>Retirer de la matrice</button>}
        {error&&<p className="skills-error" role="alert">{error}</p>}
        <FormFooter busy={busy} close={close} label={remove?'Retirer la compétence':assignment?'Enregistrer la cible':'Ajouter à la matrice'}/>
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

export function RosterDialog({people,save,onSaved,onView,onTransfer,close}:{
  people:CompetencePerson[];save:SaveCompetence;onSaved:(person:CompetencePerson)=>void;
  onView:(person:CompetencePerson)=>void;onTransfer?:((person:CompetencePerson)=>void);close:()=>void;
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
            <div className="skills-roster-person">
              {person.active?<button type="button" className="skills-text-action" disabled={busy} onClick={()=>onView(person)}
                aria-label={'Voir les acquis de '+person.name} data-no-translate>{person.name}</button>
                :<strong data-no-translate>{person.name}</strong>}
              <small>{person.userId?'Membre de l’équipe':person.active?'Sans compte':'Retiré de la matrice'}</small>
            </div>
            {!person.userId&&(
              <div className="skills-roster-actions">
                {!!person.active&&onTransfer&&<button type="button" className="skills-button" disabled={busy}
                  aria-label={'Transférer '+person.name} onClick={()=>onTransfer(person)}>
                  <ArrowRightLeft size={15} aria-hidden="true"/> Transférer
                </button>}
                <button type="button" className="skills-button" disabled={busy}
                  aria-label={(person.active?'Retirer ':'Réintégrer ')+person.name} onClick={()=>void update(person)}>
                  {person.active?<UserMinus size={15}/>:<UserPlus size={15}/>} {person.active?'Retirer':'Réintégrer'}
                </button>
              </div>
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

export function TransferPersonDialog({person,teams,save,onSaved,close}:{
  person:CompetencePerson;teams:CompetenceTeam[];save:SaveCompetence;onSaved:()=>void;close:()=>void;
}) {
  const [destination,setDestination]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(busy||!destination)return;
    setBusy(true);setError('');
    try {
      await save({action:'person-transfer',id:person.id,revision:person.revision,destination});
      onSaved();
    }catch(e){setError((e as Error).message)}
    finally{setBusy(false)}
  }

  return (
    <CompetenceDialog title="Transférer le collaborateur" description={person.name+' conservera ses évaluations dans le nouveau service.'}
      busy={busy} close={close}>
      <form className="skills-form" onSubmit={submit}>
        <label>Service de destination
          <select value={destination} required disabled={busy} onChange={event=>setDestination(event.target.value)}>
            <option value="">Choisir un service</option>
            {teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>
        {error&&<p className="skills-error" role="alert">{error}</p>}
        <FormFooter busy={busy} close={close} label="Transférer" disabled={!destination}/>
      </form>
    </CompetenceDialog>
  );
}

export function CompetenceProfileDialog({person,teamId,close}:{person:CompetencePerson;teamId:string;close:()=>void}) {
  const [skills,setSkills]=useState<CompetenceProfileSkill[]|null>(null),[error,setError]=useState('');

  useEffect(()=>{
    let current=true;
    const params=new URLSearchParams({view:'person',team:teamId,person:person.id});
    hubRequest('/api/competences?'+params).then((data:{skills:CompetenceProfileSkill[]})=>{
      if(current)setSkills(data.skills);
    }).catch(e=>{if(current)setError(e.message)});
    return ()=>{current=false};
  },[person.id,teamId]);

  return (
    <CompetenceDialog title="Compétences acquises" description={person.name} busy={false} close={close}>
      {error&&<p className="skills-error" role="alert">{error}</p>}
      {!skills&&!error&&<p className="skills-inline-hint" role="status">Chargement des évaluations…</p>}
      {skills?.length===0&&<p className="skills-inline-hint">Aucune évaluation enregistrée.</p>}
      {!!skills?.length&&<ul className="skills-profile-list">
        {skills.map(skill=><li key={skill.id}>
          <span className="skills-level" data-level={skill.level} title={competenceLevels[skill.level].label}>
            {skill.level}<span className="sr-only"> {competenceLevels[skill.level].label}</span>
          </span>
          <div><strong>{skill.name}</strong><small>{skill.family}{!skill.inMatrix&&' · Hors matrice du service'}</small></div>
          <time dateTime={skill.assessedAt}>{formatAssessmentDate(skill.assessedAt)}</time>
        </li>)}
      </ul>}
      <footer className="skills-dialog-footer"><button type="button" className="skills-button" onClick={close}>Fermer</button></footer>
    </CompetenceDialog>
  );
}

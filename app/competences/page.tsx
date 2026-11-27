'use client';

import {useEffect,useState} from 'react';
import {BookOpen,Grid3X3,Plus,RefreshCw,UserRoundSearch,UsersRound} from 'lucide-react';
import {AccountGate} from '@/components/account-gate';
import {HubFrame,useServiceFilter} from '@/components/hub-layout';
import {hubRequest} from '@/lib/hub-request';
import {labelKey} from '@/lib/hub';
import type {CompetenceAssessment,CompetenceLibrarySkill,CompetenceMatrix,CompetencePerson,CompetenceSkill} from '@/lib/competences';
import {
  AssessmentDialog,CompetenceProfileDialog,LibrarySkillDialog,RosterDialog,TeamSkillDialog,TransferPersonDialog,type SaveCompetence,
} from './competence-dialogs';
import {CompetenceLibrary} from './competence-library';
import {SkillsMatrix} from './competence-matrix';
import {RelaySearch} from './relay-search';
import './style.css';

type Editor =
  | {kind:'library-skill';skill?:CompetenceLibrarySkill}
  | {kind:'team-skill';skill:CompetenceLibrarySkill;assignment?:CompetenceSkill}
  | {kind:'assessment';skill:CompetenceSkill;person:CompetencePerson;assessment?:CompetenceAssessment}
  | {kind:'roster'}
  | {kind:'profile';person:CompetencePerson;fromRoster?:boolean}
  | {kind:'transfer';person:CompetencePerson};

function ServiceCompetences() {
  const [requestedTeam,chooseTeam]=useServiceFilter();
  const [data,setData]=useState<CompetenceMatrix|null>(null);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0),[notice,setNotice]=useState('');
  const [view,setView]=useState<'matrix'|'library'|'relays'>('matrix');
  const [preset,setPreset]=useState<CompetenceSkill>();
  const [editor,setEditor]=useState<Editor|null>(null);
  const [rosterChanged,setRosterChanged]=useState(false);

  useEffect(()=>{
    let current=true;
    const path='/api/competences'+(requestedTeam?'?team='+encodeURIComponent(requestedTeam):'');
    hubRequest(path).then((next:CompetenceMatrix)=>{
      if(current){setData(next);setError('')}
    }).catch(e=>{if(current){setData(null);setError(e.message)}});
    return ()=>{current=false};
  },[requestedTeam,attempt]);

  function refresh() {
    setError('');setData(null);setAttempt(value=>value+1);
  }

  const matrix=data&&(!requestedTeam||data.teamId===requestedTeam)?data:null;
  const service=matrix?.teams.find(team=>team.id===matrix.teamId)?.name??'';
  const save:SaveCompetence=async body=>hubRequest('/api/competences',{...body,teamId:matrix?.teamId});

  function close() {
    setEditor(null);
    if(!rosterChanged)return;
    setRosterChanged(false);
    setAttempt(value=>value+1);
  }

  function reloadAfterSave(message:string) {
    setEditor(null);setRosterChanged(false);setNotice(message);setAttempt(value=>value+1);
  }

  return (
    <section className="skills-page" aria-labelledby="skills-title">
      <header className="skills-cover">
        <span className="skills-cover-icon"><Grid3X3 size={26} aria-hidden="true"/></span>
        <div><h1 id="skills-title">Compétences &amp; polyvalence</h1>
          <p>Évaluez votre équipe et identifiez un relais en cas d’absence.</p></div>
        {matrix&&<label className="skills-team-selector">Service de la matrice
          <select value={matrix.teamId} onChange={event=>{
            setData(null);setError('');setNotice('');setPreset(undefined);chooseTeam(event.target.value);
          }}>
            {matrix.teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
        </label>}
      </header>
      {!matrix&&!error&&<p className="skills-panel skills-loading" role="status">Chargement de la matrice…</p>}
      {error&&<div className="skills-panel skills-loading" role="alert">
        <p>{error}</p><button type="button" className="skills-button" onClick={refresh}><RefreshCw size={15}/> Réessayer</button>
        {requestedTeam&&<button type="button" className="skills-button" onClick={()=>{setError('');chooseTeam('')}}>Revenir à mes services</button>}
      </div>}
      {matrix&&(
        <>
          <div className="skills-toolbar">
            <nav className="skills-tabs" aria-label="Vues des compétences">
              <button type="button" aria-pressed={view==='matrix'} onClick={()=>setView('matrix')}><Grid3X3 size={17}/> Matrice</button>
              <button type="button" aria-pressed={view==='library'} onClick={()=>setView('library')}><BookOpen size={17}/> Bibliothèque</button>
              <button type="button" aria-pressed={view==='relays'} onClick={()=>{
                if(view!=='relays'){setPreset(undefined);setView('relays')}
              }}><UserRoundSearch size={17}/> Rechercher un relais</button>
            </nav>
            {view==='matrix'&&<div className="skills-toolbar-actions">
              <button type="button" className="skills-button" onClick={()=>setEditor({kind:'roster'})}><UsersRound size={17}/> Gérer l’effectif</button>
              <button type="button" className="skills-button primary" onClick={()=>setView('library')}><Plus size={18}/> Ajouter une compétence</button>
            </div>}
            {view==='library'&&<button type="button" className="skills-button primary" onClick={()=>setEditor({kind:'library-skill'})}>
              <Plus size={18}/> Créer une compétence
            </button>}
          </div>
          {notice&&<p className="skills-notice" role="status">{notice}</p>}
          {view==='matrix'?(
            <SkillsMatrix key={matrix.teamId} matrix={matrix}
              editSkill={skill=>setEditor({kind:'team-skill',skill,assignment:skill})}
              viewPerson={person=>setEditor({kind:'profile',person})}
              assess={(skill,person,assessment)=>setEditor({kind:'assessment',skill,person,assessment})}
              findRelay={skill=>{setPreset(skill);setView('relays');setNotice('')}}/>
          ):view==='library'?<CompetenceLibrary key={matrix.teamId} library={matrix.library} assigned={matrix.skills}
            service={service} canEdit={matrix.canEditLibrary}
            onAdd={skill=>setEditor({kind:'team-skill',skill})} onEdit={skill=>setEditor({kind:'library-skill',skill})}/>
            :<RelaySearch key={matrix.teamId+(preset?.id??'')} teamId={matrix.teamId} teams={matrix.teams} skill={preset}/>}
          {editor?.kind==='library-skill'&&<LibrarySkillDialog skill={editor.skill} service={service}
            families={[...new Map(matrix.library.map(skill=>[labelKey(skill.family),skill.family])).values()].sort((a,b)=>a.localeCompare(b,'fr'))}
            save={save} close={close} onSaved={included=>reloadAfterSave(included?'Compétence créée et ajoutée à la matrice.':'Bibliothèque mise à jour.')}/>}
          {editor?.kind==='team-skill'&&<TeamSkillDialog skill={editor.skill} assignment={editor.assignment} service={service}
            save={save} close={close} onSaved={removed=>reloadAfterSave(removed?'Compétence retirée de la matrice.'
              :editor.assignment?'Cible d’autonomie mise à jour.':'Compétence ajoutée à la matrice.')}/>}
          {editor?.kind==='assessment'&&<AssessmentDialog skill={editor.skill} person={editor.person} assessment={editor.assessment}
            save={save} close={close} onSaved={assessment=>{
              setData(current=>current?{...current,assessments:[
                ...current.assessments.filter(item=>item.skillId!==assessment.skillId||item.personId!==assessment.personId),assessment,
              ]}:current);
              setNotice(assessment.level?'Évaluation enregistrée.':'Évaluation retirée.');close();
            }}/>}
          {editor?.kind==='roster'&&<RosterDialog people={matrix.people} save={save} close={close}
            onView={person=>setEditor({kind:'profile',person,fromRoster:true})}
            onTransfer={matrix.teams.length>1?person=>setEditor({kind:'transfer',person}):undefined} onSaved={person=>{
            setData(current=>current?{...current,people:[...current.people.filter(item=>item.id!==person.id),person]
              .sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name,'fr'))}:current);
            setRosterChanged(true);setNotice('Effectif mis à jour.');
          }}/>}
          {editor?.kind==='profile'&&<CompetenceProfileDialog person={editor.person} teamId={matrix.teamId}
            close={()=>editor.fromRoster?setEditor({kind:'roster'}):close()}/>}
          {editor?.kind==='transfer'&&<TransferPersonDialog person={editor.person} teams={matrix.teams.filter(team=>team.id!==matrix.teamId)}
            save={save} close={()=>setEditor({kind:'roster'})} onSaved={()=>reloadAfterSave('Collaborateur transféré avec ses évaluations.')}/>}
        </>
      )}
    </section>
  );
}

export default function CompetencesPage() {
  return <AccountGate>{()=>(
    <HubFrame active="Compétences" className="skills-workspace"><ServiceCompetences/></HubFrame>
  )}</AccountGate>;
}

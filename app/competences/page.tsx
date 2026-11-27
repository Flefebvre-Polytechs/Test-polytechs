'use client';

import {useEffect,useState} from 'react';
import {Grid3X3,Plus,RefreshCw,UserRoundSearch,UsersRound} from 'lucide-react';
import {AccountGate} from '@/components/account-gate';
import {HubFrame,useServiceFilter} from '@/components/hub-layout';
import {hubRequest} from '@/lib/hub-request';
import type {CompetenceAssessment,CompetenceMatrix,CompetencePerson,CompetenceSkill} from '@/lib/competences';
import {AssessmentDialog,RosterDialog,SkillDialog,type SaveCompetence} from './competence-dialogs';
import {SkillsMatrix} from './competence-matrix';
import {RelaySearch} from './relay-search';
import './style.css';

type Editor =
  | {kind:'skill';skill?:CompetenceSkill}
  | {kind:'assessment';skill:CompetenceSkill;person:CompetencePerson;assessment?:CompetenceAssessment}
  | {kind:'roster'};

function ServiceCompetences() {
  const [requestedTeam,chooseTeam]=useServiceFilter();
  const [data,setData]=useState<CompetenceMatrix|null>(null);
  const [error,setError]=useState(''),[attempt,setAttempt]=useState(0),[notice,setNotice]=useState('');
  const [view,setView]=useState<'matrix'|'relays'>('matrix');
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
  const save:SaveCompetence=async body=>hubRequest('/api/competences',{...body,teamId:matrix?.teamId});

  function close() {
    setEditor(null);
    if(!rosterChanged)return;
    setRosterChanged(false);
    refresh();
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
              <button type="button" aria-pressed={view==='relays'} onClick={()=>{
                if(view!=='relays'){setPreset(undefined);setView('relays')}
              }}><UserRoundSearch size={17}/> Rechercher un relais</button>
            </nav>
            {view==='matrix'&&<div className="skills-toolbar-actions">
              <button type="button" className="skills-button" onClick={()=>setEditor({kind:'roster'})}><UsersRound size={17}/> Gérer l’effectif</button>
              <button type="button" className="skills-button primary" onClick={()=>setEditor({kind:'skill'})}><Plus size={18}/> Ajouter une compétence</button>
            </div>}
          </div>
          {notice&&<p className="skills-notice" role="status">{notice}</p>}
          {view==='matrix'?(
            <SkillsMatrix key={matrix.teamId} matrix={matrix}
              editSkill={skill=>setEditor({kind:'skill',skill})}
              assess={(skill,person,assessment)=>setEditor({kind:'assessment',skill,person,assessment})}
              findRelay={skill=>{setPreset(skill);setView('relays');setNotice('')}}/>
          ):<RelaySearch key={matrix.teamId+(preset?.id??'')} teamId={matrix.teamId} teams={matrix.teams} skill={preset}/>}
          {editor?.kind==='skill'&&<SkillDialog skill={editor.skill}
            families={[...new Set(matrix.skills.map(skill=>skill.family))].sort((a,b)=>a.localeCompare(b,'fr'))}
            save={save} close={close} onSaved={skill=>{
              setData(current=>current?{...current,skills:[...current.skills.filter(item=>item.id!==skill.id),skill]
                .sort((a,b)=>a.family.localeCompare(b.family,'fr')||a.name.localeCompare(b.name,'fr'))}:current);
              setNotice('Compétence enregistrée.');close();
            }}/>}
          {editor?.kind==='assessment'&&<AssessmentDialog skill={editor.skill} person={editor.person} assessment={editor.assessment}
            save={save} close={close} onSaved={assessment=>{
              setData(current=>current?{...current,assessments:[
                ...current.assessments.filter(item=>item.skillId!==assessment.skillId||item.personId!==assessment.personId),assessment,
              ]}:current);
              setNotice(assessment.level?'Évaluation enregistrée.':'Évaluation retirée.');close();
            }}/>}
          {editor?.kind==='roster'&&<RosterDialog people={matrix.people} save={save} close={close} onSaved={person=>{
            setData(current=>current?{...current,people:[...current.people.filter(item=>item.id!==person.id),person]
              .sort((a,b)=>b.active-a.active||a.name.localeCompare(b.name,'fr'))}:current);
            setRosterChanged(true);setNotice('Effectif mis à jour.');
          }}/>}
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

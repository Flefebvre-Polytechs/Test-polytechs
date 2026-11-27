'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {Search,UserRoundSearch} from 'lucide-react';
import {PersonAvatar} from '@/components/person-avatar';
import {hubRequest} from '@/lib/hub-request';
import {formatAssessmentDate,type CompetenceSearch,type CompetenceSkill,type CompetenceTeam} from '@/lib/competences';
import {labelKey} from '@/lib/hub';

type RelayQuery = {term:string;team:string;skill?:string};

export function RelaySearch({teamId,teams,skill}:{
  teamId:string;teams:CompetenceTeam[];skill?:CompetenceSkill;
}) {
  const [draft,setDraft]=useState(skill?.name??'');
  const [team,setTeam]=useState(teamId);
  const [query,setQuery]=useState<RelayQuery|null>(skill?{term:skill.name,team:teamId,skill:skill.id}:null);
  const [results,setResults]=useState<CompetenceSearch|null>(null);
  const [error,setError]=useState('');
  const [excluded,setExcluded]=useState('');

  useEffect(()=>{
    if(!query)return;
    let current=true;
    const params=new URLSearchParams({view:'search',q:query.term,team:query.team});
    if(query.skill)params.set('skill',query.skill);
    hubRequest('/api/competences?'+params).then((data:CompetenceSearch)=>{
      if(current)setResults(data);
    }).catch(e=>{if(current)setError(e.message)});
    return ()=>{current=false};
  },[query]);

  function search(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if(labelKey(draft).length<2)return;
    setError('');setResults(null);setExcluded('');
    setQuery({term:draft.trim(),team});
  }

  const people=new Map(results?.relays.map(relay=>[relay.personId,relay.name]));
  const relays=results?.relays.filter(relay=>relay.personId!==excluded);
  const count=new Set(relays?.map(relay=>relay.personId)).size;

  return (
    <section className="skills-panel skills-relays" aria-labelledby="relay-title">
      <div className="skills-relay-heading">
        <span className="skills-metric-icon"><UserRoundSearch size={22}/></span>
        <div><h2 id="relay-title">Rechercher un relais</h2>
          <p>Retrouvez les collaborateurs évalués autonomes sur la compétence recherchée.</p></div>
      </div>
      <form className="skills-relay-form" onSubmit={search}>
        <label>Compétence ou famille
          <input type="search" value={draft} maxLength={120} minLength={2} required
            placeholder="Ex. Réglage, mélange, contrôle…" onChange={event=>setDraft(event.target.value)}/>
        </label>
        {teams.length>1&&<label>Périmètre
          <select value={team} onChange={event=>setTeam(event.target.value)}>
            <option value="">Tous mes services</option>
            {teams.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>}
        <button type="submit" className="skills-button primary" disabled={labelKey(draft).length<2}>
          <Search size={17} aria-hidden="true"/> Rechercher
        </button>
      </form>
      {query&&!results&&!error&&<p className="skills-inline-hint" role="status">Recherche en cours…</p>}
      {error&&<p className="skills-error" role="alert">{error}</p>}
      {results&&relays&&(
        <>
          <div className="skills-relay-results-heading">
            <div>
              <h3>Relais pour « {query?.term} »</h3>
              <p role="status">{count} {count===1?'collaborateur autonome':'collaborateurs autonomes'}</p>
            </div>
            {people.size>0&&<label>Personne à écarter
              <select value={excluded} onChange={event=>setExcluded(event.target.value)}>
                <option value="">Aucune exclusion</option>
                {[...people.entries()].sort((a,b)=>a[1].localeCompare(b[1],'fr')).map(([id,name])=>(
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </label>}
          </div>
          {relays.length?(
            <ul className="skills-relay-list">
              {relays.map(relay=>(
                <li key={relay.skillId+'-'+relay.personId}>
                  <PersonAvatar id={relay.userId??undefined} name={relay.name} size={38}/>
                  <div><strong data-no-translate>{relay.name}</strong>
                    <span>{relay.team} · {relay.skill}</span></div>
                  <span className="skills-relay-level"><span className="skills-level" data-level="U">U</span>
                    <time dateTime={relay.assessedAt}>Évalué le {formatAssessmentDate(relay.assessedAt)}</time>
                  </span>
                </li>
              ))}
            </ul>
          ):<p className="skills-inline-hint">Aucun relais autonome ne correspond à cette recherche.</p>}
          {results.truncated&&<p className="skills-inline-hint">Affinez la recherche pour voir l’ensemble des résultats correspondants.</p>}
          {relays.length>0&&<p className="skills-inline-hint">Vérifiez la présence du relais et, si nécessaire, son habilitation avant l’intervention.</p>}
        </>
      )}
    </section>
  );
}

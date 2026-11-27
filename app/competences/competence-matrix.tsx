'use client';

import {useState} from 'react';
import {ArrowUpRight,Layers3,Search,Target,UserRoundCheck} from 'lucide-react';
import {PersonAvatar} from '@/components/person-avatar';
import {competenceLevels,type CompetenceAssessment,type CompetenceMatrix,type CompetencePerson,type CompetenceSkill} from '@/lib/competences';
import {labelKey} from '@/lib/hub';

export function SkillsMatrix({matrix,editSkill,assess,findRelay}:{
  matrix:CompetenceMatrix;
  editSkill:(skill:CompetenceSkill)=>void;
  assess:(skill:CompetenceSkill,person:CompetencePerson,assessment?:CompetenceAssessment)=>void;
  findRelay:(skill:CompetenceSkill)=>void;
}) {
  const [query,setQuery]=useState(''),[coverage,setCoverage]=useState<'all'|'below'|'no-relay'>('all');
  const people=matrix.people.filter(person=>person.active);
  const bySkill=new Map<string,Map<string,CompetenceAssessment>>();
  for(const assessment of matrix.assessments) {
    const row=bySkill.get(assessment.skillId)??new Map<string,CompetenceAssessment>();
    row.set(assessment.personId,assessment);
    bySkill.set(assessment.skillId,row);
  }
  const skills=matrix.skills.map(skill=>({
    ...skill,
    autonomous:people.filter(person=>bySkill.get(skill.id)?.get(person.id)?.level==='U').length,
  }));
  const met=skills.filter(skill=>skill.autonomous>=skill.target).length;
  const withoutRelay=skills.filter(skill=>skill.autonomous<2).length;
  const groups=new Map<string,typeof skills>();
  const term=labelKey(query);
  for(const skill of skills) {
    if(term&&!labelKey(skill.name+' '+skill.family).includes(term))continue;
    if(coverage==='below'&&skill.autonomous>=skill.target||coverage==='no-relay'&&skill.autonomous>=2)continue;
    const key=labelKey(skill.family),family=groups.get(key)??[];
    family.push(skill);
    groups.set(key,family);
  }

  return (
    <>
      <div className="skills-metrics">
        <div><span className="skills-metric-icon"><Layers3 size={19}/></span>
          <span><strong>{skills.length}</strong><span>Compétences</span></span></div>
        <div><span className="skills-metric-icon met"><Target size={19}/></span>
          <span><strong>{met}<small> / {skills.length}</small></strong><span>Cibles atteintes</span></span></div>
        <div><span className="skills-metric-icon below"><UserRoundCheck size={19}/></span>
          <span><strong>{withoutRelay}</strong><span>Moins de 2 autonomes</span></span></div>
      </div>

      <section className="skills-panel" aria-label="Matrice de compétences">
        <div className="skills-filters">
          <label className="skills-searchbox"><Search size={17} aria-hidden="true"/>
            <span className="sr-only">Filtrer les compétences</span>
            <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Compétence ou famille…"/>
          </label>
          <select aria-label="Filtre de couverture" value={coverage}
            onChange={event=>setCoverage(event.target.value as typeof coverage)}>
            <option value="all">Toute la couverture</option>
            <option value="below">Sous la cible</option>
            <option value="no-relay">Moins de 2 autonomes</option>
          </select>
          <ul className="skills-legend" aria-label="Niveaux de maîtrise">
            {Object.entries(competenceLevels).map(([code,detail])=>(
              <li key={code}><span className="skills-level" data-level={code}>{code}</span>{detail.label}</li>
            ))}
          </ul>
        </div>
        {!skills.length?(
          <div className="skills-empty"><Layers3 size={26}/><h2>Aucune compétence dans ce service</h2>
            <p>Ajoutez une compétence pour commencer la matrice.</p></div>
        ):!groups.size?(
          <div className="skills-empty"><Search size={26}/><h2>Aucune compétence trouvée</h2>
            <button className="skills-button" onClick={()=>{setQuery('');setCoverage('all')}}>Effacer les filtres</button></div>
        ):(
          <>
            {!people.length&&<p className="skills-inline-hint">Ajoutez des collaborateurs à l’effectif pour les évaluer.</p>}
            <div className="skills-table-scroll" tabIndex={0} role="region" aria-label="Matrice défilante">
              <table className="skills-table">
                <thead><tr>
                  <th scope="col">Compétence</th>
                  <th scope="col">Autonomes <span>/ cible</span></th>
                  {people.map(person=><th scope="col" key={person.id}>
                    <span className="skills-person-heading"><PersonAvatar id={person.userId??undefined} name={person.name} size={29}/>
                      <span data-no-translate>{person.name}</span></span>
                  </th>)}
                </tr></thead>
                {[...groups.entries()].map(([key,family])=>(
                  <tbody key={key}>
                    <tr className="skills-family"><th colSpan={people.length+2} scope="rowgroup">
                      <Layers3 size={14} aria-hidden="true"/><span>{family[0].family}</span>
                    </th></tr>
                    {family.map(skill=>(
                      <tr key={skill.id}>
                        <th scope="row"><button type="button" className="skills-skill-name"
                          aria-label={'Modifier la compétence '+skill.name} onClick={()=>editSkill(skill)}>{skill.name}</button></th>
                        <td>
                          <button type="button" className="skills-coverage" data-met={skill.autonomous>=skill.target}
                            aria-label={'Voir les relais pour '+skill.name+' · '+skill.autonomous+' autonomes sur '+skill.target}
                            onClick={()=>findRelay(skill)}>
                            {skill.autonomous} / {skill.target}<ArrowUpRight size={13} aria-hidden="true"/>
                          </button>
                        </td>
                        {people.map(person=>{
                          const assessment=bySkill.get(skill.id)?.get(person.id);
                          const level=assessment?.level??'';
                          const value=level?level+' · '+competenceLevels[level].label:'Non évalué';
                          return <td key={person.id}>
                            <button type="button" className="skills-level skills-cell" data-level={level}
                              title={value} aria-label={'Évaluer '+person.name+' · '+skill.name+' · '+value}
                              onClick={()=>assess(skill,person,assessment)}>{level||'+'}</button>
                          </td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

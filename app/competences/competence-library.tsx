'use client';

import {useState} from 'react';
import {BookOpen,Check,Layers3,Pencil,Plus,Search} from 'lucide-react';
import {labelKey} from '@/lib/hub';
import type {CompetenceLibrarySkill,CompetenceSkill} from '@/lib/competences';

export function CompetenceLibrary({library,assigned,service,canEdit,onAdd,onEdit}:{
  library:CompetenceLibrarySkill[];assigned:CompetenceSkill[];service:string;canEdit:boolean;
  onAdd:(skill:CompetenceLibrarySkill)=>void;onEdit:(skill:CompetenceLibrarySkill)=>void;
}) {
  const [query,setQuery]=useState('');
  const [scope,setScope]=useState('all');
  const included=new Map(assigned.map(skill=>[skill.id,skill]));
  const groups=new Map<string,CompetenceLibrarySkill[]>();
  const term=labelKey(query);
  for(const skill of library) {
    if(term&&!labelKey(skill.name+' '+skill.family).includes(term))continue;
    const inMatrix=included.has(skill.id);
    if(scope==='available'&&inMatrix||scope==='included'&&!inMatrix)continue;
    const key=labelKey(skill.family);
    const family=groups.get(key)??[];
    family.push(skill);
    groups.set(key,family);
  }

  return (
    <section className="skills-panel skills-library" aria-labelledby="library-title">
      <header className="skills-relay-heading">
        <span className="skills-metric-icon"><BookOpen size={22} aria-hidden="true"/></span>
        <div><h2 id="library-title">Bibliothèque des compétences</h2>
          <p>Choisissez les compétences à suivre dans la matrice du service <strong>{service}</strong>.</p></div>
      </header>
      <div className="skills-filters skills-library-filters">
        <label className="skills-searchbox"><Search size={17} aria-hidden="true"/>
          <span className="sr-only">Rechercher dans la bibliothèque</span>
          <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Compétence ou famille…"/>
        </label>
        <select aria-label="Filtrer les compétences de la bibliothèque" value={scope} onChange={event=>setScope(event.target.value)}>
          <option value="all">Toutes les compétences</option>
          <option value="available">À ajouter à la matrice</option>
          <option value="included">Dans la matrice</option>
        </select>
      </div>
      {groups.size===0?<div className="skills-empty">
        <BookOpen size={25} aria-hidden="true"/>
        <h3>{library.length?'Aucun résultat':'La bibliothèque est vide'}</h3>
        {library.length?<button type="button" className="skills-button" onClick={()=>{setQuery('');setScope('all')}}>Effacer les filtres</button>
          :<p>Créez la première compétence pour la mettre à disposition des services.</p>}
      </div>:<div className="skills-library-groups">
        {[...groups.entries()].map(([key,skills])=>{
          const family=skills[0].family;
          return <section className="skills-library-group" key={key} aria-label={family}>
            <h3><Layers3 size={15} aria-hidden="true"/>{family}</h3>
            <ul>
              {skills.map(skill=>{
                const entry=included.get(skill.id);
                return <li key={skill.id}>
                  <strong>{skill.name}</strong>
                  {entry?<span className="skills-library-included"><Check size={15} aria-hidden="true"/> Dans la matrice</span>
                    :<button type="button" className="skills-button" onClick={()=>onAdd(skill)}
                      aria-label={'Ajouter '+skill.name+' à la matrice'}><Plus size={16} aria-hidden="true"/> Ajouter</button>}
                  {canEdit&&<button type="button" className="skills-button skills-icon-button" onClick={()=>onEdit(skill)}
                    title="Modifier dans la bibliothèque" aria-label={'Modifier '+skill.name+' dans la bibliothèque'}><Pencil size={15} aria-hidden="true"/></button>}
                </li>;
              })}
            </ul>
          </section>;
        })}
      </div>}
    </section>
  );
}

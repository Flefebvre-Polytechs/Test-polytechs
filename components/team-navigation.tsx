'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {teamVisual} from '@/lib/ticket-visuals';
import {gedHref,serviceHref} from '@/lib/navigation';
import {Grid3X3,LayoutDashboard,FileText,ClipboardList,TriangleAlert,HardHat as EpiIcon,Recycle,Leaf,BookOpen,FileCheck2,Sparkles,HeartPulse,ShieldAlert,LayoutList,Users,BriefcaseBusiness,CalendarDays,ShoppingCart,Wrench,Settings2,ShieldCheck,ChartNoAxesCombined} from 'lucide-react';
import {teamGroups,teamSettingsHref,teamsInGroup,type Team} from '@/lib/team-organization';
import {useCurrentAccount} from '@/components/profile';
export type {Team} from '@/lib/team-organization';
export type BoardLink={id:string;team_id:string;title:string;unit_code:string};

const qsseSections=[
  {name:'Prévention',links:[
    ['DUERP','/duerp',FileText],
    ['PAPRIPACT','/duerp?tab=program',ClipboardList],
    ['Accidents du travail','/qse#'+encodeURIComponent('Accidents du travail'),HeartPulse],
    ['Situations dangereuses','/qse#'+encodeURIComponent('Situations dangereuses'),TriangleAlert],
    ['EPI · stock et dotations','/epi-stock',EpiIcon],
    ['Plans de prévention','/plans-prevention',ShieldAlert],
    ['VGP · contrôles périodiques','/vgp',ShieldCheck],
  ]},
  {name:'Environnement',links:[
    ['Suivi des consommations','/environnement/consommations',ChartNoAxesCombined],
    ['Gestion des déchets','/dechets',Recycle],
    ['Analyse environnementale','/qse#'+encodeURIComponent('Analyse environnementale'),Leaf],
    ['RSE','/qse#RSE',Sparkles],
  ]},
  {name:'Qualité',links:[
    ['Gestion documentaire',gedHref('qsse'),BookOpen],
    ['Vue globale documentaire',gedHref('qsse',true),BookOpen],
    ['Réglementation','/qse#'+encodeURIComponent('Réglementation'),FileCheck2],
    ['Plan d’actions','/plan-actions',ClipboardList],
    ['Budget QSSE','/budget-qsse',BriefcaseBusiness],
    ['Amélioration continue','/qse#'+encodeURIComponent('Amélioration continue'),LayoutList],
  ]},
] as const;
export function TeamTree({teams,boards,managedTeams=[],selected,disabled,onSelect,onTeam}:{teams:Team[];boards:BoardLink[];managedTeams?:string[];selected?:string;disabled?:boolean;onSelect?:(id:string)=>void;onTeam?:(team:Team)=>void}){
  const canOrganize=useCurrentAccount()?.role==='admin';
  // One permission-filtered registry is shared by every service menu.
  // Server-side GED checks remain authoritative for documents and files.
  const [gedAccess,setGedAccess]=useState<{services:Set<string>;global:boolean}>({services:new Set(),global:false});
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/ged?scope=meta',{cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw Error('GED unavailable');return response.json() as Promise<{services?:{id:string}[];canGlobal?:boolean}>})
      .then(meta=>{if(!controller.signal.aborted)setGedAccess({services:new Set((meta.services||[]).map(service=>service.id)),global:meta.canGlobal===true})})
      .catch(()=>{}); // Fail closed: never show navigation into restricted GED.
    return()=>controller.abort();
  },[]);
  function canShowQsseShortcut(href:string){
    if(!href.startsWith('/ged?'))return true;
    return href.includes('scope=global')?gedAccess.global:gedAccess.services.has('qsse');
  }
  function teamNode(t:Team){
    const Icon=teamVisual(t.id,t.icon).Icon;
    const teamBoards=boards.filter(b=>b.team_id===t.id);
    return <div className={'team-node rank-'+t.rank} key={t.id}>
      <details>
        <summary aria-label={'Afficher les tableaux de '+t.name}>
          <span className="team-pictogram"><Icon size={17} strokeWidth={2} aria-hidden="true"/></span>
          <span className="team-name" data-no-translate>{t.name}</span>
          <small>Rang {t.rank}</small>
        </summary>
        <div className="team-boards">
          {t.id!=='qsse'&&gedAccess.services.has(t.id)&&<a className="team-ged-link" href={gedHref(t.id)} aria-label={'Gestion documentaire du service '+t.name}><BookOpen size={15} aria-hidden="true"/><span>Gestion documentaire</span></a>}
          {t.id==='qsse'&&<div className="qsse-shortcuts">{qsseSections.map(section=><div className="qsse-section" key={section.name}><p>{section.name}</p>{section.links.filter(([,href])=>canShowQsseShortcut(href)).map(([label,href,LinkIcon])=><a href={href} key={label}><LinkIcon size={15} aria-hidden="true"/><span>{label}</span></a>)}</div>)}</div>}
          {t.id==='rh'&&<div className="qsse-shortcuts"><div className="qsse-section"><p>Gestion RH</p><a href="/rh/personnel"><Users size={15} aria-hidden="true"/><span>Liste du personnel</span></a><a href="/habilitations"><ShieldCheck size={15} aria-hidden="true"/><span>Gestion des habilitations</span></a></div></div>}
          {t.id==='maintenance'&&<div className="qsse-shortcuts"><div className="qsse-section"><p>GMAO</p>{[['Vue d’ensemble','overview',LayoutDashboard],['Demandes & interventions','orders',Wrench],['Équipements','assets',Settings2],['Maintenance préventive','plans',CalendarDays],['Planning','planning',CalendarDays],['Pièces & stocks','parts',ShoppingCart]].map(([label,tab,Icon]:any)=><a href={'/maintenance?tab='+tab} key={tab}><Icon size={15}/><span>{label}</span></a>)}</div></div>}
          {managedTeams.includes(t.id)&&<a href={disabled?undefined:serviceHref('/competences',t.id)}><Grid3X3 size={15} aria-hidden="true"/>Compétences</a>}
          {t.id==='qsse'&&teamBoards.length>0&&<p className="qsse-board-label">Tableaux de bord</p>}
          {teamBoards.map(b=>onSelect?<button key={b.id} disabled={disabled} aria-current={selected===b.id?'page':undefined} onClick={()=>onSelect(b.id)}><LayoutDashboard size={14}/><span>{b.title}</span></button>:<a key={b.id} href={'/unites?board='+encodeURIComponent(b.id)}><LayoutDashboard size={14}/><span>{b.title}</span></a>)}
          {onTeam?<button disabled={disabled} className="team-open" onClick={()=>t.id==='maintenance'?location.assign('/maintenance'):onTeam(t)}>Ouvrir {t.rank===1?'la direction':'le service'}</button>:<a className="team-open" href={disabled?undefined:t.id==='maintenance'?'/maintenance':'/unites?team='+encodeURIComponent(t.id)}>Ouvrir {t.rank===1?'la direction':'le service'}</a>}
          {canOrganize&&!disabled&&<a href={teamSettingsHref(t.id)} aria-label={'Modifier l’équipe '+t.name}><Settings2 size={15} aria-hidden="true"/>Modifier l’équipe</a>}
          {!teamBoards.length&&<small className="team-no-board">Aucun tableau</small>}
        </div>
      </details>
    </div>;
  }
  const sections=teamGroups.map(group=>({...group,items:teamsInGroup(teams,group.id)}));
  return <nav className="team-tree" aria-label="Services et tableaux de bord">{sections.filter(g=>g.items.length).map(g=><section className="team-group" key={g.id} style={{'--team-accent':g.accent} as CSSProperties}><h3>{g.name}</h3>{g.items.map(teamNode)}</section>)}</nav>;
}
export function HomeTeamNavigation(){const [data,setData]=useState<{teams:Team[];boards:BoardLink[];managedTeams?:string[]}|null>(null),[error,setError]=useState(false);useEffect(()=>{const c=new AbortController();fetch('/api/dashboards',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error();setData(await r.json())}).catch(e=>{if(e.name!=='AbortError')setError(true)});return()=>c.abort()},[]);return <div className="home-team-navigation"><p className="navlabel">SERVICES ET TABLEAUX</p>{data?<TeamTree teams={data.teams} boards={data.boards} managedTeams={data.managedTeams}/>:<a href="/unites">{error?'Ouvrir les services':'Chargement des services…'}</a>}</div>}

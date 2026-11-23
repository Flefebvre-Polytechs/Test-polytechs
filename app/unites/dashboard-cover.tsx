import {ArrowDown,ArrowUpRight,CalendarDays,Layers3,ListTodo,MessagesSquare} from 'lucide-react';
import type {Team} from '@/components/team-navigation';
import {todayParis} from '@/lib/hub';
import {teamVisual} from '@/lib/ticket-visuals';

const moduleLinks:Record<string,{url:string;label:string}[]>={
  qsse:[{url:'/environnement/consommations',label:'Consommations'}],
  rh:[{url:'/rh/personnel',label:'Personnel'},{url:'/habilitations',label:'Habilitations'}],
  maintenance:[{url:'/maintenance',label:'GMAO'}],
};
const fullDate=new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'Europe/Paris'});

export function DashboardCover({team,title,activity,custom}:{
  team:Team;title:string;activity:boolean;custom?:boolean;
}){
  const {Icon}=teamVisual(team.id,team.icon);
  const today=todayParis(),links=moduleLinks[team.id]??[];
  return <header className="board-cover">
    <div className="board-cover-main">
      <div className="board-cover-kicker"><Icon size={18} aria-hidden="true"/>{title===team.name?'Tableau de bord':team.name}</div>
      <h1>{title}</h1>
      {(activity||custom||links.length>0)&&<nav className="board-cover-nav" aria-label="Accès rapides du tableau">
        {activity&&<>
          <a href="#dashboard-communications"><MessagesSquare size={16} aria-hidden="true"/> Communications</a>
          <a href="#dashboard-agenda"><CalendarDays size={16} aria-hidden="true"/> Agenda</a>
          <a href="#dashboard-tickets"><ListTodo size={16} aria-hidden="true"/> Tickets à traiter</a>
        </>}
        {custom&&<a href="#dashboard-custom"><Layers3 size={16} aria-hidden="true"/> Mes blocs <ArrowDown size={13} aria-hidden="true"/></a>}
        {links.map(link=><a key={link.url} href={link.url}>{link.label} <ArrowUpRight size={14} aria-hidden="true"/></a>)}
      </nav>}
    </div>
    <time className="board-cover-date" dateTime={today}>
      <CalendarDays size={16} aria-hidden="true"/>{fullDate.format(new Date(today+'T12:00:00Z'))}
    </time>
  </header>;
}

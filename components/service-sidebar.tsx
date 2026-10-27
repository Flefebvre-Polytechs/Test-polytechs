'use client';
import {useState,useEffect,type ReactNode} from 'react';
import {Menu,PanelLeftClose,LayoutDashboard,ListChecks,Ticket} from 'lucide-react';
import './service-sidebar.css';
export function ServiceSidebar({children}:{children:ReactNode}){
  const [expanded,setExpanded]=useState(false),[personal,setPersonal]=useState('');
  useEffect(()=>{setPersonal(location.pathname==='/work'?'actions':location.pathname==='/tickets'&&new URLSearchParams(location.search).get('view')==='mine'?'tickets':'')},[]);
  return <aside className="team-sidebar"><a className="team-brand" href="/unites" aria-label="Accueil Polytechs QSE"><img src="/polytechs-logo.png" alt="Polytechs"/><span className="team-brand-caption">Management intégré</span></a><button type="button" className="service-menu-toggle" aria-expanded={expanded} aria-controls="service-navigation" onClick={()=>setExpanded(!expanded)}>{expanded?<PanelLeftClose size={19}/>:<Menu size={19}/>} Services et modules</button><div id="service-navigation" className={'service-sidebar-content '+(expanded?'is-open':'')}><a className="team-home" href="/unites"><LayoutDashboard size={17}/> Tableaux de bord</a><nav className="personal-navigation" aria-label="Mon espace"><a href="/work" aria-current={personal==='actions'?'page':undefined}><ListChecks size={18}/><span>Mes actions</span></a><a href="/tickets?view=mine" aria-current={personal==='tickets'?'page':undefined}><Ticket size={18}/><span>Mes tickets</span></a></nav>{children}</div></aside>;
}

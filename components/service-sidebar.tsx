'use client';
import {useState,useEffect,type ReactNode} from 'react';
import {Wallet,Menu,PanelLeftClose,LayoutDashboard,ListChecks,Ticket,UsersRound,Network,HardHat} from 'lucide-react';
import './service-sidebar.css';
import {useCurrentAccount} from '@/components/profile';
export function ServiceSidebar({children,epiManager=false,pdpAccess=false,budgetManager=false}:{children:ReactNode;epiManager?:boolean;pdpAccess?:boolean;budgetManager?:boolean}){
  const account=useCurrentAccount();
  const [expanded,setExpanded]=useState(false),[personal,setPersonal]=useState('');
  useEffect(()=>{
    const path=location.pathname;
    if(path==='/equipes')setPersonal('teams');
    if(path==='/work')setPersonal('actions');
    if(path==='/tickets'&&new URLSearchParams(location.search).get('view')==='mine')setPersonal('tickets');
  },[]);
  return <aside className="team-sidebar"><a className="team-brand" href="/unites" aria-label="Accueil Polytechs QSE"><img src="/polytechs-logo.png" alt="Polytechs"/><span className="team-brand-caption">Management intégré</span></a><button type="button" className="service-menu-toggle" aria-expanded={expanded} aria-controls="service-navigation" onClick={()=>setExpanded(!expanded)}>{expanded?<PanelLeftClose size={19}/>:<Menu size={19}/>} Services et modules</button><div id="service-navigation" className={'service-sidebar-content '+(expanded?'is-open':'')}><a className="team-home" href="/unites"><LayoutDashboard size={17}/> Tableaux de bord</a><nav className="personal-navigation" aria-label="Mon espace"><a href="/work" aria-current={personal==='actions'?'page':undefined}><ListChecks size={18}/><span>Mes actions</span></a><a href="/tickets?view=mine" aria-current={personal==='tickets'?'page':undefined}><Ticket size={18}/><span>Mes tickets</span></a>{epiManager&&<a href="/epi-stock" aria-current={typeof window!=='undefined'&&location.pathname.startsWith('/epi-stock')?'page':undefined}><HardHat size={18}/><span>Gestion EPI</span></a>}{budgetManager&&<a href="/budget-qsse" aria-current={typeof window!=='undefined'&&location.pathname==='/budget-qsse'?'page':undefined}><Wallet size={18}/><span>Budget QSSE</span></a>}{pdpAccess&&<a href="/plans-prevention" aria-current={typeof window!=='undefined'&&location.pathname==='/plans-prevention'?'page':undefined}><HardHat size={18}/><span>Plans de prévention</span></a>}</nav>{account?.role==='admin'&&<nav className="global-admin-navigation" aria-label="Administration globale"><small>ADMINISTRATION</small><a href="/equipes" aria-current={personal==='teams'?'page':undefined}><Network size={18}/><span>Équipes et services</span></a><a href="/membres" aria-current={typeof window!=='undefined'&&location.pathname==='/membres'?'page':undefined}><UsersRound size={18}/><span>Membres et accès</span></a></nav>}{children}</div></aside>;
}

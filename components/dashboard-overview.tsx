'use client';

import {useEffect,useMemo,useState} from 'react';
import {
  ArrowRight, ArrowUpRight, CalendarDays, CircleAlert, ClipboardCheck,
  ListTodo, Megaphone, MessagesSquare, Ticket, type LucideIcon,
} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {MetricChart,chartModes} from '@/components/metric-chart';
import type {Team} from '@/components/team-navigation';
import {hubRequest} from '@/lib/hub-request';
import {serviceHref} from '@/lib/navigation';
import {categoryVisuals} from '@/lib/ticket-visuals';
import {
  categories,scheduledAuditDates,todayParis,type Communication,type DashboardTicket,
  type DashboardTicketStats,type Routine,type Row,
} from '@/lib/hub';

type Message=Row<Communication>;
type AuditFeed={routines:Row<Routine>[];runs:{routine_id:string;date:string;data:{completed:boolean}}[]};
type AuditEvent={id:string;title:string;date:string;time:string};
type Feed<T>={value?:T;error?:boolean};
type ChartMode='bar'|'pie'|'donut';

const shortDate=new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',timeZone:'Europe/Paris'});
const shortMonth=new Intl.DateTimeFormat('fr-FR',{month:'short',timeZone:'Europe/Paris'});
const dateTime=new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'});
const number=new Intl.NumberFormat('fr-FR');
const dateAtNoon=(date:string)=>new Date(date+'T12:00:00Z');

function useFeed<T>(params:Record<string,string>,refresh:number):Feed<T>{
  const path='/api/hub?'+new URLSearchParams(params);
  const [result,setResult]=useState<{key:string;feed:Feed<T>}>();
  const key=path+'#'+refresh;
  useEffect(()=>{
    let live=true;
    hubRequest(path)
      .then((value:T)=>{if(live)setResult({key,feed:{value}})})
      .catch(()=>{if(live)setResult({key,feed:{error:true}})});
    return()=>{live=false};
  },[path,key]);
  return result?.key===key?result.feed:{};
}

function PanelHeading({title,Icon,tone,url,link}:{title:string;Icon:LucideIcon;tone:string;url?:string;link?:string}){
  return <header className="dashboard-panel-heading">
    <span className="dashboard-icon" data-tone={tone}><Icon size={18} aria-hidden="true"/></span>
    <h2>{title}</h2>
    {url&&<a className="dashboard-panel-link" href={url}>{link}<ArrowUpRight size={15} aria-hidden="true"/></a>}
  </header>;
}

function FeedState({error,empty}:{error?:boolean;empty?:string}){
  return <p className="dashboard-feed-state" role={error?'alert':'status'}>
    {error?'Données indisponibles.':empty??'Chargement…'}
  </p>;
}

function Stat({label,value,Icon,tone,detail}:{label:string;value?:number;Icon:LucideIcon;tone:string;detail?:string}){
  return <div className="dashboard-stat" data-tone={tone} data-alert={tone==='late'&&!!value}>
    <span className="dashboard-icon" data-tone={tone}><Icon size={19} aria-hidden="true"/></span>
    <div><span>{label}</span><strong>{value===undefined?'—':number.format(value)}</strong>{detail&&<small>{detail}</small>}</div>
  </div>;
}

function CommunicationsPanel({feed,title,tone,Icon,teamName,url}:{
  feed:Feed<{rows:Message[]}>;title:string;tone:string;Icon:LucideIcon;
  teamName:(id:string)=>string;url?:string;
}){
  const messages=feed.value?.rows.slice(0,3);
  return <section className="dashboard-panel dashboard-messages" data-tone={tone}>
    <PanelHeading title={title} Icon={Icon} tone={tone} url={url} link="Fil du service"/>
    {messages?.length?<ul className="dashboard-entries">
      {messages.map(message=>{
        const {title,body,sourceTeam}=message.data;
        const published=message.created_at;
        const source=teamName(sourceTeam);
        return <li key={message.id}>
          <Dialog>
            <DialogTrigger asChild>
              <button type="button" className="dashboard-message">
                <span className="dashboard-entry-meta">
                  <span>{source}</span>
                  {published&&<time dateTime={published}>{shortDate.format(new Date(published))}</time>}
                </span>
                <strong>{title}</strong>
                <span className="dashboard-message-preview">{body}</span>
                <ArrowUpRight className="dashboard-entry-arrow" size={15} aria-hidden="true"/>
              </button>
            </DialogTrigger>
            <DialogContent className="dashboard-message-dialog">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{source}{published&&' · '+dateTime.format(new Date(published))}</DialogDescription>
              <p>{body}</p>
            </DialogContent>
          </Dialog>
        </li>;
      })}
    </ul>:<FeedState error={feed.error} empty={messages?'Aucune communication pour ce service.':undefined}/>}
  </section>;
}

function AgendaPanel({feed,events,teamId,today}:{
  feed:Feed<AuditFeed>;events:AuditEvent[];teamId:string;today:string;
}){
  return <section className="dashboard-panel" id="dashboard-agenda">
    <PanelHeading title="Agenda des audits" Icon={CalendarDays} tone="agenda"
      url={serviceHref('/routines?view=calendar',teamId)} link="Calendrier"/>
    {events.length?<ul className="dashboard-entries">
      {events.slice(0,4).map(event=><li key={event.id+':'+event.date}>
        <a className="dashboard-entry dashboard-agenda-entry"
          href={serviceHref('/routines?'+new URLSearchParams({routine:event.id,date:event.date,view:'calendar'}),teamId)}>
          <time className="dashboard-date-tile" dateTime={event.date} data-today={event.date===today}>
            <strong>{event.date.slice(-2)}</strong><small>{shortMonth.format(dateAtNoon(event.date))}</small>
          </time>
          <span className="dashboard-entry-text"><strong>{event.title}</strong>
            <small>{event.date===today?'Aujourd’hui · ':''}{event.time}</small>
          </span>
          <ArrowRight size={16} aria-hidden="true"/>
        </a>
      </li>)}
    </ul>:<FeedState error={feed.error} empty={feed.value?'Aucun audit prévu dans les 14 prochains jours.':undefined}/>}
  </section>;
}

function ticketUrl(ticket:DashboardTicket,teamId:string){
  const query=new URLSearchParams({id:ticket.id});
  if(ticket.archived)query.set('archive','1');
  return serviceHref('/tickets?'+query,teamId);
}

function PriorityPanel({feed,teamId,today}:{feed:Feed<DashboardTicketStats>;teamId:string;today:string}){
  const tickets=feed.value?.priorities;
  return <section className="dashboard-panel" id="dashboard-tickets">
    <PanelHeading title="Tickets à traiter" Icon={ListTodo} tone="tickets" url={serviceHref('/tickets',teamId)} link="Tous les tickets"/>
    {tickets?.length?<ul className="dashboard-entries">
      {tickets.map(ticket=>{
        const overdue=ticket.due&&ticket.due<today;
        const date=ticket.due?shortDate.format(dateAtNoon(ticket.due)):'Sans échéance';
        return <li key={ticket.id}><a className="dashboard-entry dashboard-ticket-entry" href={ticketUrl(ticket,teamId)}>
          <span className="dashboard-entry-text"><strong>{ticket.title}</strong><small>{ticket.category} · {ticket.status}</small></span>
          <span className="dashboard-ticket-date" data-overdue={!!overdue} data-today={ticket.due===today}>
            {overdue?'En retard · '+date:ticket.due===today?'Aujourd’hui':date}
          </span>
          <ArrowRight size={16} aria-hidden="true"/>
        </a></li>;
      })}
    </ul>:<FeedState error={feed.error} empty={tickets?'Aucun ticket ouvert pour ce service.':undefined}/>}
  </section>;
}

function TicketIndicators({feed,teamId}:{
  feed:Feed<DashboardTicketStats>;teamId:string;
}){
  const [modes,setModes]=useState<Record<string,ChartMode>>({});
  useEffect(()=>{
    const preferences:Record<string,ChartMode>={};
    for(const category of categories){
      const mode=localStorage.getItem('polytechs-chart-'+teamId+'-'+category);
      if(mode==='bar'||mode==='pie'||mode==='donut')preferences[category]=mode;
    }
    setModes(preferences);
  },[teamId]);
  const stats=feed.value;
  const themes=stats?[...new Set(['Sécurité','Qualité','Environnement',...Object.keys(stats.counts)])]:[];
  return <section className="dashboard-panel" id="dashboard-indicators">
    <PanelHeading title="Indicateurs par thème" Icon={ClipboardCheck} tone="metrics"/>
    {stats?<><div className="dashboard-theme-legend">
      <span><i/>Ouverts</span><span><i/>Clôturés</span>
      <small>Tous les tickets du service</small>
    </div>
    <ul className="dashboard-themes">
      {themes.map(category=>{
        const count=stats.counts[category]??{open:0,closed:0,total:0};
        const related=stats.recent.filter(ticket=>ticket.category===category);
        const {Icon,tone}=Object.hasOwn(categoryVisuals,category)?categoryVisuals[category]:categoryVisuals.Autre;
        const mode=modes[category]??'bar';
        return <li key={category}>
          <MetricChart title={'Tickets · '+category} mode={mode}
            points={[{label:'Ouverts',value:count.open},{label:'Clôturés',value:count.closed}]}
            caption={'Historique du service, archives incluses · Mise à jour le '+dateTime.format(new Date(stats.updatedAt))}
            trigger={<span className="dashboard-theme-row">
              <span className="dashboard-icon" data-tone={tone}><Icon size={15} aria-hidden="true"/></span>
              <span className="dashboard-theme-name"><strong>{category}</strong>
                <span className="dashboard-theme-bar" aria-hidden="true" data-empty={!count.total}>
                  <i style={{width:(count.total?count.open/count.total*100:0)+'%'}}/>
                </span>
              </span>
              <span className="dashboard-theme-count"><b>{number.format(count.open)}</b> / {number.format(count.closed)}</span>
              <ArrowUpRight size={15} aria-hidden="true"/>
            </span>}
            controls={<label className="dashboard-chart-mode">Graphique
              <select value={mode} onChange={event=>{
                const next=event.target.value as ChartMode;
                setModes(current=>({...current,[category]:next}));
                localStorage.setItem('polytechs-chart-'+teamId+'-'+category,next);
              }}>
                {(['bar','pie','donut'] as const).map(value=><option value={value} key={value}>{chartModes[value]}</option>)}
              </select>
            </label>}
            detailsContent={<div className="dashboard-chart-tickets">
              {related.length?<><h3>Derniers tickets</h3>
                <ul className="dashboard-entries">{related.slice(0,10).map(ticket=><li key={ticket.id}>
                  <a className="dashboard-entry" href={ticketUrl(ticket,teamId)}>
                    <span className="dashboard-entry-text"><strong>{ticket.title}</strong><small>{ticket.archived?'Archivé':ticket.status}</small></span>
                    <ArrowRight size={16} aria-hidden="true"/>
                  </a>
                </li>)}</ul>
              </>:<p>Aucun ticket récent dans ce thème.</p>}
              <a className="dashboard-panel-link" href={serviceHref('/tickets',teamId)}>Voir les tickets du service <ArrowRight size={15} aria-hidden="true"/></a>
            </div>}/>
        </li>;
      })}
    </ul></>:<FeedState error={feed.error}/>}
  </section>;
}

export function DashboardOverview({teamId,teamName,teams,refresh}:{
  teamId:string;teamName:string;teams:Team[];refresh:number;
}){
  const today=todayParis(),lastDay=dateAtNoon(today);
  lastDay.setUTCDate(lastDay.getUTCDate()+13);
  const to=lastDay.toISOString().slice(0,10);
  const agenda=useFeed<AuditFeed>({scope:'routines',team:teamId,from:today,to},refresh);
  const messageQuery={scope:'communications',team:teamId,page:'0',sort:'published'};
  const local=useFeed<{rows:Message[]}>({...messageQuery,source:teamId},refresh);
  const shared=useFeed<{rows:Message[]}>({...messageQuery,excludeSource:teamId},refresh);
  const tickets=useFeed<DashboardTicketStats>({scope:'overview-stats',team:teamId},refresh);
  const events=useMemo(()=>{
    if(!agenda.value)return [];
    const complete=new Set(agenda.value.runs.filter(run=>run.data.completed).map(run=>run.routine_id+':'+run.date));
    return agenda.value.routines.flatMap(({id,data})=>
      scheduledAuditDates(data,today,to).filter(date=>!complete.has(id+':'+date)).map(date=>({
        id,date,title:data.title,time:data.time,
      }))
    ).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)||a.title.localeCompare(b.title,'fr'));
  },[agenda.value,today,to]);
  const totals=tickets.value?.totals;
  const emitter=(id:string)=>teams.find(team=>team.id===id)?.name??'Service émetteur';
  return <section className="dashboard-overview" aria-label={'Activité · '+teamName}>
    <div className="dashboard-kpis">
      <Stat label="Tickets ouverts" value={totals?.open} Icon={Ticket} tone="tickets"/>
      <Stat label="Échéances dépassées" value={totals?.late} Icon={CircleAlert} tone="late"/>
      <Stat label="Tickets à vérifier" value={totals?.verify} Icon={ClipboardCheck} tone="metrics"/>
      <Stat label="Audits à venir" value={agenda.value?events.length:undefined} Icon={CalendarDays} tone="agenda" detail="14 prochains jours"/>
    </div>
    <div className="dashboard-feed-grid" id="dashboard-communications">
      <CommunicationsPanel feed={local} title="Communication du service" Icon={Megaphone} tone="local"
        teamName={emitter} url={serviceHref('/communication',teamId)}/>
      <CommunicationsPanel feed={shared} title="Communications interservices" Icon={MessagesSquare} tone="shared"
        teamName={emitter}/>
      <AgendaPanel feed={agenda} events={events} teamId={teamId} today={today}/>
    </div>
    <div className="dashboard-work-grid">
      <PriorityPanel feed={tickets} teamId={teamId} today={today}/>
      <TicketIndicators feed={tickets} teamId={teamId}/>
    </div>
  </section>;
}

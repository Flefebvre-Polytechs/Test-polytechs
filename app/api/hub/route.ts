import {ticketLabelError} from '@/lib/ticket-labels';
import {visibleNotifications} from '@/lib/notification-access';
import {gmaoTicketContributor,gmaoTicketReader} from '@/lib/gmao-server';
import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {auditAnswerError,auditCompletionError,auditQuestionType,ticketError,routineError,communicationError,occurrenceDates,validDate,todayParis,newTicket,type Routine,type Run,type Ticket} from '@/lib/hub';
import {teamContentVisible,accessibleTeams,someTeamAllowed,teamsAllowed} from '@/lib/team-access';
const fail=(error:string,status=400)=>Response.json({error},{status});
const ok=(v:unknown)=>Response.json(v,{headers:{'Cache-Control':'no-store'}});
const parse=(r:any)=>({...r,data:JSON.parse(r.data)});
const tables={ticket:'hub_tickets',routine:'hub_routines',communication:'hub_communications'} as const;
async function recipients(ids:unknown){if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string')||new Set(ids).size!==ids.length)return false;const users=(await database().prepare('SELECT id FROM users').all()).results;return ids.every(id=>users.some(u=>u.id===id))}
async function notify(ids:string[],title:string,href:string){if(!ids.length)return '';try{const db=database();await db.batch([...new Set(ids)].map(id=>db.prepare('INSERT INTO hub_notifications (id,user_id,title,href,seen,created_at) VALUES (?,?,?,?,0,?)').bind(crypto.randomUUID(),id,title,href,new Date().toISOString())));return ''}catch(e){console.error(e);return 'Enregistrement réussi, mais les notifications n’ont pas pu être créées. Utilisez « Notifier » pour réessayer.'}}
export async function GET(req:Request){try{const gate=await requireRole(req);if(gate.error)return gate.error;const db=database(),q=new URL(req.url).searchParams,scope=q.get('scope')||'meta',contextTeam=q.get('team')||'';if(contextTeam&&['tickets','ticket','communications','routines','run','audit-history','overview-stats'].includes(scope)&&!(await accessibleTeams(gate.user!)).has(contextTeam))return fail('Accès à cette équipe non autorisé.',403);
if(scope==='meta'){const [teams,users]=await Promise.all([db.prepare('SELECT id,name,rank,parent_id FROM teams ORDER BY rank,name').all(),db.prepare('SELECT id,display_name FROM users ORDER BY display_name').all()]);const allowed=await accessibleTeams(gate.user!),editable=await accessibleTeams(gate.user!,true);return ok({teams:teams.results.filter((t:any)=>allowed.has(t.id)),editableTeams:[...editable],contributingTeams:[...await accessibleTeams(gate.user!,true,'contribute')],managedTeams:[...await accessibleTeams(gate.user!,true,'manage')],users:users.results})}
if(scope==='notifications'){const visible=await visibleNotifications(req,gate.user!);return ok({notifications:visible,unread:visible.filter(n=>!n.seen).length})}
if(scope==='overview-stats'){const team=q.get('team')||'';if(!team||!await db.prepare('SELECT id FROM teams WHERE id=?').bind(team).first())return fail('Équipe inconnue.');const allowed=await accessibleTeams(gate.user!);if(!allowed.has(team))return fail('Accès à cette équipe non autorisé.',403);const scopeIds=[team];const rows=await db.prepare('SELECT id,data,created_at,updated_at FROM hub_tickets ORDER BY updated_at DESC').all();const counts:Record<string,{open:number;closed:number;total:number}>=Object.create(null),recent:any[]=[];for(const r of rows.results as any[]){const item=JSON.parse(r.data);if(!Array.isArray(item.teams)||!teamContentVisible(allowed,item.teams,gate.user!.role==='admin')||!item.teams.some((id:string)=>scopeIds.includes(id)))continue;const category=String(item.category||'Autre');const entry=counts[category]||{open:0,closed:0,total:0};entry.total++;entry[item.status==='Clôturé'?'closed':'open']++;counts[category]=entry;if(recent.length<150)recent.push({id:r.id,title:item.title,category,status:item.status,due:item.due,updated_at:r.updated_at})}return ok({counts,recent,shown:recent.length,updatedAt:new Date().toISOString()})}
if(scope==='ticket'){const row=await db.prepare('SELECT * FROM hub_tickets WHERE id=?').bind(q.get('id')||'').first();if(!row)return fail('Ticket introuvable.',404);if(contextTeam&&!JSON.parse((row as any).data).teams?.includes(contextTeam))return fail('Ce ticket ne concerne pas cette équipe.',404);if(!await someTeamAllowed(gate.user!,JSON.parse((row as any).data).teams||[])&&!await gmaoTicketReader(gate.user!,String(row.id)))return fail('Accès au ticket non autorisé.',403);const [comments,files]=await Promise.all([db.prepare('SELECT * FROM hub_comments WHERE ticket_id=? ORDER BY created_at,id').bind(row.id).all(),db.prepare('SELECT * FROM hub_files WHERE ticket_id=? ORDER BY created_at,id').bind(row.id).all()]);return ok({ticket:parse(row),comments:comments.results,files:files.results,gmaoContributor:await gmaoTicketContributor(gate.user!,String(row.id)),gmaoDataContributor:await gmaoTicketContributor(gate.user!,String(row.id),'contribute')})}
if(scope==='run'){const id=q.get('id')||'',date=q.get('date')||'';if(!validDate(date))return fail('Date invalide.');const routine=await db.prepare('SELECT * FROM hub_routines WHERE id=?').bind(id).first<any>();if(!routine)return fail('Routine introuvable.',404);if(contextTeam&&!JSON.parse(routine.data).teams?.includes(contextTeam))return fail('Cette routine ne concerne pas cette équipe.',404);if(!await someTeamAllowed(gate.user!,JSON.parse(routine.data).teams||[]))return fail('Accès à la routine non autorisé.',403);const run=await db.prepare('SELECT * FROM hub_runs WHERE id=?').bind(id+':'+date).first();if(!run&&JSON.parse(routine.data).archivedAt)return fail('Compte rendu introuvable.',404);const tickets=[];
 if(run){
  const allowed=await accessibleTeams(gate.user!);
  const linked=await db.prepare(`SELECT id,data FROM hub_tickets
   WHERE json_extract(data,'$.source.routineId')=? AND json_extract(data,'$.source.date')=?
   AND json_extract(data,'$.source.questionId') IS NOT NULL`).bind(id,date).all<{id:string;data:string}>();
  for(const item of linked.results){
   const data=JSON.parse(item.data) as Ticket;
   if(teamContentVisible(allowed,data.teams,gate.user!.role==='admin')){
    tickets.push({id:item.id,title:data.title,questionId:data.source!.questionId,status:data.archivedAt?'Archivé':data.status});
   }
  }
 }
 return ok({routine:parse(routine),run:run?parse(run):null,tickets})}
if(scope==='audit-history'){
 const id=q.get('id')||'';
 if(!id||id.length>100)return fail('Audit invalide.');
 const row=await db.prepare('SELECT data FROM hub_routines WHERE id=?').bind(id).first<{data:string}>();
 if(!row)return fail('Audit introuvable.',404);
 const routine:Routine=JSON.parse(row.data);
 if(contextTeam&&!routine.teams.includes(contextTeam))return fail('Cet audit ne concerne pas cette équipe.',404);
 if(!await someTeamAllowed(gate.user!,routine.teams))return fail('Accès à cet audit non autorisé.',403);
 const reports=await db.prepare(`SELECT date,json_extract(data,'$.completed') AS completed
  FROM hub_runs WHERE routine_id=? ORDER BY date DESC`).bind(id).all();
 return ok({reports:reports.results});
}
if(scope==='routines'){const from=q.get('from')||'',to=q.get('to')||'';if(!validDate(from)||!validDate(to)||to<from||Date.parse(to)-Date.parse(from)>93*86400000)return fail('Choisissez une période de 93 jours maximum.');const [rows,runs]=await Promise.all([db.prepare(`SELECT hub_routines.*,EXISTS(SELECT 1 FROM hub_runs WHERE hub_runs.routine_id=hub_routines.id) AS has_runs,EXISTS(SELECT 1 FROM hub_runs WHERE hub_runs.id=hub_routines.id||':'||json_extract(hub_routines.data,'$.start') AND json_extract(hub_runs.data,'$.completed')=1) AS scheduled_run_complete FROM hub_routines ORDER BY updated_at DESC`).all(),db.prepare('SELECT * FROM hub_runs WHERE date>=? AND date<=?').bind(from,to).all()]);const allowed=await accessibleTeams(gate.user!);const visible=rows.results.map(parse).filter((r:any)=>(!contextTeam||r.data.teams?.includes(contextTeam))&&teamContentVisible(allowed,r.data.teams||[],gate.user!.role==='admin'));const ids=new Set(visible.map((r:any)=>r.id));return ok({routines:visible,runs:runs.results.map(parse).filter((r:any)=>ids.has(r.routine_id))})}
if(scope==='tickets'||scope==='communications'){
 const table=scope==='tickets'?'hub_tickets':'hub_communications',archive=q.get('archive')==='1';
 const clauses:string[]=[],params:(string|number)[]=[],allowed=await accessibleTeams(gate.user!);
 if(gate.user!.role!=='admin'){
  const ids=[...allowed];if(!ids.length)return ok({rows:[],total:0,page:0,pages:1,truncated:false});
  clauses.push(`EXISTS (SELECT 1 FROM json_each(data,'$.teams') WHERE value IN (${ids.map(()=>'?').join(',')}))`);params.push(...ids);
  if(!allowed.has('rh'))clauses.push("NOT EXISTS (SELECT 1 FROM json_each(data,'$.teams') WHERE value='rh')");
 }
 if(scope==='tickets'){clauses.push("(COALESCE(json_extract(data,'$.archivedAt'),'')!='')=?");params.push(archive?1:0)}
 if(contextTeam){clauses.push("EXISTS (SELECT 1 FROM json_each(data,'$.teams') WHERE value=?)");params.push(contextTeam)}
 const normalize=(v:string)=>v.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr');
 const term=normalize(q.get('search')||''),category=q.get('category'),status=q.get('status'),pilot=q.get('pilot'),source=q.get('source'),focus=q.get('focus'),mine=q.get('mine')==='1';
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const stats={open:0,late:0,verify:0,mine:0};let total=0,offset=0;const requested=Math.max(0,Math.floor(Number(q.get('page'))||0)),size=q.has('page')?15:500;const visible:any[]=[];
 const sort=q.get('sort'),order=sort==='title'?"json_extract(data,'$.title') COLLATE NOCASE ASC,id ASC":sort==='due'?(archive?"json_extract(data,'$.archivedAt') DESC,id ASC":"COALESCE(NULLIF(json_extract(data,'$.due'),''),'9999') ASC,id ASC"):"updated_at DESC,id ASC";
 // Bounded batches: authorization is applied before scanning, filtering and pagination.
 while(true){const batch=await db.prepare(`SELECT * FROM ${table} ${clauses.length?'WHERE '+clauses.join(' AND '):''} ORDER BY ${order} LIMIT 500 OFFSET ?`).bind(...params,offset).all();
 for(const raw of batch.results){const r=parse(raw),v=r.data;if(!teamContentVisible(allowed,v.teams||[],gate.user!.role==='admin'))continue;
 const isMine=v.pilot===gate.user!.id||v.responsibles?.includes(gate.user!.id)||v.actions?.some((a:any)=>a.pilot===gate.user!.id),late=!!v.due&&v.due<today&&v.status!=='Clôturé';
 if(mine&&!isMine)continue;
 if(scope==='tickets'){if(v.status!=='Clôturé')stats.open++;if(late)stats.late++;if(v.status==='À vérifier')stats.verify++;if(isMine)stats.mine++}
 if(category&&v.category!==category||status&&v.status!==status||source&&v.sourceTeam!==source||pilot&&v.pilot!==pilot&&!v.actions?.some((a:any)=>a.pilot===pilot))continue;
 if(!archive&&(focus==='open'&&v.status==='Clôturé'||focus==='late'&&!late||focus==='verify'&&v.status!=='À vérifier'||focus==='mine'&&!isMine))continue;
 if(term&&!normalize(v.title+' '+(v.description||v.body||'')).includes(term))continue;
 if(total>=requested*size&&visible.length<size)visible.push(r);total++;
 }if(batch.results.length<500)break;offset+=500;
 }
 return ok({rows:visible,total,page:requested,pages:Math.max(1,Math.ceil(total/size)),stats,truncated:!q.has('page')&&total>size});
 }return fail('Vue inconnue.');}catch(e){console.error(e);return fail('Données indisponibles. Réessayez.',503)}}
export async function POST(req:Request){try{if(!checkOrigin(req))return fail('Origine non autorisée.',403);const gate=await requireRole(req);if(gate.error)return gate.error;const b:any=await req.json();if(!b||typeof b!=='object')return fail('Saisie invalide.');const db=database(),now=new Date().toISOString(),author=gate.user!.displayName;
if(b.action==='read'){if(typeof b.id!=='string')return fail('Notification invalide.');await db.prepare('UPDATE hub_notifications SET seen=1 WHERE id=? AND user_id=?').bind(b.id,gate.user!.id).run();return ok({ok:true})}
if(gate.user!.role==='reader')return fail('Votre rôle permet uniquement la consultation.',403);
if(b.action==='archive-ticket'){if(typeof b.id!=='string'||typeof b.archive!=='boolean'||!Number.isInteger(b.revision))return fail('Archivage invalide.');const row=await db.prepare('SELECT data,revision FROM hub_tickets WHERE id=?').bind(b.id).first<any>();if(!row)return fail('Ticket introuvable.',404);const ticket=JSON.parse(row.data);if(!await teamsAllowed(gate.user!,ticket.teams||[],true))return fail('Archivage non autorisé pour ces équipes.',403);if(row.revision!==b.revision)return fail('Ce ticket a changé. Rechargez avant de l’archiver.',409);if(b.archive&&ticket.status!=='Clôturé')return fail('Clôturez le ticket avant de l’archiver.');if(!!ticket.archivedAt===b.archive)return ok({id:b.id,revision:row.revision});ticket.archivedAt=b.archive?now:'';ticket.archivedBy=b.archive?author:'';const result=await db.batch([db.prepare('UPDATE hub_tickets SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(ticket),now,b.id,b.revision),db.prepare('INSERT INTO hub_comments (id,ticket_id,body,author_id,author,created_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),b.id,b.archive?'Ticket archivé.':'Ticket restauré depuis les archives.',gate.user!.id,author,now)]);if(!result[0].meta.changes)return fail('Modification simultanée. Rechargez le ticket.',409);return ok({id:b.id,revision:row.revision+1})}

if(b.action==='comment'||b.action==='notify'){if(typeof b.ticketId!=='string'||!await recipients(b.recipients||[]))return fail('Destinataires invalides.');const ticket=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(b.ticketId).first<any>();if(!ticket)return fail('Ticket introuvable.',404);const data=JSON.parse(ticket.data);if(data.archivedAt)return fail('Restaurez le ticket avant de le modifier.',403);if(!await teamsAllowed(gate.user!,data.teams||[],true,'contribute')&&!await gmaoTicketContributor(gate.user!,b.ticketId,'contribute'))return fail('Modification de ce ticket non autorisée.',403);if(b.action==='comment'){if(typeof b.body!=='string'||!b.body.trim()||b.body.length>10000)return fail('Rédigez un commentaire (10 000 caractères maximum).');const added=await db.prepare(`INSERT INTO hub_comments (id,ticket_id,body,author_id,author,created_at) SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT json_extract(data,'$.archivedAt') FROM hub_tickets WHERE id=?),'')=''`).bind(crypto.randomUUID(),b.ticketId,b.body.trim(),gate.user!.id,author,now,b.ticketId).run();if(!added.meta.changes)return fail('Le ticket a été archivé. Restaurez-le avant de commenter.',409)}else if(!b.recipients?.length)return fail('Choisissez au moins un responsable.');const warning=await notify(b.recipients||[],(b.action==='comment'?'Commentaire de '+author+' · ':'Ticket à suivre · ')+data.title,'/tickets?id='+encodeURIComponent(b.ticketId));return ok({ok:true,warning})}
if(b.action==='delete-audit'){
 const user=gate.user!;
 if(typeof b.id!=='string'||!b.id||b.id.length>100||!Number.isSafeInteger(b.revision)||b.revision<1)return fail('Audit ou révision invalide.');
 if(b.confirmation!=='SUPPRIMER')return fail('Saisissez exactement SUPPRIMER en majuscules.');
 const row=await db.prepare('SELECT data,revision FROM hub_routines WHERE id=?').bind(b.id).first<{data:string;revision:number}>();
 if(!row)return fail('Audit introuvable.',404);
 const routine:Routine=JSON.parse(row.data);
 if(!await teamsAllowed(user,routine.teams,true,'manage'))return fail('Suppression réservée aux administrateurs des équipes concernées ou à un administrateur général.',403);
 if(routine.archivedAt||row.revision!==b.revision)return fail('Cet audit a changé ou a déjà été supprimé. Actualisez la liste.',409);
 const archived={...routine,active:false,archivedAt:now,archivedBy:user.id};
 const result=await db.prepare('UPDATE hub_routines SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?')
  .bind(JSON.stringify(archived),now,b.id,b.revision).run();
 if(!result.meta.changes)return fail('Cet audit a changé. Actualisez la liste.',409);
 return ok({id:b.id,deleted:true});
}
if(b.action==='audit-session'){
 const user=gate.user!;
 if(typeof b.routineId!=='string'||!b.routineId||b.routineId.length>100||
    !['now','schedule'].includes(b.intent))return fail('Choisissez un audit et une action.');
 const row=await db.prepare('SELECT data FROM hub_routines WHERE id=?').bind(b.routineId).first<{data:string}>();
 if(!row)return fail('Audit introuvable.',404);
 const template:Routine=JSON.parse(row.data);
 if(!await teamsAllowed(user,template.teams,true,b.intent==='now'?'contribute':'coordinate'))return fail('Action non autorisée pour cet audit.',403);
 if(!template.active||template.archivedAt||template.mode==='on-demand'||template.mode==='scheduled-copy')return fail('Ce formulaire ne peut pas servir de modèle.',409);
 const date=b.intent==='now'?todayParis():b.date;
 if(!validDate(date)||date<todayParis())return fail('Choisissez une date à partir d’aujourd’hui.');
 const session:Routine={
  ...template,mode:b.intent==='now'?'on-demand':'scheduled-copy',
  start:date,time:b.intent==='now'?new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(now)):b.time,
  repeat:'none',interval:1,end:'',
 };
 const issue=routineError(session);if(issue)return fail(issue);
 const id=crypto.randomUUID();
 const inserted=await db.prepare(`INSERT INTO hub_routines (id,data,revision,updated_at)
  SELECT ?,?,1,? FROM hub_routines WHERE id=? AND data=?`).bind(id,JSON.stringify(session),now,b.routineId,row.data).run();
 if(!inserted.meta.changes)return fail('Cet audit a changé. Actualisez la liste.',409);
 return ok({id,date});
}
if(b.action==='audit-ticket'){
 const user=gate.user!;
 if(typeof b.routineId!=='string'||!b.routineId||b.routineId.length>100||
    !validDate(b.date)||typeof b.questionId!=='string'||!b.questionId||b.questionId.length>100||
    !Number.isSafeInteger(b.runRevision)||b.runRevision<1)return fail('Point d’audit invalide.');
 const row=await db.prepare('SELECT data,revision FROM hub_routines WHERE id=?').bind(b.routineId).first<{data:string;revision:number}>();
 if(!row)return fail('Audit introuvable.',404);
 const routine:Routine=JSON.parse(row.data);
 if(!routine.teams.length||!await teamsAllowed(user,routine.teams,true))return fail('Création de tickets non autorisée pour cet audit.',403);
 if(!occurrenceDates(routine,b.date,b.date).includes(b.date))return fail('Cette occurrence n’est plus active.',409);
 const runId=b.routineId+':'+b.date;
 const run=await db.prepare('SELECT data,revision FROM hub_runs WHERE id=?').bind(runId).first<{data:string;revision:number}>();
 if(!run||run.revision!==b.runRevision)return fail('Le compte rendu a changé. Actualisez l’audit avant de réessayer.',409);
 const saved:Run=JSON.parse(run.data);
 const answer=saved.answers.find(answer=>answer.id===b.questionId);
 if(!answer||answer.result!=='Non conforme')return fail('Ce point doit être enregistré comme non conforme.');
 const draft=b.data??{...newTicket(),title:b.title,category:b.category,description:b.description,due:b.due,teams:routine.teams};
 const draftIssue=ticketError(draft);if(draftIssue)return fail(draftIssue);
 const {title,category,description,due,teams,pilot,status,actions,responsibles,topicTags,locationTags,analysis}=draft as Ticket;
 const ticket:Ticket={title,category,description,due,teams,pilot,status,actions,responsibles,topicTags,locationTags,analysis,
  source:{routineId:b.routineId,date:b.date,questionId:b.questionId}};
 if(!teams.length||routine.teams.includes('rh')&&!teams.includes('rh')||!await teamsAllowed(user,teams,true))
  return fail('Choisissez des services autorisés et conservez le rattachement RH lorsque l’audit concerne les RH.',403);
 const knownTeams=(await db.prepare('SELECT id FROM teams').all()).results;
 if(teams.some(id=>!knownTeams.some(team=>team.id===id)))return fail('Équipe inconnue.');
 const recipientsToNotify=[...new Set([pilot,...responsibles,...actions.map(action=>action.pilot)].filter(Boolean))];
 if(!await recipients(recipientsToNotify))return fail('Pilote ou responsable inconnu.');
 const labelsError=await ticketLabelError(ticket);if(labelsError)return fail(labelsError);
 const matching=`json_extract(data,'$.source.routineId')=? AND json_extract(data,'$.source.date')=?
  AND json_extract(data,'$.source.questionId')=?`;
 const linkArgs=[b.routineId,b.date,b.questionId];
 const id=crypto.randomUUID();
 // Write once for this occurrence and point, even if a request is retried.
 const result=await db.prepare(`INSERT INTO hub_tickets (id,data,revision,created_at,updated_at,author)
  SELECT ?,?,1,?,?,? WHERE NOT EXISTS(SELECT 1 FROM hub_tickets WHERE ${matching})
  AND EXISTS(SELECT 1 FROM hub_runs WHERE id=? AND revision=?)
  AND EXISTS(SELECT 1 FROM hub_routines WHERE id=? AND revision=?)`)
  .bind(id,JSON.stringify(ticket),now,now,author,...linkArgs,runId,run.revision,b.routineId,row.revision).run();
 if(result.meta.changes){
  const warning=await notify(recipientsToNotify,'Nouveau ticket · '+ticket.title,'/tickets?id='+encodeURIComponent(id));
  return ok({id,title:ticket.title,questionId:b.questionId,status:ticket.status,created:true,warning});
 }
 const existing=await db.prepare(`SELECT id,data FROM hub_tickets WHERE ${matching}`).bind(...linkArgs).first<{id:string;data:string}>();
 if(existing){
  const data:Ticket=JSON.parse(existing.data);
  if(await someTeamAllowed(user,data.teams)){
   return ok({id:existing.id,title:data.title,questionId:b.questionId,status:data.archivedAt?'Archivé':data.status,created:false});
  }
  return fail('Un ticket est déjà lié à ce point d’audit.',409);
 }
 return fail('Le compte rendu ou la grille a changé. Actualisez l’audit.',409);
}
if(b.action==='run'){
 if(typeof b.routineId!=='string'||!validDate(b.date)||!Number.isInteger(b.revision)||b.revision<0)return fail('Occurrence invalide.');
 const row=await db.prepare('SELECT data FROM hub_routines WHERE id=?').bind(b.routineId).first<any>();if(!row)return fail('Routine introuvable.',404);
 const routine:Routine=JSON.parse(row.data);if(!await teamsAllowed(gate.user!,routine.teams,true,'contribute'))return fail('Modification de cette routine non autorisée.',403);
 if(!occurrenceDates(routine,b.date,b.date).includes(b.date))return fail('Cette date ne correspond pas à une occurrence active.');
 const v=b.data;
 if(!v||!Array.isArray(v.answers)||v.answers.length!==routine.questions.length||typeof v.notes!=='string'||v.notes.length>10000||typeof v.completed!=='boolean'||v.answers.some((a:any)=>!a||typeof a!=='object')||new Set(v.answers.map((a:any)=>a.id)).size!==v.answers.length)return fail('Compte rendu invalide.');
 if([v.location,v.auditee].some(x=>x!==undefined&&(typeof x!=='string'||x.length>200)))return fail('Limitez le lieu et les personnes auditées à 200 caractères.');
 for(const a of v.answers){const q=routine.questions.find(q=>q.id===a.id);if(!q)return fail('Point de contrôle invalide.');const issue=auditAnswerError(q,a,routine.binaryConformity);if(issue)return fail(issue)}
 const id=b.routineId+':'+b.date,previous=await db.prepare('SELECT * FROM hub_runs WHERE id=?').bind(id).first<any>(),old=previous?JSON.parse(previous.data):null;
 if((previous?.revision||0)!==b.revision)return fail('Compte rendu modifié. Rechargez avant de réessayer.',409);
 const data={answers:routine.questions.map(q=>{const a=v.answers.find((a:any)=>a.id===q.id),prior=old?.answers.find((a:any)=>a.id===q.id),changed=!prior||prior.result!==a.result||prior.comment!==a.comment||(prior.value||'')!==(a.value||'');return {id:q.id,label:q.label,section:q.section||'',type:auditQuestionType(q),required:q.required!==false,help:q.help||'',evidence:q.evidence||'none',value:auditQuestionType(q)==='conformity'?'':a.value||'',result:auditQuestionType(q)==='conformity'?a.result:'Information',comment:a.comment,author:changed?author:prior.author||'',updatedAt:changed?now:prior.updatedAt||''}}),notes:v.notes,completed:v.completed,location:v.location||'',auditee:v.auditee||'',photos:old?.photos||[],routineTitle:old?.routineTitle||routine.title,routineDescription:old?.routineDescription??routine.description,startedAt:previous?old.startedAt||'':v.completed?'':now,startedBy:previous?old.startedBy||'':v.completed?'':author,completedAt:v.completed?(old?.completed?old.completedAt||'':now):'',completedBy:v.completed?(old?.completed?old.completedBy||'':author):''};
 if(v.completed){const issue=auditCompletionError(data);if(issue)return fail(issue)}
 let changed=false;
 if(!previous){const result=await db.prepare(`INSERT OR IGNORE INTO hub_runs (id,routine_id,date,data,revision,author,updated_at)
  SELECT ?,?,?,?,1,?,? FROM hub_routines WHERE id=? AND data=?`).bind(id,b.routineId,b.date,JSON.stringify(data),author,now,b.routineId,row.data).run();changed=!!result.meta.changes}
 else{const result=await db.batch([db.prepare(`UPDATE hub_runs SET data=?,revision=revision+1,author=?,updated_at=?
  WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM hub_routines WHERE id=? AND data=?)`).bind(JSON.stringify(data),author,now,id,b.revision,b.routineId,row.data),db.prepare('INSERT INTO hub_run_history(run_id,revision,snapshot,author,saved_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(id,previous.revision,previous.data,previous.author,previous.updated_at)]);changed=!!result[0].meta.changes}
 if(!changed)return fail('Compte rendu modifié. Rechargez avant de réessayer.',409);
 return ok({id,revision:b.revision+1,data});
}
if(!Object.hasOwn(tables,b.action))return fail('Action inconnue.');const kind=b.action as keyof typeof tables,v=b.data;const error=kind==='ticket'?ticketError(v):kind==='routine'?routineError(v):communicationError(v);if(error)return fail(error);if(kind==='routine'){delete v.archivedAt;delete v.archivedBy}if(kind==='routine'&&!b.id&&v.mode&&v.mode!=='catalog')return fail('Utilisez la liste d’audits pour créer une session.');if(b.id&&(typeof b.id!=='string'||!Number.isInteger(b.revision)||b.revision<1))return fail('Révision invalide.');if(kind==='ticket'&&!b.id&&v.source?.questionId!==undefined)return fail('Créez le ticket depuis le point d’audit.');
let linked:any=null;if(kind==='ticket'&&b.id){const r=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(b.id).first<any>();if(r){const t=JSON.parse(r.data);
 if(t.source?.questionId)v.source=t.source;
 else if(v.source?.questionId!==undefined)return fail('Créez le ticket depuis le point d’audit.');
 if(t.gmaoOrderId){linked=t;if(t.status==='Clôturé'&&JSON.stringify(t.actions)!==JSON.stringify(v.actions))return fail('Rouvrez l’intervention dans la GMAO avant de modifier ses sous-actions.',409);if(['title','category','description','teams','pilot','due','status','analysis'].some(k=>JSON.stringify(t[k])!==JSON.stringify(v[k])))return fail('Modifiez la demande, l’attribution et l’état depuis la GMAO.',409);}}}let dataEntry=false;if(kind==='ticket'&&b.id&&!await teamsAllowed(gate.user!,v.teams,true)&&(await teamsAllowed(gate.user!,v.teams,true,'contribute')||!!linked&&await gmaoTicketContributor(gate.user!,b.id,'contribute'))){const original=await db.prepare('SELECT data FROM hub_tickets WHERE id=?').bind(b.id).first<any>();if(original){const old=JSON.parse(original.data);const expected={...old,actions:old.actions.map((a:any)=>({...a,done:v.actions.find((x:any)=>x.id===a.id)?.done??a.done}))};if(JSON.stringify(expected)!==JSON.stringify(v))return fail('Un utilisateur peut renseigner la réalisation des actions, sans modifier le ticket ni ses affectations.',403);dataEntry=true}}const delegated=dataEntry||!!linked&&await gmaoTicketContributor(gate.user!,b.id);const teamIds=[...v.teams,...(kind==='communication'?[v.sourceTeam]:[])];const teams=(await db.prepare('SELECT id FROM teams').all()).results;if(teamIds.some(id=>!teams.some(t=>t.id===id)))return fail('Équipe inconnue.');if(!await teamsAllowed(gate.user!,teamIds,true)&&!delegated)return fail('Modification de ces équipes non autorisée.',403);const userIds=kind==='ticket'?[v.pilot,...v.responsibles,...v.actions.map((a:any)=>a.pilot)].filter(Boolean):kind==='routine'?[v.pilot].filter(Boolean):[];if(!await recipients([...new Set(userIds)]))return fail('Pilote ou responsable inconnu.');if(kind==='ticket'&&v.source){const source=await db.prepare('SELECT data FROM hub_routines WHERE id=?').bind(v.source.routineId).first<any>();const sourceRoutine=source?JSON.parse(source.data) as Routine:null;
 const keepArchivedLink=sourceRoutine?.archivedAt&&b.id&&await db.prepare(`SELECT id FROM hub_tickets WHERE id=?
  AND json_extract(data,'$.source.routineId')=? AND json_extract(data,'$.source.date')=?`).bind(b.id,v.source.routineId,v.source.date).first();
 if(!sourceRoutine||(!keepArchivedLink&&!occurrenceDates(sourceRoutine,v.source.date,v.source.date).length))return fail('Routine d’origine introuvable.');}
if(kind==='ticket'&&!b.id){delete v.archivedAt;delete v.archivedBy;delete v.qualityActionId;delete v.gmaoOrderId}if(kind==='ticket'){const labelsError=await ticketLabelError(v);if(labelsError)return fail(labelsError);}const id=b.id||crypto.randomUUID(),table=tables[kind];if(b.id){const previousAccess=await db.prepare(`SELECT data FROM ${table} WHERE id=?`).bind(id).first<any>();if(previousAccess&&kind==='ticket'){const stored=JSON.parse(previousAccess.data);if(stored.archivedAt)return fail('Restaurez le ticket avant de le modifier.',403);v.archivedAt=stored.archivedAt||'';v.archivedBy=stored.archivedBy||'';v.qualityActionId=stored.qualityActionId||'';v.gmaoOrderId=stored.gmaoOrderId||''}if(!previousAccess||!await teamsAllowed(gate.user!,JSON.parse(previousAccess.data).teams||[],true)&&!delegated)return fail('Modification de cette fiche non autorisée.',403);if(kind==='routine'){
 const origin=JSON.parse(previousAccess.data) as Routine;
 if(origin.archivedAt)return fail('Cet audit est archivé.',409);
 if(origin.mode==='on-demand'||origin.mode==='scheduled-copy'){
  if(v.mode!==origin.mode||v.repeat!=='none')return fail('Cette session doit rester un audit unique.');
 }else if(v.mode&&v.mode!=='catalog')return fail('Mode d’audit invalide.');
 const previous=await db.prepare('SELECT data FROM hub_routines WHERE id=?').bind(id).first<any>();if(previous&&await db.prepare('SELECT id FROM hub_runs WHERE routine_id=? LIMIT 1').bind(id).first()){const old=JSON.parse(previous.data);if(['mode','start','time','repeat','interval','end','questions','binaryConformity'].some(k=>JSON.stringify(old[k])!==JSON.stringify(v[k])))return fail('Cette routine possède des comptes rendus. Créez une nouvelle routine pour changer son calendrier ou sa grille ; vous pouvez suspendre celle-ci.')}}const result=await db.prepare(`UPDATE ${table} SET data=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?`).bind(JSON.stringify(v),now,id,b.revision).run();if(!result.meta.changes)return fail('Cette fiche a changé. Fermez puis rechargez-la ; votre saisie est conservée.',409)}else if(kind==='routine')await db.prepare('INSERT INTO hub_routines (id,data,revision,updated_at) VALUES (?,?,1,?)').bind(id,JSON.stringify(v),now).run();else await db.prepare(`INSERT INTO ${table} (id,data,revision,created_at,updated_at,author) VALUES (?,?,1,?,?,?)`).bind(id,JSON.stringify(v),now,now,author).run();const warning=kind==='ticket'?await notify([...new Set([v.pilot,...v.responsibles,...v.actions.map((a:any)=>a.pilot)].filter(Boolean))] as string[],(b.id?'Ticket mis à jour · ':'Nouveau ticket · ')+v.title,'/tickets?id='+encodeURIComponent(id)):'';return ok({id,revision:(b.revision||0)+1,warning});}catch(e){console.error(e);return fail('Enregistrement impossible. Votre saisie est conservée.',503)}}

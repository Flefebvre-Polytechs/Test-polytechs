import {database} from '@/db/raw';
import {requireRole} from '@/lib/access';
import {someTeamAllowed,teamsAllowed} from '@/lib/team-access';
import {validDate,type Routine,type Run,type Row} from '@/lib/hub';

export const auditNoStore={'Cache-Control':'private, no-store'};
export const auditFail=(error:string,status=400)=>Response.json({error},{status,headers:auditNoStore});

export async function auditAccess(req:Request,routineId:string,date:string,write=false){
  const gate=await requireRole(req,write?'editor':'reader');
  if(gate.error)return {error:gate.error};
  if(!routineId||routineId.length>100||!validDate(date))return {error:auditFail('Occurrence invalide.')};
  const row=await database().prepare('SELECT * FROM hub_routines WHERE id=?').bind(routineId).first<{id:string;data:string;revision:number}>();
  if(!row)return {error:auditFail('Routine introuvable.',404)};
  const routine:Row<Routine>={...row,data:JSON.parse(row.data)};
  const contextTeam=new URL(req.url).searchParams.get('team');
  if(contextTeam&&!routine.data.teams.includes(contextTeam))return {error:auditFail('Cette routine ne concerne pas cette équipe.',404)};
  if(!await someTeamAllowed(gate.user!,routine.data.teams)||contextTeam&&!await someTeamAllowed(gate.user!,[contextTeam]))return {error:auditFail('Accès à cette routine non autorisé.',403)};
  if(write&&(!routine.data.active||!await teamsAllowed(gate.user!,routine.data.teams,true,'contribute')))return {error:auditFail('Modification de cet audit non autorisée.',403)};
  const runRow=await database().prepare('SELECT * FROM hub_runs WHERE id=?').bind(routineId+':'+date).first<{id:string;routine_id:string;date:string;data:string;revision:number;author:string;updated_at:string}>();
  if(!runRow)return {error:auditFail('Enregistrez le compte rendu avant de continuer.',404)};
  return {user:gate.user!,routine,run:{...runRow,data:JSON.parse(runRow.data) as Run}};
}

// Keep old revisions and their photograph references. Removing a photograph from
// the current draft does not destroy the evidence attached to an earlier version.
export async function updateAudit(run:{id:string;revision:number;data:Run;author:string;updated_at:string},data:Run,author:string,now:string){
  const db=database();
  const result=await db.batch([
    db.prepare('UPDATE hub_runs SET data=?,revision=revision+1,author=?,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(data),author,now,run.id,run.revision),
    db.prepare('INSERT INTO hub_run_history(run_id,revision,snapshot,author,saved_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(run.id,run.revision,JSON.stringify(run.data),run.author,run.updated_at)
  ]);
  return !!result[0].meta.changes;
}

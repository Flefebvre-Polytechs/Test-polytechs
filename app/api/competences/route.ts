import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {accessibleTeams,teamsAllowed} from '@/lib/team-access';
import {labelKey} from '@/lib/hub';
import {
  isCompetenceLevel,type CompetenceAssessment,type CompetenceMatrix,type CompetencePerson,
  type CompetenceRelay,type CompetenceSearch,type CompetenceSkill,type CompetenceTeam,
} from '@/lib/competences';

const privateHeaders = {'Cache-Control':'private, no-store'};
const reply = (data:unknown,status=200) => Response.json(data,{status,headers:privateHeaders});
const fail = (error:string,status=400) => reply({error},status);
const forbidden = () => fail('La gestion des compétences est réservée aux administrateurs d’équipe.',403);
const changed = () => fail('La fiche a changé ou n’est plus accessible. Actualisez avant de réessayer.',409);
const skillFields = 'id,name,family,target,revision';

const roster = `
  SELECT m.team_id,'user:'||u.id AS id,u.display_name AS name,u.id AS userId,1 AS active,0 AS revision
  FROM team_members m JOIN users u ON u.id=m.user_id
  WHERE m.level IN ('viewer','user','contributor','team_admin')
  UNION ALL
  SELECT team_id,'person:'||id,name,NULL,active,revision FROM competence_people
`;
const teamIds = 'SELECT value FROM json_each(?)';

function cleanText(value:unknown,max:number) {
  return typeof value==='string'&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value)
    ? value.trim().replace(/\s+/g,' ') : '';
}
function isId(value:unknown):value is string {
  return typeof value==='string'&&value.length>0&&value.length<=120;
}
function isRevision(value:unknown):value is number {
  return typeof value==='number'&&Number.isSafeInteger(value)&&value>=0;
}

export async function GET(req:Request) {
  try {
    const gate = await requireRole(req,'editor');
    if(gate.error)return gate.error;
    const allowed = await accessibleTeams(gate.user!,true,'manage');
    if(!allowed.size)return forbidden();
    const db = database(),query = new URL(req.url).searchParams;
    const requested = query.get('team')||'';
    if(requested&&!allowed.has(requested))return forbidden();

    if(query.get('view')==='search') {
      const term = labelKey(cleanText(query.get('q')||'',120)),skillId = query.get('skill')||'';
      if(term.length<2&&!isId(skillId))return fail('Saisissez au moins deux caractères ou choisissez une compétence.');
      const scope = JSON.stringify(requested?[requested]:[...allowed]);
      const candidates = await db.prepare(`SELECT id,name,family,name_key FROM competence_skills
        WHERE team_id IN (${teamIds})`).bind(scope).all<{id:string;name:string;family:string;name_key:string}>();
      const skills = candidates.results.filter(skill=>skillId?skill.id===skillId:
        skill.name_key.includes(term)||labelKey(skill.family).includes(term)).map(skill=>skill.id);
      if(!skills.length)return reply({relays:[],truncated:false} satisfies CompetenceSearch);
      const {results} = await db.prepare(`WITH roster AS (${roster})
        SELECT s.id AS skillId,s.name AS skill,s.family,t.id AS teamId,t.name AS team,
               p.id AS personId,p.name,p.userId,a.assessed_at AS assessedAt
        FROM competence_assessments a JOIN competence_skills s ON s.id=a.skill_id AND s.team_id=a.team_id
        JOIN teams t ON t.id=a.team_id
        JOIN roster p ON p.team_id=a.team_id AND p.id=a.person_id
        WHERE a.team_id IN (${teamIds}) AND s.id IN (${teamIds}) AND a.level='U' AND p.active=1
        ORDER BY s.name COLLATE NOCASE,t.name COLLATE NOCASE,p.name COLLATE NOCASE,p.id LIMIT 121`)
        .bind(scope,JSON.stringify(skills)).all<CompetenceRelay>();
      return reply({relays:results.slice(0,120),truncated:results.length>120} satisfies CompetenceSearch);
    }

    const {results:teams} = await db.prepare(`SELECT id,name FROM teams WHERE id IN (${teamIds})
      ORDER BY rank,name COLLATE NOCASE,id`).bind(JSON.stringify([...allowed])).all<CompetenceTeam>();
    const teamId = requested||teams[0]?.id;
    if(!teamId)return forbidden();
    const [skills,people,assessments] = await Promise.all([
      db.prepare(`SELECT ${skillFields} FROM competence_skills WHERE team_id=?
        ORDER BY family COLLATE NOCASE,name COLLATE NOCASE,id`).bind(teamId).all<CompetenceSkill>(),
      db.prepare(`WITH roster AS (${roster}) SELECT id,name,userId,active,revision FROM roster WHERE team_id=?
        ORDER BY active DESC,name COLLATE NOCASE,id`).bind(teamId).all<CompetencePerson>(),
      db.prepare(`WITH roster AS (${roster})
        SELECT a.skill_id AS skillId,a.person_id AS personId,a.level,a.revision,a.assessed_at AS assessedAt,u.display_name AS assessedBy
        FROM competence_assessments a JOIN roster p ON p.team_id=a.team_id AND p.id=a.person_id
        LEFT JOIN users u ON u.id=a.assessed_by WHERE a.team_id=? AND p.active=1`)
        .bind(teamId).all<CompetenceAssessment>(),
    ]);
    return reply({teams,teamId,skills:skills.results,people:people.results,assessments:assessments.results} satisfies CompetenceMatrix);
  } catch(error) {
    console.error('Competences read',error);
    return fail('Le module Compétences est indisponible.',503);
  }
}

export async function POST(req:Request) {
  try {
    if(!checkOrigin(req))return fail('Origine non autorisée.',403);
    const gate = await requireRole(req,'editor');
    if(gate.error)return gate.error;
    const body = await req.json().catch(()=>null) as Record<string,unknown>|null;
    const team = body?.teamId;
    if(!body||!isId(team))return fail('Choisissez un service.');
    const user = gate.user!;
    if(!await teamsAllowed(user,[team],true,'manage'))return forbidden();
    const db = database();

    if(body.action==='skill') {
      const name = cleanText(body.name,120),nameKey = labelKey(name),family = cleanText(body.family,70);
      const {id,revision,target} = body;
      if(!nameKey||!family||!isRevision(target)||target<1||target>99)
        return fail('Renseignez le nom, la famille et une cible de 1 à 99 personnes autonomes.');
      if(id!==undefined&&(!isId(id)||!isRevision(revision)||revision<1))return fail('Compétence invalide.');
      const skillId = typeof id==='string'?id:crypto.randomUUID();
      const result = id!==undefined
        ? await db.prepare(`UPDATE OR IGNORE competence_skills
           SET name=?,name_key=?,family=?,target=?,revision=revision+1 WHERE team_id=? AND id=? AND revision=?`)
          .bind(name,nameKey,family,target,team,skillId,revision).run()
        : await db.prepare(`INSERT OR IGNORE INTO competence_skills (id,team_id,name,name_key,family,target)
           SELECT ?,id,?,?,?,? FROM teams WHERE id=?`).bind(skillId,name,nameKey,family,target,team).run();
      if(!result.meta.changes) {
        const duplicate = await db.prepare('SELECT id FROM competence_skills WHERE team_id=? AND name_key=? AND id<>?')
          .bind(team,nameKey,skillId).first();
        return duplicate?fail('Cette compétence existe déjà dans ce service.',409):changed();
      }
      return reply({skill:{id:skillId,name,family,target,revision:id===undefined?1:Number(revision)+1} satisfies CompetenceSkill});
    }

    if(body.action==='person') {
      const name = cleanText(body.name,100),nameKey = labelKey(name);
      if(!nameKey)return fail('Renseignez le nom du collaborateur.');
      const members = await db.prepare(`WITH roster AS (${roster}) SELECT name FROM roster WHERE team_id=? AND userId IS NOT NULL`)
        .bind(team).all<{name:string}>();
      if(members.results.some(member=>labelKey(member.name)===nameKey))
        return fail('Un compte de ce nom figure déjà dans l’équipe.',409);
      const id = crypto.randomUUID();
      const added = await db.prepare(`INSERT OR IGNORE INTO competence_people (id,team_id,name,name_key)
        SELECT ?,id,?,? FROM teams WHERE id=?`).bind(id,name,nameKey,team).run();
      if(!added.meta.changes)return fail('Ce collaborateur figure déjà dans l’effectif actif ou retiré.',409);
      return reply({person:{id:'person:'+id,name,userId:null,active:1,revision:1} satisfies CompetencePerson});
    }

    if(body.action==='person-status') {
      const {id,revision,active} = body;
      if(!isId(id)||!id.startsWith('person:')||!isRevision(revision)||revision<1||typeof active!=='boolean')
        return fail('Collaborateur invalide.');
      const updated = await db.prepare('UPDATE competence_people SET active=?,revision=revision+1 WHERE team_id=? AND id=? AND revision=?')
        .bind(Number(active),team,id.slice(7),revision).run();
      return updated.meta.changes?reply({id,active:Number(active),revision:revision+1}):changed();
    }

    if(body.action==='assessment') {
      const {skillId,personId,level,revision} = body;
      if(!isId(skillId)||!isId(personId)||!(level===''||isCompetenceLevel(level))||!isRevision(revision))
        return fail('Évaluation invalide.');
      const now = new Date().toISOString();
      // The revision and current roster are checked in the same write.
      const updated = await db.prepare(`WITH roster AS (${roster})
        INSERT INTO competence_assessments (team_id,skill_id,person_id,level,assessed_at,assessed_by)
        SELECT s.team_id,s.id,p.id,?,?,? FROM competence_skills s
        JOIN roster p ON p.team_id=s.team_id AND p.id=? AND p.active=1
        WHERE s.team_id=? AND s.id=? AND COALESCE((SELECT a.revision FROM competence_assessments a
          WHERE a.skill_id=s.id AND a.person_id=p.id),0)=?
        ON CONFLICT(skill_id,person_id) DO UPDATE SET level=excluded.level,revision=competence_assessments.revision+1,
          assessed_at=excluded.assessed_at,assessed_by=excluded.assessed_by`)
        .bind(level,now,user.id,personId,team,skillId,revision).run();
      if(!updated.meta.changes)return changed();
      return reply({assessment:{skillId,personId,level,revision:revision+1,assessedAt:now,
        assessedBy:user.displayName} satisfies CompetenceAssessment});
    }

    return fail('Opération inconnue.');
  } catch(error) {
    console.error('Competences write',error);
    return fail('Enregistrement impossible. Réessayez.',503);
  }
}

import {database} from '@/db/raw';
import {checkOrigin,requireRole} from '@/lib/access';
import {accessibleTeams} from '@/lib/team-access';
import {labelKey} from '@/lib/hub';
import {
  isCompetenceLevel,type CompetenceAssessment,type CompetenceLibrarySkill,type CompetenceMatrix,
  type CompetencePerson,type CompetenceProfileSkill,type CompetenceRelay,type CompetenceSearch,
  type CompetenceSkill,type CompetenceTeam,
} from '@/lib/competences';

const privateHeaders = {'Cache-Control':'private, no-store'};
const reply = (data:unknown,status=200) => Response.json(data,{status,headers:privateHeaders});
const fail = (error:string,status=400) => reply({error},status);
const forbidden = () => fail('La gestion des compétences est réservée aux administrateurs d’équipe.',403);
const changed = () => fail('La fiche a changé ou n’est plus accessible. Actualisez avant de réessayer.',409);

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
function isTarget(value:unknown):value is number {
  return isRevision(value)&&value>=1&&value<=99;
}

export async function GET(req:Request) {
  try {
    const gate = await requireRole(req,'editor');
    if(gate.error)return gate.error;
    const user = gate.user!;
    const allowed = await accessibleTeams(user,true,'manage');
    if(!allowed.size)return forbidden();
    const db = database(),query = new URL(req.url).searchParams;
    const requested = query.get('team')||'';
    if(requested&&!allowed.has(requested))return forbidden();

    if(query.get('view')==='search') {
      const term = labelKey(cleanText(query.get('q')||'',120)),skillId = query.get('skill')||'';
      if(skillId?!isId(skillId):term.length<2)return fail('Saisissez au moins deux caractères ou choisissez une compétence.');
      const filter = skillId?'s.id=?':'(instr(s.name_key,?)>0 OR instr(s.family_key,?)>0)';
      const scope = JSON.stringify(requested?[requested]:[...allowed]);
      const {results} = await db.prepare(`WITH roster AS (${roster})
        SELECT s.id AS skillId,s.name AS skill,s.family,p.id AS personId,p.name,p.userId,
          a.assessed_at AS assessedAt,json_group_array(t.name ORDER BY t.name COLLATE NOCASE,t.id) AS teamNames
        FROM competence_evaluations a JOIN competence_library s ON s.id=a.skill_id
        JOIN roster p ON p.id=a.person_id AND p.active=1 JOIN teams t ON t.id=p.team_id
        WHERE p.team_id IN (${teamIds}) AND a.level='U' AND ${filter}
        GROUP BY s.id,p.id,p.name,p.userId,a.assessed_at
        ORDER BY s.name COLLATE NOCASE,p.name COLLATE NOCASE,s.id,p.id LIMIT 121`)
        .bind(scope,...(skillId?[skillId]:[term,term])).all<Omit<CompetenceRelay,'teams'>&{teamNames:string}>();
      const relays = results.slice(0,120).map(({teamNames,...relay})=>({...relay,teams:JSON.parse(teamNames) as string[]}));
      return reply({relays,truncated:results.length>120} satisfies CompetenceSearch);
    }

    if(query.get('view')==='person') {
      const person = query.get('person');
      if(!requested||!isId(person))return fail('Choisissez un service et un collaborateur.');
      const {results} = await db.prepare(`WITH roster AS (${roster})
        SELECT s.id,s.name,s.family,a.level,a.assessed_at AS assessedAt,ts.skill_id IS NOT NULL AS inMatrix
        FROM competence_evaluations a JOIN competence_library s ON s.id=a.skill_id
        JOIN roster p ON p.id=a.person_id AND p.team_id=? AND p.active=1
        LEFT JOIN competence_team_skills ts ON ts.skill_id=s.id AND ts.team_id=p.team_id AND ts.active=1
        WHERE p.id=? AND a.level<>''
        ORDER BY s.family COLLATE NOCASE,s.name COLLATE NOCASE,s.id`)
        .bind(requested,person).all<Omit<CompetenceProfileSkill,'inMatrix'>&{inMatrix:number}>();
      return reply({skills:results.map(skill=>({...skill,inMatrix:Boolean(skill.inMatrix)}))});
    }

    const {results:teams} = await db.prepare(`SELECT id,name FROM teams WHERE id IN (${teamIds})
      ORDER BY rank,name COLLATE NOCASE,id`).bind(JSON.stringify([...allowed])).all<CompetenceTeam>();
    const teamId = requested||teams[0]?.id;
    if(!teamId)return forbidden();
    const [library,skills,people,assessments] = await Promise.all([
      db.prepare(`SELECT id,name,family,revision FROM competence_library
        ORDER BY family COLLATE NOCASE,name COLLATE NOCASE,id`).all<CompetenceLibrarySkill>(),
      db.prepare(`SELECT s.id,s.name,s.family,ts.target,ts.revision
        FROM competence_team_skills ts JOIN competence_library s ON s.id=ts.skill_id
        WHERE ts.team_id=? AND ts.active=1 ORDER BY s.family COLLATE NOCASE,s.name COLLATE NOCASE,s.id`)
        .bind(teamId).all<CompetenceSkill>(),
      db.prepare(`WITH roster AS (${roster}) SELECT id,name,userId,active,revision FROM roster WHERE team_id=?
        ORDER BY active DESC,name COLLATE NOCASE,id`).bind(teamId).all<CompetencePerson>(),
      db.prepare(`WITH roster AS (${roster})
        SELECT a.skill_id AS skillId,a.person_id AS personId,a.level,a.revision,a.assessed_at AS assessedAt,
          u.display_name AS assessedBy
        FROM competence_evaluations a JOIN roster p ON p.id=a.person_id
        JOIN competence_team_skills ts ON ts.team_id=p.team_id AND ts.skill_id=a.skill_id AND ts.active=1
        LEFT JOIN users u ON u.id=a.assessed_by AND a.assessed_team_id=p.team_id
        WHERE p.team_id=? AND p.active=1`).bind(teamId).all<CompetenceAssessment>(),
    ]);
    return reply({
      teams,teamId,library:library.results,canEditLibrary:user.role==='admin',
      skills:skills.results,people:people.results,assessments:assessments.results,
    } satisfies CompetenceMatrix);
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
    const allowed = await accessibleTeams(user,true,'manage');
    if(!allowed.has(team))return forbidden();
    const db = database();

    if(body.action==='library-skill') {
      const name = cleanText(body.name,120),nameKey = labelKey(name);
      const family = cleanText(body.family,70),familyKey = labelKey(family);
      const {id,revision,target} = body;
      if(!nameKey||!familyKey)return fail('Renseignez le nom et la famille de la compétence.');
      if(id!==undefined) {
        if(user.role!=='admin')return fail('La modification du référentiel est réservée aux administrateurs du site.',403);
        if(!isId(id)||!isRevision(revision)||revision<1)return fail('Compétence invalide.');
        const result = await db.prepare(`UPDATE OR IGNORE competence_library
          SET name=?,name_key=?,family=?,family_key=?,revision=revision+1 WHERE id=? AND revision=?`)
          .bind(name,nameKey,family,familyKey,id,revision).run();
        if(result.meta.changes)return reply({id});
        const duplicate = await db.prepare('SELECT id FROM competence_library WHERE name_key=? AND family_key=? AND id<>?')
          .bind(nameKey,familyKey,id).first();
        return duplicate?fail('Cette compétence existe déjà dans cette famille.',409):changed();
      }
      if(target!==undefined&&!isTarget(target))return fail('Choisissez une cible de 1 à 99 personnes autonomes.');
      const skillId = crypto.randomUUID();
      const insert = db.prepare(`INSERT INTO competence_library (id,name,name_key,family,family_key)
        VALUES (?,?,?,?,?) ON CONFLICT(name_key,family_key) DO NOTHING`).bind(skillId,name,nameKey,family,familyKey);
      const result = target===undefined ? await insert.run() : (await db.batch([
        insert,
        db.prepare(`INSERT INTO competence_team_skills (team_id,skill_id,target)
          SELECT ?,id,? FROM competence_library WHERE id=?`).bind(team,target,skillId),
      ]))[0];
      return result.meta.changes?reply({id:skillId}):fail('Cette compétence existe déjà dans cette famille. Retrouvez-la dans la bibliothèque.',409);
    }

    if(body.action==='team-skill') {
      const {skillId,revision,target,remove} = body;
      if(!isId(skillId)||revision!==undefined&&(!isRevision(revision)||revision<1))
        return fail('Compétence invalide.');
      if(remove===true) {
        if(revision===undefined)return fail('Compétence invalide.');
        const result = await db.prepare(`UPDATE competence_team_skills SET active=0,revision=revision+1
          WHERE team_id=? AND skill_id=? AND active=1 AND revision=?`).bind(team,skillId,revision).run();
        return result.meta.changes?reply({id:skillId}):changed();
      }
      if(!isTarget(target))return fail('Choisissez une cible de 1 à 99 personnes autonomes.');
      const result = revision===undefined
        ? await db.prepare(`INSERT INTO competence_team_skills (team_id,skill_id,target)
          SELECT ?,id,? FROM competence_library WHERE id=?
          ON CONFLICT(team_id,skill_id) DO UPDATE SET target=excluded.target,active=1,revision=competence_team_skills.revision+1
          WHERE competence_team_skills.active=0`).bind(team,target,skillId).run()
        : await db.prepare(`UPDATE competence_team_skills SET target=?,revision=revision+1
          WHERE team_id=? AND skill_id=? AND active=1 AND revision=?`).bind(target,team,skillId,revision).run();
      return result.meta.changes?reply({id:skillId}):changed();
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

    if(body.action==='person-transfer') {
      const {id,revision,destination} = body;
      if(!isId(id)||!id.startsWith('person:')||!isRevision(revision)||revision<1||!isId(destination)||destination===team)
        return fail('Choisissez un autre service.');
      if(!allowed.has(destination))return forbidden();
      const person = await db.prepare('SELECT name_key FROM competence_people WHERE team_id=? AND id=? AND active=1 AND revision=?')
        .bind(team,id.slice(7),revision).first<{name_key:string}>();
      if(!person)return changed();
      const members = await db.prepare(`WITH roster AS (${roster}) SELECT name FROM roster WHERE team_id=? AND userId IS NOT NULL`)
        .bind(destination).all<{name:string}>();
      if(members.results.some(member=>labelKey(member.name)===person.name_key))
        return fail('Un compte de ce nom figure déjà dans le service de destination.',409);
      const updated = await db.prepare(`UPDATE OR IGNORE competence_people SET team_id=?,revision=revision+1
        WHERE team_id=? AND id=? AND active=1 AND revision=?`).bind(destination,team,id.slice(7),revision).run();
      if(updated.meta.changes)return reply({id});
      const duplicate = await db.prepare('SELECT id FROM competence_people WHERE team_id=? AND name_key=? AND id<>?')
        .bind(destination,person.name_key,id.slice(7)).first();
      return duplicate?fail('Un collaborateur de ce nom figure déjà dans le service de destination.',409):changed();
    }

    if(body.action==='assessment') {
      const {skillId,personId,level,revision} = body;
      if(!isId(skillId)||!isId(personId)||!(level===''||isCompetenceLevel(level))||!isRevision(revision))
        return fail('Évaluation invalide.');
      const now = new Date().toISOString();
      // The person, active service skill and shared evaluation revision must still match.
      const updated = await db.prepare(`WITH roster AS (${roster})
        INSERT INTO competence_evaluations (skill_id,person_id,level,assessed_at,assessed_by,assessed_team_id)
        SELECT ts.skill_id,p.id,?,?,?,p.team_id FROM competence_team_skills ts
        JOIN roster p ON p.team_id=ts.team_id AND p.id=? AND p.active=1
        WHERE ts.team_id=? AND ts.skill_id=? AND ts.active=1 AND COALESCE((SELECT a.revision FROM competence_evaluations a
          WHERE a.skill_id=ts.skill_id AND a.person_id=p.id),0)=?
        ON CONFLICT(skill_id,person_id) DO UPDATE SET level=excluded.level,revision=competence_evaluations.revision+1,
          assessed_at=excluded.assessed_at,assessed_by=excluded.assessed_by,assessed_team_id=excluded.assessed_team_id`)
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

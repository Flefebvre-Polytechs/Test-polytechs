import {labelKey} from '../lib/hub.ts';

// The original tables retain the per-service records from before the shared library.
// Use an existing ID for each matching pair of normalized name and family.
export function migrateCompetenceLibrary(db) {
  db.function('competence_key',{deterministic:true},labelKey);
  db.exec(`WITH choices AS (
    SELECT id,name,name_key,family,competence_key(family) AS family_key,
      row_number() OVER (PARTITION BY name_key,competence_key(family) ORDER BY id) AS choice
    FROM competence_skills
  )
  INSERT INTO competence_library (id,name,name_key,family,family_key)
    SELECT id,name,name_key,family,family_key FROM choices WHERE choice=1;

  INSERT INTO competence_team_skills (team_id,skill_id,target,revision)
    SELECT s.team_id,l.id,s.target,s.revision FROM competence_skills s
    JOIN competence_library l ON l.name_key=s.name_key AND l.family_key=competence_key(s.family);

  WITH ranked AS (
    SELECT l.id AS library_id,a.*,
      row_number() OVER (PARTITION BY l.id,a.person_id
        ORDER BY (a.level<>'') DESC,a.assessed_at DESC,a.skill_id) AS choice,
      max(a.revision) OVER (PARTITION BY l.id,a.person_id) AS current_revision
    FROM competence_assessments a
    JOIN competence_skills s ON s.id=a.skill_id AND s.team_id=a.team_id
    JOIN competence_library l ON l.name_key=s.name_key AND l.family_key=competence_key(s.family)
  )
  INSERT INTO competence_evaluations (skill_id,person_id,level,revision,assessed_at,assessed_by,assessed_team_id)
    SELECT library_id,person_id,level,current_revision,assessed_at,assessed_by,team_id FROM ranked WHERE choice=1;`);
}

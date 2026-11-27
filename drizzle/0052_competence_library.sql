CREATE TABLE competence_library (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  family TEXT NOT NULL,
  family_key TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(name_key,family_key)
);

CREATE TABLE competence_team_skills (
  team_id TEXT NOT NULL REFERENCES teams(id),
  skill_id TEXT NOT NULL REFERENCES competence_library(id),
  target INTEGER NOT NULL DEFAULT 2 CHECK(target BETWEEN 1 AND 99),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(team_id,skill_id)
);

CREATE TABLE competence_evaluations (
  skill_id TEXT NOT NULL REFERENCES competence_library(id),
  person_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('','I','L','U')),
  revision INTEGER NOT NULL DEFAULT 1,
  assessed_at TEXT NOT NULL,
  assessed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  assessed_team_id TEXT NOT NULL REFERENCES teams(id),
  PRIMARY KEY(skill_id,person_id)
);
CREATE INDEX competence_evaluations_person ON competence_evaluations(person_id,skill_id);
CREATE INDEX competence_evaluations_relay ON competence_evaluations(level,skill_id,person_id);

CREATE TABLE competence_skills (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  family TEXT NOT NULL,
  target INTEGER NOT NULL DEFAULT 2 CHECK(target BETWEEN 1 AND 99),
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(team_id,name_key),
  UNIQUE(team_id,id)
);
CREATE TABLE competence_people (
  id TEXT PRIMARY KEY NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  revision INTEGER NOT NULL DEFAULT 1,
  UNIQUE(team_id,name_key)
);
CREATE TABLE competence_assessments (
  team_id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  person_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('','I','L','U')),
  revision INTEGER NOT NULL DEFAULT 1,
  assessed_at TEXT NOT NULL,
  assessed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY(skill_id,person_id),
  FOREIGN KEY(team_id,skill_id) REFERENCES competence_skills(team_id,id)
);
CREATE INDEX competence_assessments_relay ON competence_assessments(team_id,level,skill_id);

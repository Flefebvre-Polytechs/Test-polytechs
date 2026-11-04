CREATE TABLE ticket_labels (
 id TEXT PRIMARY KEY NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('topic','location')),
 category TEXT NOT NULL DEFAULT '',
 name TEXT NOT NULL,
 name_key TEXT NOT NULL,
 created_by TEXT REFERENCES users(id),
 created_at TEXT NOT NULL,
 UNIQUE(kind,category,name_key)
);
INSERT INTO ticket_labels(id,kind,category,name,name_key,created_at) VALUES
 ('env-waste','topic','Environnement','Déchets','dechets',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('env-water','topic','Environnement','Eau','eau',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('env-air','topic','Environnement','Air','air',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('env-spill','topic','Environnement','Déversement accidentel','deversement accidentel',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('place-site-1','location','','Site 1','site 1',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('place-site-2','location','','Site 2','site 2',strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 ('place-maris-51','location','','MARIS 51','maris 51',strftime('%Y-%m-%dT%H:%M:%fZ','now'));

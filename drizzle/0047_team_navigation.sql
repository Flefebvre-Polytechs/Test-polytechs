ALTER TABLE teams ADD COLUMN navigation_group TEXT NOT NULL DEFAULT 'other'
  CHECK (navigation_group IN ('management','operations','support','other'));
--> statement-breakpoint
ALTER TABLE teams ADD COLUMN navigation_order INTEGER NOT NULL DEFAULT 0 CHECK (navigation_order >= 0);
--> statement-breakpoint
WITH defaults(id, section, position) AS (
  VALUES ('direction','management',1),('qsse','management',2),
    ('commercial','operations',1),('planification','operations',2),('rd','operations',3),
    ('production','operations',4),('laboratoire','operations',5),('logistique','operations',6),
    ('travaux-neufs','support',1),('achats','support',2),('rh','support',3),
    ('procedes','support',4),('maintenance','support',5),('informatique','support',6)
)
UPDATE teams SET navigation_group=defaults.section,navigation_order=defaults.position
FROM defaults WHERE teams.id=defaults.id;

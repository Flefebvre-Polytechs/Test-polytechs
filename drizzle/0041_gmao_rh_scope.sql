-- Repair the service of interventions created from an RH ticket.
UPDATE gmao_orders AS o
SET data=json_set(data,'$.teamId','rh'), revision=revision+1
WHERE json_extract(o.data,'$.teamId')<>'rh' AND EXISTS (
 SELECT 1 FROM hub_tickets t, json_each(t.data,'$.teams') team
 WHERE t.id=o.ticket_id AND team.value='rh'
);
-- Protect linked tickets when the intervention already belongs to RH.
UPDATE hub_tickets AS t
SET data=json_insert(data,'$.teams[#]','rh'), revision=revision+1
WHERE EXISTS (
 SELECT 1 FROM gmao_orders o WHERE o.ticket_id=t.id AND json_extract(o.data,'$.teamId')='rh'
) AND NOT EXISTS (SELECT 1 FROM json_each(t.data,'$.teams') team WHERE team.value='rh');

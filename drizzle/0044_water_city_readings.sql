-- Both keys describe the same source. Keep the existing city reading when both
-- are present, and fill its missing fields from the network reading.
INSERT INTO env_consumption_history
  (id, record_id, previous_snapshot, new_snapshot, actor_id, actor, created_at)
SELECT lower(hex(randomblob(16))),
       coalesce(city.id, network.id),
       json_object('metric', network.metric, 'value', network.value, 'target', network.target,
                   'note', network.note, 'sourceRecordId', network.id,
                   'existingCity', CASE WHEN city.id IS NOT NULL THEN
                     json_object('value', city.value, 'target', city.target, 'note', city.note) END),
       json_object('metric', 'water_consumed_m3',
                   'value', coalesce(city.value, network.value),
                   'target', coalesce(city.target, network.target),
                   'note', coalesce(nullif(city.note, ''), network.note)),
       'migration-0044', 'Regroupement des relevés d’eau de ville',
       strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM env_consumption_records AS network
LEFT JOIN env_consumption_records AS city
  ON city.site = network.site AND city.period = network.period
  AND city.metric = 'water_consumed_m3'
WHERE network.metric = 'water_network_m3';

UPDATE env_consumption_records AS city
SET value = coalesce(city.value, network.value),
    target = coalesce(city.target, network.target),
    note = coalesce(nullif(city.note, ''), network.note),
    revision = max(city.revision, network.revision) + 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    updated_by = 'Regroupement des relevés d’eau de ville'
FROM env_consumption_records AS network
WHERE city.metric = 'water_consumed_m3' AND network.metric = 'water_network_m3'
  AND city.site = network.site AND city.period = network.period;

UPDATE env_consumption_history AS history
SET record_id = city.id
FROM env_consumption_records AS network
JOIN env_consumption_records AS city
  ON city.site = network.site AND city.period = network.period
  AND city.metric = 'water_consumed_m3'
WHERE network.metric = 'water_network_m3' AND history.record_id = network.id;

DELETE FROM env_consumption_records AS network
WHERE network.metric = 'water_network_m3'
  AND EXISTS (
    SELECT 1 FROM env_consumption_records AS city
    WHERE city.metric = 'water_consumed_m3'
      AND city.site = network.site AND city.period = network.period
  );

UPDATE env_consumption_records
SET metric = 'water_consumed_m3', revision = revision + 1
WHERE metric = 'water_network_m3';

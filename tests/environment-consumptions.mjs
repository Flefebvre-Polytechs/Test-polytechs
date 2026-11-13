import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {environmentMetrics,environmentSections,environmentMetricKeys,validMonth,monthsEnding,sumEnvironment,environmentIntensity,environmentShare,monthlyEnvironment} from '../lib/environment-consumptions.ts';

assert.equal(environmentSections.length,5,'Five tabs follow the requested environment navigation');
assert.equal(new Set(environmentMetrics.map(m=>m.key)).size,environmentMetrics.length,'No duplicate indicator keys');
for(const metric of environmentMetrics){assert.ok(environmentSections.some(s=>s.id===metric.section));assert.ok(environmentMetricKeys.has(metric.key))}
assert.equal(validMonth('2026-11'),true);assert.equal(validMonth('2026-13'),false);assert.equal(validMonth('2026-00'),false);
assert.deepEqual(monthsEnding('2026-02',3),['2025-12','2026-01','2026-02']);
assert.equal(monthsEnding('nonsense',12).length,0);
const record=(site,metric,period,value,target=null)=>({id:crypto.randomUUID(),site,metric,period,value,target,note:'',revision:1,updated_at:'2026-11-10',updated_by:'test'});
const periods=['2026-10','2026-11'];
const items=[
 record('site-1','electricity_grid_kwh','2026-10',180,150),
 record('site-2','electricity_grid_kwh','2026-10',20,null),
 record('site-1','electricity_grid_kwh','2026-11',0,180),
 record('site-1','production_t','2026-10',10,12),
 record('site-2','production_t','2026-10',2,null),
 record('site-1','production_t','2026-11',2,null),
 record('site-1','water_consumed_m3','2026-10',5,5)
];
assert.deepEqual(sumEnvironment(items,'natural_gas_kwh',periods,'all'),{value:null,count:0,expected:4,partial:false},'Missing readings are not zero');
assert.deepEqual(sumEnvironment(items,'electricity_grid_kwh',periods,'all'),{value:200,count:3,expected:4,partial:true});
assert.deepEqual(sumEnvironment(items,'electricity_grid_kwh',periods,'site-1'),{value:180,count:2,expected:2,partial:false},'Zero is a valid measured amount');
assert.deepEqual(sumEnvironment(items,'electricity_grid_kwh',periods,'site-1','target'),{value:330,count:2,expected:2,partial:false});
assert.equal(environmentIntensity(items,'electricity_grid_kwh',periods,'site-1').value,15);
assert.equal(environmentIntensity(items,'natural_gas_kwh',periods,'site-1').value,null);
assert.equal(environmentIntensity(items,'electricity_grid_kwh',periods,'all').partial,true);
const paired=environmentIntensity(items.filter(x=>!(x.metric==='electricity_grid_kwh'&&x.period==='2026-11')), 'electricity_grid_kwh',periods,'site-1');
assert.equal(paired.value,18,'Intensity must use only matched site-month production and energy');
assert.equal(paired.partial,true,'Omitted months are flagged as partial coverage');
assert.equal(environmentShare([record('site-1','recycled_material_t','2026-11',3),record('site-1','virgin_material_t','2026-11',7)],'recycled_material_t','virgin_material_t',['2026-11'],'site-1').value,30);
assert.equal(environmentShare(items,'solar_self_kwh','electricity_grid_kwh',periods,'site-1').value,null,'No invented share without renewable source readings');

const monthly=monthlyEnvironment(items,'water_consumed_m3',periods,'site-1');
assert.equal(monthly[0].actual,5);assert.equal(monthly[1].actual,null);
assert.equal(monthly[1].target,null);

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync('drizzle/0039_environment_consumptions.sql','utf8'));
db.prepare("INSERT INTO env_consumption_records(id,site,period,metric,value,target,note,revision,updated_at,updated_by) VALUES('first','site-1','2026-11','electricity_grid_kwh',0,NULL,'compteur',1,'now','tester')").run();
assert.equal(db.prepare('SELECT value FROM env_consumption_records WHERE id=?').get('first').value,0);
assert.throws(()=>db.prepare("INSERT INTO env_consumption_records(id,site,period,metric,value,target,note,revision,updated_at,updated_by) VALUES('second','site-1','2026-11','electricity_grid_kwh',1,NULL,'',1,'now','tester')").run(),/UNIQUE/,'One reading per metric/site/month');
assert.throws(()=>db.prepare("INSERT INTO env_consumption_records(id,site,period,metric,value,target,note,revision,updated_at,updated_by) VALUES('neg','site-2','2026-11','fuel_l',-1,NULL,'',1,'now','tester')").run(),/CHECK/);
assert.throws(()=>db.prepare("INSERT INTO env_consumption_history VALUES('h','not-found','{}','{}','tester','tester','now')").run(),/FOREIGN KEY/);
const insertWater=db.prepare("INSERT INTO env_consumption_records VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'now', 'tester')");
insertWater.run('network-only','site-2','2026-10','water_network_m3',6,null,'facture');
insertWater.run('network-duplicate','site-1','2026-10','water_network_m3',7,12,'compteur');
insertWater.run('city','site-1','2026-10','water_consumed_m3',0,null,'');
db.prepare("INSERT INTO env_consumption_history VALUES('original-event','network-duplicate','{}','{}','tester','tester','now')").run();
const waterMigration=fs.readFileSync('drizzle/0044_water_city_readings.sql','utf8');
db.exec(waterMigration);
db.exec(waterMigration);
assert.deepEqual(db.prepare("SELECT id,value,target,note FROM env_consumption_records WHERE metric='water_consumed_m3' ORDER BY site").all().map(row=>({...row})),[
 {id:'city',value:0,target:12,note:'compteur'},
 {id:'network-only',value:6,target:null,note:'facture'}
]);
assert.equal(db.prepare("SELECT count(*) n FROM env_consumption_records WHERE metric='water_network_m3'").get().n,0);
assert.equal(db.prepare("SELECT record_id FROM env_consumption_history WHERE id='original-event'").get().record_id,'city');
const mergeHistory=db.prepare("SELECT previous_snapshot FROM env_consumption_history WHERE record_id='city' AND actor_id='migration-0044'").all();
assert.equal(mergeHistory.length,1);
assert.equal(JSON.parse(mergeHistory[0].previous_snapshot).value,7);
assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
db.close();
const api=fs.readFileSync('app/api/environnement/consommations/route.ts','utf8');
assert.match(api,/teamsAllowed\(gate.user!,\['qsse'\]\)/,'Read is permission-gated to QSSE');
assert.match(api,/checkOrigin\(req\)/,'Writes must reject cross-site requests');
assert.match(api,/requireRole\(req,'editor'\)/,'Writes require editor role');
assert.match(api,/teamsAllowed\(gate.user!,\['qsse'\],true\)/,'Writes require QSSE write permission');
assert.match(api,/db\.batch\(/,'Writes and audit must be transactional');
assert.match(api,/env_consumption_history/,'Changes must have audit history');
const importer=fs.readFileSync('scripts/render-import.mjs','utf8');
assert.match(importer,/'env_consumption_records','env_consumption_history'/,'Pre-module backups remain importable');
const menu=fs.readFileSync('components/team-navigation.tsx','utf8');
assert.match(menu,/Suivi des consommations','\/environnement\/consommations'/,'QSSE environment navigation exposes module');
const page=fs.readFileSync('app/environnement/consommations/page.tsx','utf8');
assert.match(page,/type="month"/,'Monthly entry selection');
assert.match(page,/exportCsv/,'CSV export option');
assert.match(page,/Historique du relevé/,'Audit history visible');
console.log('Environment consumption: five categories, NULL vs zero, periods, site totals, ratios, SQL constraints, QSSE ACL, transaction auditing and navigation passed.');

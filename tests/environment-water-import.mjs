import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {frenchDecimal,parseWaterTable,waterImportMonthName} from '../lib/environment-water-import.ts';
import {environmentMetricKeys,environmentMetrics,formatEnvironmentNumber} from '../lib/environment-consumptions.ts';

assert.equal(frenchDecimal('1 234,5678'),1234.5678);
assert.equal(frenchDecimal('3 900'),3900);
assert.equal(frenchDecimal('0'),0);
assert.equal(frenchDecimal('12,34567'),null,'More than four decimals must be rejected');
assert.equal(frenchDecimal('12 34'),null,'Invalid French thousands grouping must be rejected');
assert.equal(frenchDecimal('-15'),null,'Negative volumes are not valid');
assert.equal(frenchDecimal('abc'),null);
const sample=`|  | quantité produite en T | consommation en mètres cube |
| --- | --- | --- |
| Janvier  | 1 234,5678 | 3 900 |
| Février | 1 300,4000 | 4 100 |
| Mars | 1 400,0000 | 3 700 |`;
const parsed=parseWaterTable(sample);
assert.deepEqual(parsed.errors,[]);
assert.deepEqual(parsed.rows,[
 {month:1,production:1234.5678,water:3900},
 {month:2,production:1300.4,water:4100},
 {month:3,production:1400,water:3700}
]);
assert.equal(waterImportMonthName(8),'Aout','Month labels are normalized to their canonical keys');
const duplicates=parseWaterTable('Janvier | 1000,0000 | 2000\nJanvier | 1001,0000 | 2001');
assert.match(duplicates.errors.join(' '),/double/);
assert.equal(parseWaterTable('Janvier | 1000,12345 | 2000').rows.length,0);
assert.equal(parseWaterTable('Janvier;1000,0000;4000').rows.length,1,'Semicolon CSV is accepted');
assert.equal(parseWaterTable('Janvier\t1000,0000\t4000').rows.length,1,'Tab-delimited tables are accepted');
assert.equal(environmentMetricKeys.has('water_consumed_m3'),true,'Existing water readings retain their stable key');
assert.equal(formatEnvironmentNumber(1234.5678),new Intl.NumberFormat('fr-FR',{maximumFractionDigits:4}).format(1234.5678));
assert.equal(environmentMetrics.some(m=>m.key==='water_consumed_m3'&&m.unit==='m³'),true);

const api=fs.readFileSync('app/api/environnement/consommations/route.ts','utf8');
const page=fs.readFileSync('app/environnement/consommations/bulk-import.tsx','utf8');
assert.match(api,/body\.action==='import-production-water'/);
assert.match(api,/if\(!checkOrigin\(req\)\)/,'Bulk import must require anti-CSRF checks');
assert.match(api,/requireRole\(req,'editor'\)/,'Bulk import must require editor role');
assert.match(api,/teamsAllowed\(gate.user!,\['qsse'\],true\)/,'Bulk import must require QSSE edit permission');
assert.match(api,/INSERT INTO env_consumption_records/,'Bulk import uses insert-only SQL');
assert.doesNotMatch(api.slice(api.indexOf("if(body.action==='import-production-water')"),api.indexOf("if(body.action!=='save')")),/INSERT OR IGNORE|REPLACE INTO|UPDATE env_consumption_records/,'Never overwrite imported readings');
assert.match(api,/db\.batch\(statements\)/,'Bulk import must be one transaction');
assert.match(page,/\[year,setYear\]=useState\(''\)/,'Never assume a year');
assert.match(page,/\[site,setSite\]=useState\(''\)/,'Never assume a site');
assert.match(page,/setConfirmed\(false\)/,'Explicit acknowledgement is required');
assert.match(page,/water_consumed_m3/,'Use the existing consumption key for city water');

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;'+fs.readFileSync('drizzle/0039_environment_consumptions.sql','utf8'));
const insert=db.prepare('INSERT INTO env_consumption_records(id,site,period,metric,value,target,note,revision,updated_at,updated_by) VALUES (?,?,?,?,?,NULL,?,1,?,?)');
db.exec('BEGIN IMMEDIATE');
try{insert.run('one','site-1','2026-01','production_t',1234.5678,'test','now','tester');insert.run('two','site-1','2026-01','water_consumed_m3',3900,'test','now','tester');db.exec('COMMIT')}
catch(e){db.exec('ROLLBACK');throw e}
assert.equal(db.prepare("SELECT value FROM env_consumption_records WHERE id='one'").get().value,1234.5678);
assert.throws(()=>{
 db.exec('BEGIN IMMEDIATE');
 try{insert.run('three','site-1','2026-02','production_t',2000,'test','now','tester');insert.run('dup','site-1','2026-01','production_t',1000,'test','now','tester');db.exec('COMMIT')}
 catch(e){db.exec('ROLLBACK');throw e}
},/UNIQUE/);
assert.equal(db.prepare("SELECT count(*) n FROM env_consumption_records WHERE period='2026-02'").get().n,0,'Duplicate import rolls back other rows');
db.close();
console.log('French four-decimal input, site/year confirmation, import-only transaction and no-duplicate regressions passed.');

assert.match(environmentMetrics.find(m=>m.key==='water_consumed_m3').label,/eau de ville/);

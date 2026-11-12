import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'epi-indicators-')),db=new DatabaseSync(':memory:');
globalThis.epiIndicatorsAllowed=true;
globalThis.epiIndicatorsDb={prepare(sql){return {args:[],bind(...args){this.args=args;return this},async all(){return {results:db.prepare(sql).all(...this.args)}}}}};
try{
  db.exec('CREATE TABLE epi_products(code TEXT,name TEXT,supplier_reference TEXT,family TEXT,quantity INTEGER,minimum INTEGER,unit_cost_cents INTEGER,catalog_status TEXT);CREATE TABLE epi_movements(id TEXT,code TEXT,kind TEXT,delta INTEGER,unit_cost_cents INTEGER,created_at TEXT);');
  fs.writeFileSync(path.join(dir,'access.mjs'),'export const requireRole=async()=>({user:{id:"test"}});');
  fs.writeFileSync(path.join(dir,'epi-access.mjs'),'export const epiCanRead=async()=>globalThis.epiIndicatorsAllowed;');
  fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.epiIndicatorsDb;');
  fs.writeFileSync(path.join(dir,'catalog.mjs'),'export const ensureCatalog=async()=>{};');
  let source=fs.readFileSync('app/api/epi-stock/indicators/route.ts','utf8');
  for(const [a,b] of [['@/lib/access','./access.mjs'],['@/lib/epi-access','./epi-access.mjs'],['@/db/raw','./raw.mjs'],['@/lib/epi-catalog-server','./catalog.mjs']])source=source.replaceAll(a,b);
  fs.writeFileSync(path.join(dir,'route.mjs'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const {GET}=await import(path.join(dir,'route.mjs'));
  const get=(q='')=>GET(new Request('https://example.test/api/epi-stock/indicators?'+q));
  for(let i=0;i<15;i++){
    const code='EPI_'+i;
    db.prepare('INSERT INTO epi_products VALUES(?,?,?,?,?,?,?,?)').run(code,'Article '+i,'REF_'+i,i<14?'Tête':'Pied',i===0?null:10,3,999,i===14?'Supprimé':'Actif');
    db.prepare('INSERT INTO epi_movements VALUES(?,?,?,?,?,?)').run('s'+i,code,'sortie',-2,100,'2026-02-01T00:00:00.000Z');
  }
  const move=db.prepare('INSERT INTO epi_movements VALUES(?,?,?,?,?,?)');
  move.run('unknown','EPI_1','sortie',-3,null,'2026-02-28T23:59:59.999Z');
  move.run('free','EPI_1','sortie',-1,0,'2026-02-15T12:00:00.000Z');
  move.run('in','EPI_1','entree',5,200,'2026-01-01T00:00:00.000Z');
  move.run('inventory','EPI_1','inventaire',50,999,'2026-02-10T00:00:00.000Z');
  move.run('excluded','EPI_1','sortie',-99,100,'2026-03-01T00:00:00.000Z');
  const r=await get('from=2026-01&to=2026-02');assert.equal(r.status,200);const d=await r.json();
  assert.equal(d.top.length,15,'Complete ranking includes more than twelve references');
  assert.equal(d.summary.issuedUnits,34);assert.equal(d.summary.receivedUnits,5);assert.equal(d.summary.issuedCostCents,3000);assert.equal(d.summary.unvaluedIssuedUnits,3);assert.equal(d.summary.valuedIssuedUnits,31);
  assert.equal(d.monthly.length,2);assert.equal(d.monthly[0].receivedUnits,5);assert.equal(d.monthly[1].issuedUnits,34);assert.equal(d.period.endExclusive,'2026-03-01');
  assert.equal(d.stock.length,14,'Deleted reference retained only in history');assert.equal(d.summary.notInventoried,1);assert.equal(d.summary.stockValueCents,13*10*999,'Stock uses current prices; historical cost unchanged');
  const filtered=await (await get('from=2026-01&to=2026-02&family=T%C3%AAte&code=EPI_1')).json();assert.equal(filtered.top.length,1);assert.equal(filtered.summary.issuedUnits,6);assert.equal(filtered.summary.issuedCostCents,200);assert.equal(filtered.stock.length,1);
  const empty=await (await get('from=2025-01&to=2025-02')).json();assert.equal(empty.monthly.length,2);assert.equal(empty.summary.issuedUnits,0);assert.equal(empty.top.length,0);
  for(const q of ['from=2026-02','to=2026-02','from=2026-13&to=2026-14','from=2026-02&to=2026-01','from=2024-01&to=2026-01','from=oops&to=2026-02','months=24','family=unknown','family=Pied&code=EPI_1'])assert.equal((await get(q)).status,400,q);
  assert.equal((await get('from=2024-01&to=2025-12')).status,200,'Exactly 24 months allowed');assert.equal((await get('code=EPI_14')).status,404);
  globalThis.epiIndicatorsAllowed=false;assert.equal((await get()).status,403);
  console.log('EPI indicators: complete ranking, boundaries, custom range validation, historical pricing, free/unknown prices, current stock, filters and authorization passed.');
}finally{db.close();delete globalThis.epiIndicatorsDb;delete globalThis.epiIndicatorsAllowed;fs.rmSync(dir,{recursive:true,force:true})}

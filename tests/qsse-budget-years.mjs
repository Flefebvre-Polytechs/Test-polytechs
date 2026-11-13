import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'budget-years-')),db=new DatabaseSync(':memory:');
function stmt(sql,args=[]){return {bind(...v){return stmt(sql,v)},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}}}}}
globalThis.yearDb={prepare:stmt,async batch(ss){db.exec('BEGIN');try{const out=[];for(const s of ss){out.push(await s.run());if(globalThis.yearFault)throw Error('Injected')}db.exec('COMMIT');return out}catch(e){db.exec('ROLLBACK');throw e}}};globalThis.yearAccess={read:true,write:true};
try{
 db.exec('CREATE TABLE qsse_budget_data(id TEXT PRIMARY KEY,data TEXT,revision INTEGER,updated_at TEXT,updated_by TEXT);CREATE TABLE qsse_budget_import(id INTEGER);CREATE TABLE qsse_budget_history(id TEXT PRIMARY KEY,record_id TEXT,snapshot TEXT,saved_at TEXT,saved_by TEXT);');db.exec(fs.readFileSync('drizzle/0043_budget_exercises.sql','utf8'));
 fs.writeFileSync(path.join(dir,'raw.mjs'),'export const database=()=>globalThis.yearDb;');fs.writeFileSync(path.join(dir,'access.mjs'),"export const requireRole=async()=>({user:{id:'manager'}});export const checkOrigin=r=>r.headers.get('origin')==='https://budget.test';");fs.writeFileSync(path.join(dir,'server.mjs'),'export const budgetAccess=async()=>globalThis.yearAccess;');
 function compile(src,out){let s=fs.readFileSync(src,'utf8');for(const [a,b] of [['@/db/raw','./raw.mjs'],['@/lib/access','./access.mjs'],['@/lib/qsse-budget-server','./server.mjs'],['@/lib/qsse-budget-year-server','./year-server.mjs'],['@/lib/qsse-budget-years','./years.mjs'],['./qsse-budget-years','./years.mjs'],['./qsse-budget','./legacy.mjs']])s=s.replaceAll("'"+a+"'","'"+b+"'");fs.writeFileSync(path.join(dir,out),ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText)}
 compile('lib/qsse-budget.ts','legacy.mjs');compile('lib/qsse-budget-years.ts','years.mjs');compile('lib/qsse-budget-indicators.ts','indicators.mjs');compile('lib/qsse-budget-year-server.ts','year-server.mjs');compile('app/api/budget-qsse/years/route.ts','route.mjs');const api=await import(path.join(dir,'route.mjs'));
 const get=async year=>{const r=await api.GET(new Request('https://budget.test/api?year='+year));return {status:r.status,...await r.json()}};const post=b=>api.POST(new Request('https://budget.test/api',{method:'POST',headers:{origin:'https://budget.test'},body:JSON.stringify(b)}));
 if(process.env.QSSE_BUDGET_SOURCE){
  const imported=JSON.parse(fs.readFileSync(process.env.QSSE_BUDGET_SOURCE,'utf8'));
  for(const r of imported.records)db.prepare('INSERT INTO qsse_budget_data VALUES(?,?,1,?,?)').run(r.id,JSON.stringify(r),'now','manager');
  for(const [year,fields] of [[2025,{actual:'actual2025'}],[2026,{actual:'actual2026',budgetYtd:'budgetYtd2026',budget:'budget2026',forecast:'forecast2026'}],[2027,{budget:'budget2027'}]]){
   const result=await get(year);
   for(const section of ['2500','2600','4520'])for(const [annual,old] of Object.entries(fields)){
    const sum=result.records.filter(r=>r.kind==='account'&&r.section===section).reduce((s,r)=>s+(r[annual]??0),0);
    const expected=imported.records.filter(r=>r.kind==='account'&&r.section===section).reduce((s,r)=>s+(r[old]??0),0);assert.ok(Math.abs(sum-expected)<.001,`${year} ${section} ${annual}`);
   }
  }
  db.exec('DELETE FROM qsse_budget_annual;DELETE FROM qsse_budget_years;DELETE FROM qsse_budget_year_import;DELETE FROM qsse_budget_data;');console.log('All 18 original workbook section/period totals preserved across annual conversion.');
 }
 const legacy={id:'a',kind:'account',section:'2500',label:'EPI',account:'60226',category:'',date:'',reference:'',status:'Suivi',amount:null,actual2025:50,actual2026:60,budgetYtd2026:70,budget2026:120,forecast2026:130,budget2027:240,months:Array(12).fill(20),notes:'Original',source:'Excel',sheet:'2500',row:13,raw:{Q13:-240},revision:1};
 db.prepare('INSERT INTO qsse_budget_data VALUES(?,?,1,?,?)').run('a',JSON.stringify(legacy),'now','manager');db.prepare('INSERT INTO qsse_budget_data VALUES(?,?,1,?,?)').run('order',JSON.stringify({...legacy,id:'order',kind:'order',date:'2026-02-01',amount:10}),'now','manager');
 let y=await get(2027);assert.equal(y.records[0].budget,240);assert.deepEqual(y.records[0].months,Array(12).fill(20));assert.equal(y.records[0].actual,null);assert.equal(y.records[0].budgetState,'À prévoir');assert.equal(y.records.length,1);assert.equal((await get(2025)).records[0].actual,50);let six=await get(2026);assert.equal(six.records.find(r=>r.kind==='account').actual,60);assert.equal(six.records.find(r=>r.kind==='order').budgetState,'Engagé');assert.equal(six.years.find(y=>y.year===2026).as_of_month,7);assert.equal(six.records.filter(r=>r.kind==='order').length,1);
 const {summarizeBudget,monthlyBudget}=await import(path.join(dir,'indicators.mjs'));
 const account=six.records.find(r=>r.kind==='account'),order=six.records.find(r=>r.kind==='order');
 const indicators=summarizeBudget([account],[order,{...order,budgetState:'Réalisé',amount:900}]);
 assert.equal(indicators.available,50,'Only open commitments reduce available budget');
 assert.equal(indicators.variance,-10,'Compare cumulative actual against the same period');
 assert.equal(summarizeBudget([account],[{...order,amount:null}]).available,null);
 assert.equal(summarizeBudget([account],[{...order,section:'interim'}]).available,null,'An open order without a corresponding budget makes the balance incomplete');
 assert.equal(summarizeBudget([{...account,actual:null}],[]).variance,null);
 assert.equal(summarizeBudget([{...account,actual:0}],[]).available,120);
 const months=monthlyBudget([{...account,months:[0,...Array(11).fill(null)]}]);
 assert.deepEqual(months[0],{amount:0,missing:0});
 assert.deepEqual(months[1],{amount:null,missing:1});
 assert.equal(db.prepare('SELECT count(*) n FROM qsse_budget_annual').get().n,4);await get(2027);assert.equal(db.prepare('SELECT count(*) n FROM qsse_budget_annual').get().n,4,'Migration is idempotent');
 assert.equal((await post({action:'create-year',year:2028,fromYear:2027,copyAmounts:false})).status,200);let eight=await get(2028);assert.equal(eight.records.length,1);assert.equal(eight.records[0].budget,null);assert.equal(eight.records[0].actual,null);assert.equal(eight.records[0].budgetState,'À prévoir');assert.deepEqual(eight.records[0].months,Array(12).fill(null));
 assert.equal((await post({action:'create-year',year:2029,fromYear:2027,copyAmounts:true})).status,200);let nine=await get(2029);assert.equal(nine.records[0].budget,240);assert.equal(nine.records[0].actual,null);assert.equal(nine.records[0].forecast,null);
 assert.equal((await post({action:'create-year',year:2029})).status,409);assert.equal((await post({action:'create-year',year:2024,fromYear:2027})).status,400);
 let record={...eight.records[0],budget:360,months:Array(12).fill(30)};assert.equal((await post({action:'save',record})).status,200);assert.equal((await post({action:'save',record})).status,409);assert.equal((await get(2027)).records[0].budget,240,'Editing 2028 never changes 2027');
 record={...(await get(2028)).records[0],year:2029};assert.equal((await post({action:'save',record})).status,400);record={...eight.records[0],id:'new-order',revision:0,kind:'order',date:'2027-12-31',amount:5};assert.equal((await post({action:'save',record})).status,400);record.date='2028-02-29';assert.equal((await post({action:'save',record})).status,200);record={...record,id:'invalid-state',revision:0,budgetState:'Inconnu'};assert.equal((await post({action:'save',record})).status,400);record={...record,id:'invalid-day',revision:0,budgetState:'À prévoir',date:'2028-02-30'};assert.equal((await post({action:'save',record})).status,400);
 assert.equal((await post({action:'period',year:2028,month:6,expectedMonth:12})).status,200);assert.equal((await post({action:'period',year:2028,month:7,expectedMonth:12})).status,409);
 globalThis.yearAccess={read:true,write:false};assert.equal((await post({action:'create-year',year:2030})).status,403);assert.equal((await get(2028)).status,200);globalThis.yearAccess={read:false,write:false};assert.equal((await get(2028)).status,403);globalThis.yearAccess={read:true,write:true};
 globalThis.yearFault=true;const log=console.error;console.error=()=>{};assert.equal((await post({action:'create-year',year:2030,fromYear:2029})).status,503);console.error=log;globalThis.yearFault=false;assert.equal(db.prepare('SELECT year FROM qsse_budget_years WHERE year=2030').get(),undefined);
 assert.equal((await get('bad')).status,400);assert.ok(db.prepare('SELECT count(*) n FROM qsse_budget_history').get().n>=5);console.log('Budget exercises: legacy preservation, 2027 monthly plan, annual isolation, rollover with/without amounts, no copied actuals/orders, invalid dates, role gates, optimistic writes, period audit, duplicates and rollback passed.');
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});delete globalThis.yearDb;delete globalThis.yearAccess;delete globalThis.yearFault}

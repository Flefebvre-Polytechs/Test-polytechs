import {database} from '@/db/raw';
import type {BudgetRecord} from './qsse-budget';
import type {AnnualBudget} from './qsse-budget-years';
// Run once after legacy Excel integration (including a restored pre-exercise backup).
export async function ensureBudgetYears(){const db=database();if(await db.prepare('SELECT id FROM qsse_budget_year_import WHERE id=1').first())return;
 const imported=await db.prepare('SELECT id FROM qsse_budget_import WHERE id=1').first();const old=(await db.prepare('SELECT * FROM qsse_budget_data').all()).results as {id:string;data:string;revision:number;updated_at:string;updated_by:string}[];
 if(!imported&&!old.length)return;
 const now=new Date().toISOString(),statements=[db.prepare('INSERT OR IGNORE INTO qsse_budget_years VALUES(2025,12,?)').bind(now),db.prepare('INSERT OR IGNORE INTO qsse_budget_years VALUES(2026,7,?)').bind(now),db.prepare('INSERT OR IGNORE INTO qsse_budget_years VALUES(2027,12,?)').bind(now)];
 for(const row of old){const r=JSON.parse(row.data) as BudgetRecord;
  for(const year of r.kind==='account'?[2025,2026,2027]:[2026]){const a:AnnualBudget={id:r.id+'@'+year,year,kind:r.kind,section:r.section,label:r.label,account:r.account,category:r.category,date:year===2026?r.date:'',reference:r.reference,status:r.status,budgetState:r.kind==='order'?'Engagé':'À prévoir',amount:r.kind==='order'?r.amount:null,actual:year===2025?r.actual2025:year===2026?r.actual2026:null,budgetYtd:year===2026?r.budgetYtd2026:null,budget:year===2026?r.budget2026:year===2027?r.budget2027:null,forecast:year===2026?r.forecast2026:null,months:year===2027?r.months:Array(12).fill(null),notes:r.notes,source:r.source,sheet:r.sheet,row:r.row,raw:r.raw,revision:1};statements.push(db.prepare('INSERT OR IGNORE INTO qsse_budget_annual VALUES(?,?,?,1,?,?)').bind(a.id,year,JSON.stringify(a),row.updated_at,row.updated_by))}
 }
 statements.push(db.prepare('INSERT OR IGNORE INTO qsse_budget_year_import VALUES(1)'));await db.batch(statements);
}

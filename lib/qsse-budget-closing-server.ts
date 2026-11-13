import {database} from '@/db/raw';
import {validClosingLine} from './qsse-budget-controls';
import {validBudgetYear} from './qsse-budget-years';

export async function saveBudgetClosing(body: Record<string, unknown>, actor: string) {
  const {year, month, expectedMonth, lines} = body;
  const validMonth = (n: unknown) => Number.isInteger(n) && Number(n) >= 1 && Number(n) <= 12;
  if (!validBudgetYear(year) || !validMonth(month) || !validMonth(expectedMonth) ||
      !Array.isArray(lines) || lines.length < 1 || lines.length > 1000 || !lines.every(validClosingLine) ||
      new Set(lines.map(line => line.id)).size !== lines.length) {
    return {status: 400, error: 'Arrêté incomplet ou invalide.'};
  }

  const db = database();
  const eventId = crypto.randomUUID();
  const now = new Date().toISOString();
  const payload = JSON.stringify(lines);
  const accounts = "year=? AND json_extract(data,'$.kind')='account'";
  const changes = "json_set(a.data,'$.actual',json_extract(j.value,'$.actual'),'$.budgetYtd',json_extract(j.value,'$.budgetYtd'),'$.revision',a.revision+1)";
  const eventExists = 'EXISTS (SELECT 1 FROM qsse_budget_history WHERE id=?)';

  const [result] = await db.batch([
    // Require the exact set of account IDs and revisions before modifying anything.
    db.prepare(`UPDATE qsse_budget_years SET as_of_month=?
      WHERE year=? AND as_of_month=?
      AND (SELECT count(*) FROM qsse_budget_annual WHERE ${accounts})=?
      AND NOT EXISTS (
        SELECT 1 FROM json_each(?) AS j
        WHERE NOT EXISTS (
          SELECT 1 FROM qsse_budget_annual WHERE ${accounts}
          AND id=json_extract(j.value,'$.id') AND revision=json_extract(j.value,'$.revision')
        )
      )`).bind(month,year,expectedMonth,year,lines.length,payload,year),
    db.prepare('INSERT INTO qsse_budget_history SELECT ?,?,?,?,? WHERE changes()=1')
      .bind(eventId,'year-'+year,JSON.stringify({action:'closing',before:expectedMonth,after:month,count:lines.length}),now,actor),
    db.prepare(`INSERT INTO qsse_budget_history
      SELECT lower(hex(randomblob(16))),a.id,
        json_object('before',json(a.data),'after',json(${changes}),'closingEvent',?),
        ?,?
      FROM qsse_budget_annual AS a JOIN json_each(?) AS j ON a.id=json_extract(j.value,'$.id')
      WHERE ${eventExists}`).bind(eventId,now,actor,payload,eventId),
    db.prepare(`UPDATE qsse_budget_annual AS a
      SET data=${changes}, revision=a.revision+1, updated_at=?, updated_by=?
      FROM json_each(?) AS j WHERE a.id=json_extract(j.value,'$.id') AND ${eventExists}`)
      .bind(now,actor,payload,eventId),
  ]);
  return result.meta.changes ? {status:200} : {status:409,error:'Les postes ou l’arrêté ont changé. Actualisez puis recommencez.'};
}

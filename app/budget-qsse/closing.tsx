import {useState} from 'react';
import {budgetSections} from '@/lib/qsse-budget';
import type {ClosingLine} from '@/lib/qsse-budget-controls';
import type {AnnualBudget} from '@/lib/qsse-budget-years';

type Props = {
  accounts: AnnualBudget[];
  year: number;
  period: number;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSave: (month: number, lines: ClosingLine[]) => Promise<void>;
};

export function BudgetClosing({accounts,year,period,busy,error,onCancel,onSave}: Props) {
  const [month,setMonth] = useState(period);
  const [values,setValues] = useState<Record<string,{actual:string;budgetYtd:string}>>({});
  const ready = accounts.length > 0 && accounts.every(row => values[row.id]?.actual && values[row.id]?.budgetYtd);

  return <form onSubmit={event=>{
    event.preventDefault();
    if (!ready || busy) return;
    void onSave(month,accounts.map(row=>({
      id:row.id,revision:row.revision,actual:Number(values[row.id].actual),budgetYtd:Number(values[row.id].budgetYtd),
    })));
  }}>
    <label className="budget-closing-month">Mois d’arrêté<select value={month} disabled={busy} onChange={event=>{setMonth(Number(event.target.value));setValues({})}}>
      {Array.from({length:12},(_,index)=><option key={index} value={index+1}>{new Date(year,index,1).toLocaleDateString('fr-FR',{month:'long'})}</option>)}
    </select></label>
    {month===period&&<button type="button" className="outline" disabled={busy} onClick={()=>setValues(Object.fromEntries(accounts.map(row=>[row.id,{
      actual:row.actual===null?'':String(row.actual),budgetYtd:row.budgetYtd===null?'':String(row.budgetYtd),
    }])))}>Reprendre les cumuls de ce mois</button>}
    <div className="budget-table-wrap budget-closing-lines" tabIndex={0} aria-label="Montants de l’arrêté">
      <table className="budget-table"><thead><tr><th scope="col">Poste</th><th scope="col">Réalisé cumulé (€)</th><th scope="col">Budget cumulé (€)</th></tr></thead>
        <tbody>{accounts.map(row=><tr key={row.id}>
          <th scope="row">{row.label}<small>{budgetSections[row.section]} {row.account}</small></th>
          {(['actual','budgetYtd'] as const).map(key=><td key={key}><input type="number" step=".01" min="-10000000000" max="10000000000" required disabled={busy}
            aria-label={(key==='actual'?'Réalisé cumulé':'Budget cumulé')+' · '+row.label}
            placeholder={month===period&&row[key]!==null?String(row[key]):undefined}
            value={values[row.id]?.[key]??''}
            onChange={event=>{const value=event.target.value;setValues(current=>({...current,[row.id]:{...(current[row.id]??{actual:'',budgetYtd:''}),[key]:value}}))}}
          /></td>)}
        </tr>)}</tbody>
      </table>
    </div>
    {error&&<p className="budget-error" role="alert">{error}</p>}
    <footer><button type="button" className="outline" disabled={busy} onClick={onCancel}>Annuler</button>
      <button type="submit" className="primary" disabled={!ready||busy}>{busy?'Enregistrement…':'Valider l’arrêté'}</button></footer>
  </form>;
}

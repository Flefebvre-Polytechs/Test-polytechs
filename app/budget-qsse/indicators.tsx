import { ArrowUpRight, CalendarRange, ChartNoAxesCombined } from 'lucide-react';
import { budgetSections, budgetSectionDetails, budgetStates, type BudgetSection, type BudgetState } from '@/lib/qsse-budget';
import { monthlyBudget, summarizeBudget } from '@/lib/qsse-budget-indicators';
import type { AnnualBudget } from '@/lib/qsse-budget-years';

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
export const budgetMoney = (amount: number | null) => amount === null ? 'Non renseigné' : euros.format(amount);
const monthLabel = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString('fr-FR', {month: 'long'});

type Props = {
  year: number;
  period: number;
  section: string;
  accounts: AnnualBudget[];
  orders: AnnualBudget[];
  onOrders: (state: BudgetState) => void;
  onSection: (section: BudgetSection) => void;
};

export function BudgetIndicators({year, period, section, accounts, orders, onOrders, onSection}: Props) {
  if (!accounts.length && !orders.length) return <section className="budget-register budget-empty">
    Aucun poste budgétaire ni commande active pour cette sélection.
  </section>;

  const summary = summarizeBudget(accounts, orders);
  const months = monthlyBudget(accounts);
  const maximum = Math.max(1, ...months.map(month => Math.abs(month.amount ?? 0)));
  const cards = [
    {label: 'Budget annuel', ...summary.budget, detail: 'Enveloppe de l’exercice'},
    {label: 'Réalisé comptable', ...summary.actual, detail: 'Arrêté à ' + monthLabel(year, period - 1)},
    {label: 'Engagements ouverts', amount: summary.committed, missing: summary.stages.Engagé.missing, detail: 'Commandes au statut Engagé'},
    {label: 'Reste disponible', amount: summary.available, missing: 0, detail: summary.available === null ? 'Données à compléter' : 'Budget annuel − réalisé − engagé'},
  ];
  const sections = (Object.keys(budgetSections) as BudgetSection[]).filter(key =>
    accounts.some(row => row.section === key) || orders.some(row => row.section === key)
  );

  return <div className="budget-indicators">
    <section className="budget-kpis" aria-label="Indicateurs de l’exercice">
      {cards.map(card => <article key={card.label} className={card.label==='Reste disponible' && card.amount!==null && card.amount<0 ? 'budget-negative' : undefined}>
        <span>{card.label}</span><strong>{budgetMoney(card.amount)}</strong>
        <small>{card.missing ? card.missing + ' montant(s) manquant(s) · total partiel' : card.detail}</small>
      </article>)}
    </section>
    <section className="budget-register">
      <div className="budget-register-head"><div>
        <h2><ChartNoAxesCombined size={20}/> Suivi par rubrique</h2>
        <p>Écart à {monthLabel(year, period - 1)} = réalisé comptable − budget de la même période. Un écart positif signale un dépassement.</p>
      </div></div>
      <div className="budget-table-wrap" tabIndex={0} aria-label="Comparaison par rubrique">
        <table className="budget-table budget-indicator-table">
          <thead><tr><th scope="col">Rubrique</th><th scope="col">Budget annuel</th><th scope="col">Budget cumulé</th><th scope="col">Réalisé</th><th scope="col">Écart cumulé</th><th scope="col">Prévisionnel annuel</th><th scope="col">Reste disponible</th></tr></thead>
          <tbody>{sections.map(key => {
            const result = summarizeBudget(accounts.filter(row=>row.section===key), orders.filter(row=>row.section===key));
            return <tr key={key}><th scope="row"><button className="outline" onClick={()=>onSection(key)}>{key==='2600'?'Environnement · '+budgetSectionDetails[key]:budgetSectionDetails[key]} <ArrowUpRight size={15}/></button></th>
              {[result.budget,result.budgetYtd,result.actual].map((total,index)=><td key={index}>{budgetMoney(total.amount)}{total.missing>0&&<small>{total.missing} manquant(s)</small>}</td>)}
              <td className={result.variance!==null && result.variance>0?'budget-indicator-over':undefined}>{result.variance!==null && result.variance>0?'+':''}{budgetMoney(result.variance)}</td>
              <td>{budgetMoney(result.forecast.amount)}{result.forecast.missing>0&&<small>{result.forecast.missing} manquant(s)</small>}</td>
              <td className={result.available!==null && result.available<0?'budget-indicator-over':undefined}>{budgetMoney(result.available)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
    <div className="budget-indicator-panels">
      <section className="budget-register">
        <div className="budget-register-head"><div><h2>Avancement des commandes</h2><p>Ouvrir un statut pour consulter ses lignes{section?' dans la rubrique sélectionnée':''}.</p></div></div>
        <div className="budget-stage-cards">{budgetStates.map(state => {
          const total = summary.stages[state];
          return <button key={state} type="button" data-state={state} onClick={()=>onOrders(state)}>
            <span>{state} <ArrowUpRight size={14}/></span>
            <strong>{budgetMoney(total.count ? total.amount : 0)}</strong>
            <small>{total.count} commande(s){total.missing ? ' · ' + total.missing + ' montant(s) manquant(s)' : ''}</small>
          </button>;
        })}</div>
        <p className="budget-context">Le réalisé comptable sert au calcul du reste disponible. Les commandes déjà réalisées figurent dans leur propre statut.</p>
      </section>
      <section className="budget-register">
        <div className="budget-register-head"><div><h2><CalendarRange size={20}/> Budget mensualisé</h2><p>Répartition prévisionnelle de l’enveloppe annuelle.</p></div></div>
        {months.every(month=>month.amount===null) ? <p className="budget-empty">Aucun montant mensualisé.</p> :
          <ul className="budget-months">{months.map((month,index) => <li key={index}>
            <span>{monthLabel(year,index)}</span>
            <span className="budget-month-track" aria-hidden="true"><i className={(month.amount??0)<0?'negative':undefined} style={{width: 100 * Math.abs(month.amount ?? 0) / maximum + '%'}}/></span>
            <span>{budgetMoney(month.amount)}{month.amount!==null && month.missing>0 && <small>Partiel</small>}</span>
          </li>)}</ul>}
      </section>
    </div>
  </div>;
}

import { budgetStates, type BudgetState } from './qsse-budget';
import { annualTotal, type AnnualBudget } from './qsse-budget-years';

const round = (amount: number) => Math.round(amount * 100) / 100;

export function summarizeBudget(accounts: AnnualBudget[], orders: AnnualBudget[]) {
  const budget = annualTotal(accounts, 'budget');
  const actual = annualTotal(accounts, 'actual');
  const budgetYtd = annualTotal(accounts, 'budgetYtd');
  const forecast = annualTotal(accounts, 'forecast');
  const stages = Object.fromEntries(budgetStates.map(state => {
    const rows = orders.filter(row => row.budgetState === state);
    return [state, { ...annualTotal(rows, 'amount'), count: rows.length }];
  })) as Record<BudgetState, ReturnType<typeof annualTotal> & {count: number}>;
  const engaged = stages['Engagé'];
  const committed = engaged.count === 0 ? 0 : engaged.amount;
  const complete = (total: ReturnType<typeof annualTotal>) => total.amount !== null && total.missing === 0;
  const coveredSections = new Set(accounts.map(row => row.section));
  const uncoveredEngagements = orders.some(row => row.budgetState === 'Engagé' && !coveredSections.has(row.section));
  const available = complete(budget) && complete(actual) && !engaged.missing && !uncoveredEngagements
    ? round(budget.amount! - actual.amount! - (committed ?? 0))
    : null;
  const variance = complete(budgetYtd) && complete(actual)
    ? round(actual.amount! - budgetYtd.amount!)
    : null;
  return { budget, actual, budgetYtd, forecast, stages, committed, available, variance };
}

export function monthlyBudget(accounts: AnnualBudget[]) {
  return Array.from({ length: 12 }, (_, month) => {
    const known = accounts.flatMap(row => row.months[month] === null ? [] : [row.months[month]!]);
    return {
      amount: known.length ? round(known.reduce((sum, amount) => sum + amount, 0)) : null,
      missing: accounts.length - known.length,
    };
  });
}

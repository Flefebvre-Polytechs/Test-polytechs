import { budgetStates, type BudgetState } from './qsse-budget';
import { annualTotal, type AnnualBudget } from './qsse-budget-years';

import {needsBudgetReview} from './qsse-budget-controls';

const round = (amount: number) => Math.round(amount * 100) / 100;

export function summarizeBudget(accounts: AnnualBudget[], orders: AnnualBudget[]) {
  const budget = annualTotal(accounts, 'budget');
  const actual = annualTotal(accounts, 'actual');
  const budgetYtd = annualTotal(accounts, 'budgetYtd');
  const forecast = annualTotal(accounts, 'forecast');
  const review = orders.filter(needsBudgetReview);
  const reviewedOrders = orders.filter(order => !needsBudgetReview(order));
  const stages = Object.fromEntries(budgetStates.map(state => {
    const rows = reviewedOrders.filter(row => row.budgetState === state);
    return [state, { ...annualTotal(rows, 'amount'), count: rows.length }];
  })) as Record<BudgetState, ReturnType<typeof annualTotal> & {count: number}>;
  const engaged = stages['Engagé'];
  const committed = engaged.count === 0 ? 0 : engaged.amount;
  const complete = (total: ReturnType<typeof annualTotal>) => total.amount !== null && total.missing === 0;
  const coveredSections = new Set(accounts.map(row => row.section));
  const uncoveredEngagements = reviewedOrders.some(row => row.budgetState === 'Engagé' && !coveredSections.has(row.section));
  const blockers = [
    ...(!complete(budget) ? ['Budget annuel incomplet'] : []),
    ...(!complete(actual) ? ['Réalisé comptable incomplet'] : []),
    ...(review.length ? [review.length + ' commande(s) à rapprocher'] : []),
    ...(engaged.missing ? [engaged.missing + ' engagement(s) sans montant'] : []),
    ...(uncoveredEngagements ? ['Engagements sans enveloppe dans leur rubrique'] : []),
  ];
  const available = blockers.length === 0
    ? round(budget.amount! - actual.amount! - (committed ?? 0))
    : null;
  const variance = complete(budgetYtd) && complete(actual)
    ? round(actual.amount! - budgetYtd.amount!)
    : null;
  return { budget, actual, budgetYtd, forecast, stages, committed, available, variance, review, blockers };
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

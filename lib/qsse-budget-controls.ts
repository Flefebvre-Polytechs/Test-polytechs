import type {AnnualBudget} from './qsse-budget-years';

// Imported orders start as engaged. An explicit review is required before
// treating that default as an open commitment.
export function needsBudgetReview(record: AnnualBudget) {
  return record.kind === 'order' && record.budgetState === 'Engagé' &&
    !record.reconciledAt && !!record.sheet && record.row > 0 &&
    isActiveBudgetOrder(record);
}

export function isActiveBudgetOrder(record: AnnualBudget) {
  return record.kind === 'order' && record.status !== 'Annulée' && record.status !== 'Non validée';
}

export type ClosingLine = {id: string; revision: number; actual: number; budgetYtd: number};

export function validClosingLine(value: unknown): value is ClosingLine {
  if (!value || typeof value !== 'object') return false;
  const line = value as ClosingLine;
  return typeof line.id === 'string' && line.id.length > 0 && line.id.length <= 500 &&
    Number.isSafeInteger(line.revision) && line.revision > 0 &&
    [line.actual, line.budgetYtd].every(amount => typeof amount === 'number' &&
      Number.isFinite(amount) && Math.abs(amount) <= 1e10);
}

import { FinancialConfig, FinancialMonth } from '../domain/financial/financial.types';
import { CycleRecord, isLive, LocalState } from './state';

export function selectConfig(state: LocalState): FinancialConfig | null {
  if (!state.settings || !isLive(state.settings)) {
    return null;
  }

  const { monthlyIncome, savingGoal, payday, customCategories, updatedAt } = state.settings;

  return {
    monthlyIncome,
    savingGoal,
    payday,
    customCategories,
    updatedAt,
    fixedExpenses: state.fixedExpenses.filter(isLive),
  };
}

export function toFinancialMonth(state: LocalState, cycle: CycleRecord): FinancialMonth {
  return {
    ...cycle,
    expenses: state.expenses.filter((expense) => isLive(expense) && expense.cycleId === cycle.id),
  };
}

export function selectActiveCycle(state: LocalState): CycleRecord | null {
  return (
    state.cycles
      .filter((cycle) => isLive(cycle) && cycle.status === 'active')
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null
  );
}

export function selectActiveMonth(state: LocalState): FinancialMonth | null {
  const cycle = selectActiveCycle(state);

  return cycle ? toFinancialMonth(state, cycle) : null;
}

/** Ciclos fechados, do mais recente para o mais antigo. */
export function selectClosedMonths(state: LocalState): FinancialMonth[] {
  return state.cycles
    .filter((cycle) => isLive(cycle) && cycle.status === 'closed')
    .sort((left, right) => right.endDate.localeCompare(left.endDate))
    .map((cycle) => toFinancialMonth(state, cycle));
}

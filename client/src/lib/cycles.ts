import { parseISO } from 'date-fns';

import {
  CycleSpending,
  selectClosedMonths,
  selectCycleExtraIncomes,
  selectCyclePayments,
  selectCycleSpending,
  toFinancialMonth,
} from '@manager-money/core/application/selectors';
import { isLive, LocalState } from '@manager-money/core/application/state';
import { cycleKeyFromStartDate } from '@manager-money/core/domain/financial/credit-card';
import {
  calculateDayBalance,
  calculateTodaySpent,
  calculateTotalSpent,
} from '@manager-money/core/domain/financial/financial.calculations';
import {
  Expense,
  FinancialMonth,
  MoneyCents,
} from '@manager-money/core/domain/financial/financial.types';

export type ClosedCycleRow = {
  id: string;
  startDate: string;
  endDate: string;
  year: string;
  finalBalance: MoneyCents;
  initialAvailableAmount: MoneyCents;
  totalSpent: MoneyCents;
  expenseCount: number;
};

/** Ciclos fechados (mais recente primeiro), com o resultado gravado no fechamento (BR-FIN-005). */
export function buildClosedCycles(state: LocalState): ClosedCycleRow[] {
  return selectClosedMonths(state).map((month) => ({
    id: month.id,
    startDate: month.startDate,
    endDate: month.endDate,
    year: month.startDate.slice(0, 4),
    finalBalance: month.finalBalance ?? 0,
    initialAvailableAmount: month.initialAvailableAmount,
    totalSpent: calculateTotalSpent(month.expenses),
    expenseCount: month.expenses.length,
  }));
}

export type DayRow = {
  date: string;
  expenses: Expense[];
  total: MoneyCents;
  /** Saldo do dia (limite previsto − gasto), igual ao histórico diário do app. */
  balance: MoneyCents;
};

export type CycleDetail = {
  month: FinancialMonth;
  days: DayRow[];
  totalSpent: MoneyCents;
  fixedPayments: ReturnType<typeof selectCyclePayments>;
  extraIncomes: ReturnType<typeof selectCycleExtraIncomes>;
  spending: CycleSpending;
};

export function buildCycleDetail(
  state: LocalState,
  cycleId: string,
  now: Date,
): CycleDetail | null {
  const cycle = state.cycles.find((record) => record.id === cycleId && isLive(record));
  if (!cycle) return null;

  const month = toFinancialMonth(state, cycle);
  const grouped = month.expenses.reduce<Record<string, Expense[]>>((result, expense) => {
    result[expense.date] = [...(result[expense.date] ?? []), expense];
    return result;
  }, {});

  return {
    month,
    days: Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, expenses]) => ({
        date,
        expenses,
        total: calculateTodaySpent(expenses, parseISO(date)),
        balance: calculateDayBalance(month, parseISO(date)),
      })),
    totalSpent: calculateTotalSpent(month.expenses),
    fixedPayments: selectCyclePayments(state, cycle.id),
    extraIncomes: selectCycleExtraIncomes(state, cycle.id),
    spending: selectCycleSpending(state, cycleKeyFromStartDate(cycle.startDate), now),
  };
}

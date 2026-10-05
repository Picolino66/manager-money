import {
  BalanceDailyPoint,
  listSeriesDates,
  selectBalanceDailySeries,
} from '@manager-money/core/application/credit-series';
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
import { calculateTotalSpent } from '@manager-money/core/domain/financial/financial.calculations';
import { FinancialMonth, MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { toISODate } from '@manager-money/core/utils/date';

export type ClosedCycleRow = {
  id: string;
  startDate: string;
  endDate: string;
  year: string;
  finalBalance: MoneyCents;
  initialAvailableAmount: MoneyCents;
  /** Gasto no saldo (à vista) do ciclo. */
  totalSpent: MoneyCents;
  expenseCount: number;
  /** Faturas que venceram no ciclo (o crédito que pesou nele, BR-FIN-025/039). */
  cardTotal: MoneyCents;
};

/** Ciclos fechados (mais recente primeiro), com o resultado gravado no fechamento (BR-FIN-005). */
export function buildClosedCycles(state: LocalState, now: Date = new Date()): ClosedCycleRow[] {
  return selectClosedMonths(state).map((month) => ({
    id: month.id,
    startDate: month.startDate,
    endDate: month.endDate,
    year: month.startDate.slice(0, 4),
    finalBalance: month.finalBalance ?? 0,
    initialAvailableAmount: month.initialAvailableAmount,
    totalSpent: calculateTotalSpent(month.expenses),
    expenseCount: month.expenses.length,
    cardTotal: selectCycleSpending(state, cycleKeyFromStartDate(month.startDate), now).cardTotal,
  }));
}

export type CycleDetail = {
  month: FinancialMonth;
  /** Saldo dia a dia do ciclo (mesmo gráfico da visão geral); dias depois de hoje ficam vazios. */
  daily: BalanceDailyPoint[];
  totalSpent: MoneyCents;
  fixedPayments: ReturnType<typeof selectCyclePayments>;
  extraIncomes: ReturnType<typeof selectCycleExtraIncomes>;
  spending: CycleSpending;
};

/**
 * Detalhe do ciclo: resumo, saldo dia a dia, fixas, rendas e faturas. Os lançamentos ficam no
 * Histórico, filtrado pelo ciclo (ADR-024).
 */
export function buildCycleDetail(
  state: LocalState,
  cycleId: string,
  now: Date,
): CycleDetail | null {
  const cycle = state.cycles.find((record) => record.id === cycleId && isLive(record));
  if (!cycle) return null;

  const month = toFinancialMonth(state, cycle);

  return {
    month,
    daily: selectBalanceDailySeries(
      state,
      listSeriesDates(month.startDate, month.endDate),
      toISODate(now),
    ),
    totalSpent: calculateTotalSpent(month.expenses),
    fixedPayments: selectCyclePayments(state, cycle.id),
    extraIncomes: selectCycleExtraIncomes(state, cycle.id),
    spending: selectCycleSpending(state, cycleKeyFromStartDate(cycle.startDate), now),
  };
}

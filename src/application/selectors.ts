import {
  cycleKeyFromStartDate,
  calculateCardChargesForCycle,
  calculateCardInstallmentsForCycle,
  CardInstallment,
} from '../domain/financial/credit-card';
import { CycleAdjustments } from '../domain/financial/financial.calculations';
import { FinancialConfig, FinancialMonth, MoneyCents } from '../domain/financial/financial.types';
import {
  calculateExtraIncomeTotal,
  calculatePaidFixedAmount,
} from '../domain/financial/payments';
import { CycleRecord, ExtraIncomeRecord, FixedPaymentRecord, isLive, LocalState } from './state';

export function selectConfig(state: LocalState): FinancialConfig | null {
  if (!state.settings || !isLive(state.settings)) {
    return null;
  }

  const { monthlyIncome, incomeSources, savingGoal, payday, customCategories, updatedAt } = state.settings;

  return {
    monthlyIncome,
    incomeSources,
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

/** Parcelas de cartão que caem no ciclo (BR-FIN-019). */
export function selectCardInstallments(state: LocalState, cycleKey: string): CardInstallment[] {
  return calculateCardInstallmentsForCycle(state.cardPurchases.filter(isLive), cycleKey);
}

export function selectCardCharges(state: LocalState, cycleKey: string): MoneyCents {
  return calculateCardChargesForCycle(state.cardPurchases.filter(isLive), cycleKey);
}

export function selectCyclePayments(state: LocalState, cycleId: string): FixedPaymentRecord[] {
  return state.fixedPayments.filter((payment) => isLive(payment) && payment.cycleId === cycleId);
}

export function selectCycleExtraIncomes(state: LocalState, cycleId: string): ExtraIncomeRecord[] {
  return state.extraIncomes.filter((income) => isLive(income) && income.cycleId === cycleId);
}

/** Ajustes do saldo do ciclo: parcelas de cartão, rendas avulsas e fixas pagas à vista. */
export function selectCycleAdjustments(
  state: LocalState,
  cycle: Pick<CycleRecord, 'id' | 'startDate'>,
): Required<CycleAdjustments> {
  return {
    cardCharges: selectCardCharges(state, cycleKeyFromStartDate(cycle.startDate)),
    extraIncome: calculateExtraIncomeTotal(selectCycleExtraIncomes(state, cycle.id)),
    paidFixedExpenses: calculatePaidFixedAmount(selectCyclePayments(state, cycle.id)),
  };
}

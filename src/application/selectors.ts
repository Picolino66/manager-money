import { parseISO, startOfDay } from 'date-fns';

import {
  buildCardStatements,
  calculateCardChargesForCycle,
  calculateCardInstallmentsForCycle,
  calculateCardLimitUsage,
  calculateStatementInterest,
  CardInstallment,
  CardLimitUsage,
  CardStatement,
  cycleKeyFromStartDate,
} from '../domain/financial/credit-card';
import {
  calculateDefaultCycleStartDate,
  calculateFixedExpenseAmount,
  CycleAdjustments,
} from '../domain/financial/financial.calculations';
import {
  FinancialConfig,
  FinancialMonth,
  FixedExpense,
  isActive,
  MoneyCents,
} from '../domain/financial/financial.types';
import { calculateExtraIncomeTotal, calculatePaidFixedAmount } from '../domain/financial/payments';
import { CycleProjection, projectCycles } from '../domain/financial/projection';
import { toISODate } from '../utils/date';
import {
  CreditCardRecord,
  CycleRecord,
  ExtraIncomeRecord,
  FixedPaymentRecord,
  isLive,
  LocalState,
  StatementPaymentRecord,
} from './state';

export function selectConfig(state: LocalState): FinancialConfig | null {
  if (!state.settings || !isLive(state.settings)) {
    return null;
  }

  const { monthlyIncome, incomeSources, savingGoal, payday, customCategories, updatedAt } =
    state.settings;

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

export function selectStatementPayments(state: LocalState): StatementPaymentRecord[] {
  return state.statementPayments.filter(isLive);
}

/** Juros de faturas pagas com atraso durante o ciclo (BR-FIN-026). */
export function selectCycleStatementInterest(state: LocalState, cycleId: string): MoneyCents {
  return selectStatementPayments(state)
    .filter((payment) => payment.cycleId === cycleId)
    .reduce((total, payment) => total + calculateStatementInterest(payment), 0);
}

/** Ajustes do saldo do ciclo: parcelas de cartão, rendas avulsas, fixas pagas à vista e juros. */
export function selectCycleAdjustments(
  state: LocalState,
  cycle: Pick<CycleRecord, 'id' | 'startDate'>,
): Required<CycleAdjustments> {
  return {
    cardCharges: selectCardCharges(state, cycleKeyFromStartDate(cycle.startDate)),
    extraIncome: calculateExtraIncomeTotal(selectCycleExtraIncomes(state, cycle.id)),
    paidFixedExpenses: calculatePaidFixedAmount(selectCyclePayments(state, cycle.id)),
    pendingFixedExpenses: selectPendingFixedExpenses(state, cycle.id).reduce(
      (total, expense) => total + calculateFixedExpenseAmount(expense),
      0,
    ),
    statementInterest: selectCycleStatementInterest(state, cycle.id),
  };
}

/** Despesas fixas vivas, ativas e com valor no ciclo, sem pagamento vigente (BR-FIN-004/021). */
export function selectPendingFixedExpenses(state: LocalState, cycleId: string): FixedExpense[] {
  const paid = new Set(
    selectCyclePayments(state, cycleId).map((payment) => payment.fixedExpenseId),
  );

  return state.fixedExpenses.filter(
    (expense) =>
      isLive(expense) &&
      isActive(expense) &&
      !paid.has(expense.id) &&
      calculateFixedExpenseAmount(expense) > 0,
  );
}

// ---------------------------------------------------------------------------
// Cartões, faturas e limite (BR-FIN-025, BR-FIN-026)
// ---------------------------------------------------------------------------

export function selectCreditCards(state: LocalState): CreditCardRecord[] {
  return state.creditCards.filter(isLive);
}

/** Cartões que aceitam compras novas (vivos e ativos). */
export function selectActiveCreditCards(state: LocalState): CreditCardRecord[] {
  return selectCreditCards(state).filter(isActive);
}

/** Faturas do cartão com parcelas em aberto, em ordem de fechamento. */
export function selectCardStatements(
  state: LocalState,
  cardId: string,
  today: Date,
): CardStatement[] {
  const card = selectCreditCards(state).find((record) => record.id === cardId);

  return card
    ? buildCardStatements(
        card,
        state.cardPurchases.filter(isLive),
        selectStatementPayments(state),
        today,
      )
    : [];
}

export function selectCardLimitUsage(state: LocalState, cardId: string): CardLimitUsage | null {
  const card = selectCreditCards(state).find((record) => record.id === cardId);

  return card
    ? calculateCardLimitUsage(
        card,
        state.cardPurchases.filter(isLive),
        selectStatementPayments(state),
      )
    : null;
}

// ---------------------------------------------------------------------------
// Compromissos e projeção (BR-FIN-031)
// ---------------------------------------------------------------------------

export type UpcomingCommitment =
  | {
      kind: 'statement';
      id: string;
      label: string;
      amount: MoneyCents;
      dueDate: string;
      overdue: boolean;
    }
  | { kind: 'fixed'; id: string; label: string; amount: MoneyCents };

/**
 * Compromissos que ainda vão sair: faturas não pagas que já fecharam ou vencem até o fim do ciclo
 * ativo, e despesas fixas ativas ainda pendentes no ciclo. Ordem: faturas por vencimento, depois fixas.
 */
export function selectUpcomingCommitments(state: LocalState, today: Date): UpcomingCommitment[] {
  const cycle = selectActiveCycle(state);
  const horizon = cycle ? startOfDay(parseISO(cycle.endDate)) : startOfDay(today);
  const statements = selectCreditCards(state).flatMap((card) =>
    selectCardStatements(state, card.id, today)
      .filter(
        (statement) =>
          statement.status !== 'paid' &&
          (statement.status !== 'open' || startOfDay(parseISO(statement.dueDate)) <= horizon),
      )
      .map((statement) => ({
        kind: 'statement' as const,
        id: `${card.id}:${statement.key}`,
        label: `Fatura ${card.name}`,
        amount: statement.amount,
        dueDate: statement.dueDate,
        overdue: statement.status === 'overdue',
      })),
  );
  const fixed: UpcomingCommitment[] = cycle
    ? selectPendingFixedExpenses(state, cycle.id)
        .map((expense) => ({
          kind: 'fixed' as const,
          id: expense.id,
          label: expense.name,
          amount: calculateFixedExpenseAmount(expense),
        }))
        .filter((item) => item.amount > 0)
    : [];

  return [...statements.sort((left, right) => left.dueDate.localeCompare(right.dueDate)), ...fixed];
}

/** Projeção dos próximos ciclos a partir do ativo (ou do próximo a abrir). */
export function selectCycleProjections(state: LocalState, now: Date, count = 3): CycleProjection[] {
  const config = selectConfig(state);

  if (!config) {
    return [];
  }

  const cycle = selectActiveCycle(state);
  const referenceKey = cycle
    ? cycleKeyFromStartDate(cycle.startDate)
    : cycleKeyFromStartDate(toISODate(calculateDefaultCycleStartDate(now, config.payday)));

  return projectCycles(config, state.cardPurchases.filter(isLive), referenceKey, count);
}

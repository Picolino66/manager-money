import { format, isAfter, parseISO, startOfDay } from 'date-fns';

import {
  buildCardStatements,
  calculateCardChargesForCycle,
  calculateCardInstallmentsForCycle,
  calculateCardLimitUsage,
  CardInstallment,
  CardLimitUsage,
  CardStatement,
  addCycleKeys,
  cycleKeyFromStartDate,
  cycleKeyOffset,
  listEffectiveInstallments,
  statementDueDate,
  statementKeysStartingBetween,
  statementStartDate,
} from '../domain/financial/credit-card';
import {
  calculateDefaultCycleStartDate,
  calculateFixedExpenseAmount,
  CycleAdjustments,
} from '../domain/financial/financial.calculations';
import {
  CarriedStatement,
  FinancialConfig,
  FinancialMonth,
  FixedExpense,
  isActive,
  MoneyCents,
} from '../domain/financial/financial.types';
import { calculateExtraIncomeTotal, calculatePaidFixedAmount } from '../domain/financial/payments';
import {
  CycleProjection,
  projectCycles,
  projectFixedExpenseAmount,
} from '../domain/financial/projection';
import { toISODate } from '../utils/date';
import {
  CardPurchaseRecord,
  CreditCardRecord,
  CycleRecord,
  ExpenseRecord,
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

/** Encargos (juros/multa) de faturas reconhecidos durante o ciclo (BR-FIN-033). */
export function selectCycleStatementInterest(state: LocalState, cycleId: string): MoneyCents {
  return selectStatementPayments(state)
    .filter((payment) => payment.cycleId === cycleId)
    .reduce((total, payment) => total + payment.charges, 0);
}

/** Ajustes do saldo do ciclo: parcelas de cartão, rendas avulsas, fixas pagas à vista e juros. */
export function selectCycleAdjustments(
  state: LocalState,
  cycle: Pick<CycleRecord, 'id' | 'startDate'> & Pick<Partial<CycleRecord>, 'carriedStatementDebt'>,
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
    carriedStatementDebt: cycle.carriedStatementDebt ?? 0,
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

/**
 * BR-FIN-035: por que uma fixa recorrente no cartão continua pendente no ciclo ativo (id da fixa →
 * mensagem): ainda não chegou a virada da fatura, o cartão não serve, o usuário desfez ou a recusa do
 * núcleo. Só entram as pendentes com `recurringCardId`.
 */
export function selectRecurringIssues(
  state: LocalState,
  cycleId: string,
  today: Date = new Date(),
): Record<string, string> {
  const cycle = state.cycles.find((record) => record.id === cycleId && isLive(record));

  if (!cycle) {
    return {};
  }

  const todayIso = toISODate(today);

  return Object.fromEntries(
    selectPendingFixedExpenses(state, cycleId).flatMap((expense) => {
      if (expense.type !== 'permanent' || !expense.recurringCardId) {
        return [];
      }

      const card = state.creditCards.find(
        (record) => record.id === expense.recurringCardId && isLive(record),
      );

      if (!card) {
        return [[expense.id, 'O cartão desta despesa recorrente foi excluído.'] as const];
      }

      if (!card.active) {
        return [
          [expense.id, `O cartão ${card.name} está inativo: a despesa não foi lançada.`] as const,
        ];
      }

      const undone = state.fixedPayments.some(
        (payment) =>
          payment.cycleId === cycleId &&
          payment.fixedExpenseId === expense.id &&
          payment.id.startsWith('auto-pay-') &&
          payment.deletedAt,
      );

      if (undone) {
        return [[expense.id, 'Lançamento automático desfeito neste ciclo.'] as const];
      }

      const starts = statementKeysStartingBetween(
        card.closingDay,
        cycle.startDate,
        cycle.endDate,
      ).map((key) => format(statementStartDate(key, card.closingDay), 'yyyy-MM-dd'));
      const next = starts.find((date) => date > todayIso);
      const message =
        starts.length === 0
          ? 'Nenhuma virada de fatura neste ciclo: continua reservada.'
          : next && starts.every((date) => date > todayIso)
            ? `Será lançada na virada da fatura ${card.name}, em ${next.slice(8, 10)}/${next.slice(5, 7)}.`
            : 'Não foi possível lançar no cartão neste ciclo.';

      return [[expense.id, message] as const];
    }),
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
          statement.remaining > 0 &&
          (statement.status !== 'open' || startOfDay(parseISO(statement.dueDate)) <= horizon),
      )
      .map((statement) => ({
        kind: 'statement' as const,
        id: `${card.id}:${statement.key}`,
        label: `Fatura ${card.name}`,
        // Fatura parcial mostra só o que falta pagar (BR-FIN-033).
        amount: statement.remaining,
        dueDate: statement.dueDate,
        overdue: isAfter(startOfDay(today), startOfDay(parseISO(statement.dueDate))),
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

  return projectCycles(
    config,
    state.cardPurchases.filter(isLive),
    referenceKey,
    count,
    selectCreditCards(state),
  );
}

/**
 * BR-FIN-034: restante de faturas parciais que o ciclo transporta ao fechar. Entra a fatura que
 * pesou neste ciclo (vence nele ou veio transportada) e tem lançamento registrado; o valor nunca
 * passa do que este ciclo reservou para ela. Fatura sem nenhum lançamento não é transportada.
 */
export function selectStatementsToCarry(
  state: LocalState,
  cycle: Pick<CycleRecord, 'id' | 'startDate'>,
  now: Date,
): CarriedStatement[] {
  const cycleKey = cycleKeyFromStartDate(cycle.startDate);
  const carriedIn = selectClosedMonths(state)[0]?.carriedStatements ?? [];

  return selectCreditCards(state).flatMap((card) =>
    selectCardStatements(state, card.id, now).flatMap((statement) => {
      const reservedHere = statement.installments
        .filter((installment) => installment.cycleKey === cycleKey)
        .reduce((total, installment) => total + installment.amount, 0);
      // Parcelas da mesma fatura que ainda vão pesar em ciclos seguintes já serão reservadas lá.
      const reservedLater = statement.installments
        .filter((installment) => installment.cycleKey > cycleKey)
        .reduce((total, installment) => total + installment.amount, 0);
      const carried =
        carriedIn.find((item) => item.cardId === card.id && item.statementKey === statement.key)
          ?.amount ?? 0;
      const chargesHere = statement.payments
        .filter((payment) => payment.cycleId === cycle.id)
        .reduce((total, payment) => total + payment.charges, 0);
      // Só fatura com pagamento registrado (parcial) é transportada; encargos sozinhos não bastam.
      const counts =
        carried > 0 ||
        (reservedHere > 0 && statement.payments.some((payment) => payment.paidAmount > 0));
      const amount = counts
        ? Math.min(
            Math.max(0, statement.remaining - reservedLater),
            reservedHere + carried + chargesHere,
          )
        : 0;

      return amount > 0 ? [{ cardId: card.id, statementKey: statement.key, amount }] : [];
    }),
  );
}

// ---------------------------------------------------------------------------
// Gastos por ciclo (filtro de mês e ano da tela Ciclos)
// ---------------------------------------------------------------------------

export type CycleSpendingItem = {
  id: string;
  description: string;
  /** "3/10" em compra parcelada; vazio em compra à vista. */
  installmentLabel: string;
  amount: MoneyCents;
};

export type CycleSpendingStatement = {
  cardId: string;
  cardName: string;
  statementKey: string;
  dueDate: string;
  total: MoneyCents;
  items: CycleSpendingItem[];
};

export type CycleSpending = {
  cycleKey: string;
  /** closed/active: ciclo registrado; future: ainda não aberto; empty: passado sem registro. */
  phase: 'closed' | 'active' | 'future' | 'empty';
  startDate: string | null;
  endDate: string | null;
  expenses: ExpenseRecord[];
  expensesTotal: MoneyCents;
  /** Fixas pagas à vista; as pagas no crédito aparecem na fatura. */
  fixedPaid: FixedPaymentRecord[];
  fixedPaidTotal: MoneyCents;
  /** Fixas que ainda vão sair: pendentes (ciclo ativo) ou previstas (ciclo futuro). */
  fixedPlanned: { id: string; name: string; amount: MoneyCents }[];
  fixedPlannedTotal: MoneyCents;
  statements: CycleSpendingStatement[];
  cardTotal: MoneyCents;
  statementCharges: MoneyCents;
  total: MoneyCents;
  isEmpty: boolean;
};

function findCycleByKey(state: LocalState, cycleKey: string): CycleRecord | null {
  return (
    state.cycles
      .filter((cycle) => isLive(cycle) && cycleKeyFromStartDate(cycle.startDate) === cycleKey)
      .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0] ?? null
  );
}

/** Ciclo de referência: o ativo ou, sem ele, o ciclo padrão que contém hoje. */
function referenceCycleKey(state: LocalState, now: Date): string {
  const active = selectActiveCycle(state);
  const config = selectConfig(state);

  if (active) {
    return cycleKeyFromStartDate(active.startDate);
  }

  return config
    ? cycleKeyFromStartDate(toISODate(calculateDefaultCycleStartDate(now, config.payday)))
    : cycleKeyFromStartDate(toISODate(now));
}

/**
 * Janela navegável do filtro: do ciclo mais antigo registrado até o último ciclo com parcela de
 * cartão, mais 3 ciclos de margem à frente do ciclo de referência.
 */
export function selectCycleSpendingRange(
  state: LocalState,
  now: Date,
): { min: string; max: string; current: string } {
  const current = referenceCycleKey(state, now);
  const keys = state.cycles
    .filter(isLive)
    .map((cycle) => cycleKeyFromStartDate(cycle.startDate))
    .concat(current);
  const lastInstallment = state.cardPurchases
    .filter(isLive)
    .flatMap((purchase) => calculateCardInstallmentsForCycleRange(purchase))
    .reduce((max, key) => (key > max ? key : max), current);
  const margin = addCycleKeys(current, 3);

  return {
    min: keys.reduce((min, key) => (key < min ? key : min), current),
    max: lastInstallment > margin ? lastInstallment : margin,
    current,
  };
}

function calculateCardInstallmentsForCycleRange(purchase: CardPurchaseRecord): string[] {
  return listEffectiveInstallments([purchase]).map((installment) => installment.cycleKey);
}

/**
 * O que pesa no ciclo `cycleKey` (yyyy-MM do início): gastos, fixas pagas à vista, faturas que
 * vencem nele (com as compras e parcelas) e encargos. Ciclo futuro mostra as parcelas já
 * comprometidas e as fixas previstas (BR-FIN-031), sem inventar gastos.
 */
export function selectCycleSpending(state: LocalState, cycleKey: string, now: Date): CycleSpending {
  const cycle = findCycleByKey(state, cycleKey);
  const reference = referenceCycleKey(state, now);
  const phase: CycleSpending['phase'] = cycle
    ? cycle.status === 'active'
      ? 'active'
      : 'closed'
    : cycleKey > reference
      ? 'future'
      : 'empty';
  const expenses = cycle
    ? state.expenses
        .filter((expense) => isLive(expense) && expense.cycleId === cycle.id)
        .sort((left, right) => right.date.localeCompare(left.date))
    : [];
  const fixedPaid = cycle
    ? selectCyclePayments(state, cycle.id).filter((payment) => payment.method !== 'credit')
    : [];
  const cards = selectCreditCards(state);
  const statements = cards.flatMap((card) => {
    const byStatement = new Map<string, CardInstallment[]>();

    for (const installment of selectCardInstallments(state, cycleKey)) {
      if (installment.purchase.cardId === card.id && installment.amount > 0) {
        byStatement.set(installment.statementKey, [
          ...(byStatement.get(installment.statementKey) ?? []),
          installment,
        ]);
      }
    }

    return [...byStatement.entries()].map(([statementKey, installments]) => ({
      cardId: card.id,
      cardName: card.name,
      statementKey,
      dueDate: toISODate(statementDueDate(statementKey, card)),
      total: installments.reduce((total, installment) => total + installment.amount, 0),
      items: installments.map((installment) => ({
        id: `${installment.purchase.id}:${installment.number}`,
        description: installment.purchase.description,
        installmentLabel:
          installment.purchase.installments > 1
            ? `${installment.number}/${installment.purchase.installments}`
            : '',
        amount: installment.amount,
      })),
    }));
  });
  const config = selectConfig(state);
  const fixedPlanned: CycleSpending['fixedPlanned'] =
    phase === 'active' && cycle
      ? selectPendingFixedExpenses(state, cycle.id).map((expense) => ({
          id: expense.id,
          name: expense.name,
          amount: calculateFixedExpenseAmount(expense),
        }))
      : phase === 'future' && config
        ? config.fixedExpenses
            .map((expense) => ({
              id: expense.id,
              name: expense.name,
              amount: projectFixedExpenseAmount(expense, cycleKeyOffset(reference, cycleKey)),
            }))
            .filter((item) => item.amount > 0)
        : [];
  const statementCharges = cycle ? selectCycleStatementInterest(state, cycle.id) : 0;
  const sum = (values: MoneyCents[]) => values.reduce((total, value) => total + value, 0);
  const expensesTotal = sum(expenses.map((expense) => expense.amount));
  const fixedPaidTotal = sum(fixedPaid.map((payment) => payment.amount));
  const fixedPlannedTotal = sum(fixedPlanned.map((item) => item.amount));
  const cardTotal = sum(statements.map((statement) => statement.total));
  const total = expensesTotal + fixedPaidTotal + fixedPlannedTotal + cardTotal + statementCharges;

  return {
    cycleKey,
    phase,
    startDate: cycle?.startDate ?? null,
    endDate: cycle?.endDate ?? null,
    expenses,
    expensesTotal,
    fixedPaid,
    fixedPaidTotal,
    fixedPlanned,
    fixedPlannedTotal,
    statements,
    cardTotal,
    statementCharges,
    total,
    isEmpty:
      expenses.length === 0 &&
      fixedPaid.length === 0 &&
      fixedPlanned.length === 0 &&
      statements.length === 0 &&
      statementCharges === 0,
  };
}

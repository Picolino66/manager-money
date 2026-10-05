import { parseISO } from 'date-fns';

import {
  addCycleKeys,
  calculateCardChargesForCycle,
  CardPurchase,
  CreditCard,
  statementCycleKey,
  statementKeyForDate,
} from './credit-card';
import { calculateIncomeTotal, calculatePrimaryPayday } from './financial.calculations';
import { FinancialConfig, FixedExpense, isActive, MoneyCents } from './financial.types';

/** Quanto do dinheiro de um ciclo futuro já está comprometido (BR-FIN-031). */
export type CycleProjection = {
  cycleKey: string;
  /** Quantos ciclos à frente do ciclo de referência (1 = próximo). */
  cyclesAhead: number;
  income: MoneyCents;
  savingGoal: MoneyCents;
  fixedExpenses: MoneyCents;
  cardCharges: MoneyCents;
  /** Livre antes de novos gastos: renda − meta − fixas − faturas. Pode ser negativo. */
  free: MoneyCents;
};

/**
 * Valor da despesa fixa daqui a `cyclesAhead` ciclos. Parcelamento já iniciado perde uma parcela por
 * ciclo aberto; o não iniciado começa a contar no próximo ciclo (BR-FIN-010).
 */
export function projectFixedExpenseAmount(expense: FixedExpense, cyclesAhead: number): MoneyCents {
  if (!isActive(expense)) {
    return 0;
  }

  if (expense.type === 'permanent') {
    return expense.amount;
  }

  const remaining =
    expense.remainingInstallments - (expense.startedAtCycleId ? cyclesAhead : cyclesAhead - 1);

  return remaining > 0 ? expense.installmentAmount : 0;
}

/** Fixa permanente ativa recorrente num cartão ativo (BR-FIN-035): pesa pela fatura, não como fixa. */
function recurringCard(
  expense: FixedExpense,
  cards: Map<string, Pick<CreditCard, 'id' | 'closingDay' | 'dueDay'>>,
) {
  return expense.type === 'permanent' && isActive(expense) && expense.recurringCardId
    ? cards.get(expense.recurringCardId)
    : undefined;
}

/**
 * BR-FIN-035: compra virtual da fixa recorrente no início de um ciclo futuro (1 parcela, sem juros), com
 * as mesmas regras de fechamento e vencimento da compra real; assim ela pesa no ciclo da fatura.
 */
function virtualRecurringPurchase(
  expense: FixedExpense & { type: 'permanent' },
  card: Pick<CreditCard, 'id' | 'closingDay' | 'dueDay'>,
  cycleKey: string,
  payday: number,
): CardPurchase {
  const purchaseDate = `${cycleKey}-${String(payday).padStart(2, '0')}`;
  const firstStatementKey = statementKeyForDate(parseISO(purchaseDate), card.closingDay);
  const dueCycleKey = statementCycleKey(firstStatementKey, card, payday);

  return {
    id: `virtual-${cycleKey}-${expense.id}`,
    cardId: card.id,
    description: expense.name,
    category: expense.category,
    totalAmount: expense.amount,
    installments: 1,
    purchaseDate,
    firstStatementKey,
    firstCycleKey: dueCycleKey > cycleKey ? dueCycleKey : cycleKey,
    settledInstallments: 0,
    createdAt: purchaseDate,
  };
}

/**
 * BR-FIN-031: projeta os próximos `count` ciclos a partir do ciclo de referência, usando só o que
 * já é conhecido: fontes de renda ativas, meta, fixas ativas e parcelas de cartão. Fixa recorrente no
 * cartão (BR-FIN-035) entra como cobrança de cartão (compra virtual por ciclo), nunca como fixa.
 */
export function projectCycles(
  config: Pick<FinancialConfig, 'incomeSources' | 'savingGoal' | 'fixedExpenses'>,
  purchases: CardPurchase[],
  referenceCycleKey: string,
  count: number,
  cards: Pick<CreditCard, 'id' | 'closingDay' | 'dueDay' | 'active'>[] = [],
): CycleProjection[] {
  const income = calculateIncomeTotal(config.incomeSources);
  const payday = calculatePrimaryPayday(config.incomeSources);
  const usableCards = new Map(cards.filter((card) => card.active).map((card) => [card.id, card]));

  return Array.from({ length: count }, (_, index) => {
    const cyclesAhead = index + 1;
    const cycleKey = addCycleKeys(referenceCycleKey, cyclesAhead);
    const fixedExpenses = config.fixedExpenses.reduce(
      (total, expense) =>
        recurringCard(expense, usableCards)
          ? total
          : total + projectFixedExpenseAmount(expense, cyclesAhead),
      0,
    );
    const virtual = Array.from({ length: count }, (_, ahead) =>
      addCycleKeys(referenceCycleKey, ahead + 1),
    ).flatMap((key) =>
      config.fixedExpenses.flatMap((expense) => {
        const card = recurringCard(expense, usableCards);

        return card && expense.type === 'permanent'
          ? [virtualRecurringPurchase(expense, card, key, payday)]
          : [];
      }),
    );
    const cardCharges = calculateCardChargesForCycle([...purchases, ...virtual], cycleKey);

    return {
      cycleKey,
      cyclesAhead,
      income,
      savingGoal: config.savingGoal,
      fixedExpenses,
      cardCharges,
      free: income - config.savingGoal - fixedExpenses - cardCharges,
    };
  });
}

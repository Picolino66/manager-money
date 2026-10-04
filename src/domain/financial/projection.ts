import { addCycleKeys, calculateCardChargesForCycle, CardPurchase } from './credit-card';
import { calculateIncomeTotal } from './financial.calculations';
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

/**
 * BR-FIN-031: projeta os próximos `count` ciclos a partir do ciclo de referência, usando só o que
 * já é conhecido: fontes de renda ativas, meta, fixas ativas e parcelas de cartão.
 */
export function projectCycles(
  config: Pick<FinancialConfig, 'incomeSources' | 'savingGoal' | 'fixedExpenses'>,
  purchases: CardPurchase[],
  referenceCycleKey: string,
  count: number,
): CycleProjection[] {
  const income = calculateIncomeTotal(config.incomeSources);

  return Array.from({ length: count }, (_, index) => {
    const cyclesAhead = index + 1;
    const cycleKey = addCycleKeys(referenceCycleKey, cyclesAhead);
    const fixedExpenses = config.fixedExpenses.reduce(
      (total, expense) => total + projectFixedExpenseAmount(expense, cyclesAhead),
      0,
    );
    const cardCharges = calculateCardChargesForCycle(purchases, cycleKey);

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

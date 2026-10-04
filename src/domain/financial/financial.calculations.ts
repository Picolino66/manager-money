import {
  addDays,
  differenceInCalendarDays,
  addMonths,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';

import {
  DashboardSummary,
  DayStatus,
  DEFAULT_PAYDAY,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORY,
  Expense,
  ExpenseCategory,
  FixedExpense,
  FinancialConfig,
  FinancialMonth,
  IncomeSource,
  isActive,
  MoneyCents,
} from './financial.types';
import { formatCycleLabel, formatShortDate, toISODate } from '../../utils/date';

export function normalizeCategory(category?: string): ExpenseCategory {
  const normalized = category?.trim();

  return normalized || DEFAULT_EXPENSE_CATEGORY;
}

export function getAvailableCategories(config?: Pick<FinancialConfig, 'customCategories'> | null) {
  return Array.from(
    new Set([
      ...DEFAULT_EXPENSE_CATEGORIES,
      ...(config?.customCategories ?? []).map(normalizeCategory),
    ]),
  );
}

export function getSortedCategories(config?: Pick<FinancialConfig, 'customCategories'> | null) {
  return [...getAvailableCategories(config)].sort((left, right) =>
    left.localeCompare(right, 'pt-BR'),
  );
}

export function calculateExpensesByCategory(expenses: Expense[]) {
  return expenses.reduce<Record<string, MoneyCents>>((totals, expense) => {
    const category = normalizeCategory(expense.category);
    totals[category] = (totals[category] ?? 0) + expense.amount;

    return totals;
  }, {});
}

export function calculateFixedExpenseAmount(expense: FixedExpense): MoneyCents {
  if (expense.type === 'installment') {
    return expense.remainingInstallments > 0 ? expense.installmentAmount : 0;
  }

  return expense.amount;
}

/** BR-FIN-018: renda mensal = soma das fontes ativas. */
export function calculateIncomeTotal(
  sources: Pick<IncomeSource, 'amount' | 'active'>[],
): MoneyCents {
  return sources.filter(isActive).reduce((total, source) => total + source.amount, 0);
}

/** BR-FIN-024: o ciclo usa o dia de pagamento da fonte ativa de maior valor (empate: a primeira). */
export function calculatePrimaryIncomeSource<T extends Pick<IncomeSource, 'amount' | 'active'>>(
  sources: T[],
): T | undefined {
  return sources
    .filter(isActive)
    .reduce<T | undefined>(
      (primary, source) => (!primary || source.amount > primary.amount ? source : primary),
      undefined,
    );
}

export function calculatePrimaryPayday(
  sources: Pick<IncomeSource, 'amount' | 'payday' | 'active'>[],
): number {
  return calculatePrimaryIncomeSource(sources)?.payday ?? DEFAULT_PAYDAY;
}

export function calculateFixedExpensesTotal(
  config: Pick<FinancialConfig, 'fixedExpenses'>,
): MoneyCents {
  return config.fixedExpenses
    .filter(isActive)
    .reduce((total, expense) => total + calculateFixedExpenseAmount(expense), 0);
}

/**
 * BR-FIN-004: saldo base = renda + rendas avulsas − despesas fixas do ciclo − meta. As fixas do ciclo
 * são as pagas à vista mais as ativas ainda pendentes (reservadas); a fixa paga no crédito pesa pela
 * fatura (BR-FIN-022), nunca aqui.
 */
export function calculateBaseAvailableAmount(
  config: Pick<FinancialConfig, 'monthlyIncome' | 'savingGoal'>,
  adjustments: Pick<
    CycleAdjustments,
    'extraIncome' | 'paidFixedExpenses' | 'pendingFixedExpenses'
  > = {},
): MoneyCents {
  return (
    config.monthlyIncome +
    (adjustments.extraIncome ?? 0) -
    (adjustments.paidFixedExpenses ?? 0) -
    (adjustments.pendingFixedExpenses ?? 0) -
    config.savingGoal
  );
}

/** Valores do ciclo que ajustam o saldo base (BR-FIN-019, BR-FIN-021, BR-FIN-023). */
export type CycleAdjustments = {
  /** Parcelas de cartão que caem no ciclo. */
  cardCharges?: MoneyCents;
  /** Rendas avulsas do ciclo. */
  extraIncome?: MoneyCents;
  /** Despesas fixas pagas à vista (Pix, dinheiro, débito) no ciclo. */
  paidFixedExpenses?: MoneyCents;
  /** Despesas fixas ativas ainda não pagas no ciclo: ficam reservadas (BR-FIN-004). */
  pendingFixedExpenses?: MoneyCents;
  /** Encargos (juros/multa) de faturas reconhecidos no ciclo (BR-FIN-033). */
  statementInterest?: MoneyCents;
  /** Restante de faturas parciais transportado do ciclo anterior (BR-FIN-034). */
  carriedStatementDebt?: MoneyCents;
};

/**
 * BR-FIN-005: saldo inicial = saldo base − dívida herdada − parcelas de cartão do ciclo − encargos
 * de faturas reconhecidos no ciclo − restante de faturas parciais transportado (BR-FIN-034).
 */
export function calculateInitialAvailableAmount(
  config: Pick<FinancialConfig, 'monthlyIncome' | 'savingGoal'>,
  previousMonthDebt: MoneyCents,
  adjustments: CycleAdjustments = {},
): MoneyCents {
  return (
    calculateBaseAvailableAmount(config, adjustments) -
    previousMonthDebt -
    (adjustments.cardCharges ?? 0) -
    (adjustments.statementInterest ?? 0) -
    (adjustments.carriedStatementDebt ?? 0)
  );
}

export function calculateTotalSpent(expenses: Expense[]): MoneyCents {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

export function calculateRemainingAvailableAmount(month: FinancialMonth): MoneyCents {
  return month.initialAvailableAmount - calculateTotalSpent(month.expenses);
}

export function calculateDailyLimit(
  remainingAvailableAmount: MoneyCents,
  remainingDays: number,
): MoneyCents {
  if (remainingDays <= 0) {
    return remainingAvailableAmount;
  }

  return Math.trunc(remainingAvailableAmount / remainingDays);
}

export function calculateTodaySpent(expenses: Expense[], date: Date): MoneyCents {
  return expenses
    .filter((expense) => isSameDay(parseISO(expense.date), date))
    .reduce((total, expense) => total + expense.amount, 0);
}

export function calculateTodayBalance(
  currentDailyLimit: MoneyCents,
  todaySpent: MoneyCents,
): MoneyCents {
  return currentDailyLimit - todaySpent;
}

export function calculateFinalBalance(month: FinancialMonth): MoneyCents {
  return month.initialAvailableAmount - calculateTotalSpent(month.expenses);
}

export function calculatePreviousMonthDebt(previousMonth?: FinancialMonth): MoneyCents {
  if (
    !previousMonth ||
    previousMonth.finalBalance === undefined ||
    previousMonth.finalBalance >= 0
  ) {
    return 0;
  }

  return Math.abs(previousMonth.finalBalance);
}

/** Fim do ciclo que começa em `startDate`: véspera do pagamento do mês seguinte (BR-FIN-002). */
export function calculateCycleEndDate(startDate: Date, payday: number = DEFAULT_PAYDAY): Date {
  const cycleStart = startOfDay(startDate);

  return addDays(new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, payday), -1);
}

/** Início padrão do ciclo que contém `referenceDate` (BR-FIN-002). */
export function calculateDefaultCycleStartDate(
  referenceDate: Date = new Date(),
  payday: number = DEFAULT_PAYDAY,
): Date {
  const today = startOfDay(referenceDate);

  if (today.getDate() >= payday) {
    return new Date(today.getFullYear(), today.getMonth(), payday);
  }

  const previousMonth = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -1);

  return new Date(previousMonth.getFullYear(), previousMonth.getMonth(), payday);
}

/** Janela de recebimento antecipado: dias anteriores ao pagamento no mês corrente. */
export function canReceiveIncomeEarly(
  referenceDate: Date = new Date(),
  payday: number = DEFAULT_PAYDAY,
): boolean {
  const today = startOfDay(referenceDate);

  return today.getDate() < payday;
}

/**
 * BR-FIN-016: o recebimento antecipado só vale dentro da janela, para um ciclo ativo que
 * termina antes do pagamento deste mês e que começou antes de hoje (uma vez por ciclo).
 */
export function canReceiveIncomeEarlyForCycle(
  activeMonth: Pick<FinancialMonth, 'startDate' | 'endDate'>,
  referenceDate: Date = new Date(),
  payday: number = DEFAULT_PAYDAY,
): boolean {
  const today = startOfDay(referenceDate);
  const upcomingPayday = new Date(today.getFullYear(), today.getMonth(), payday);

  return (
    canReceiveIncomeEarly(today, payday) &&
    isBefore(startOfDay(parseISO(activeMonth.endDate)), upcomingPayday) &&
    isBefore(startOfDay(parseISO(activeMonth.startDate)), today)
  );
}

/** BR-FIN-017: fechamento manual só depois do último dia do ciclo. */
export function canCloseCycle(
  month: Pick<FinancialMonth, 'endDate'>,
  referenceDate: Date = new Date(),
): boolean {
  return isAfter(startOfDay(referenceDate), startOfDay(parseISO(month.endDate)));
}

export function describeCloseCycleBlock(month: Pick<FinancialMonth, 'endDate'>): string {
  return `O ciclo termina em ${formatShortDate(month.endDate)}. Se o pagamento cair antes, use "Já recebi".`;
}

export function buildFinancialCycleDates(receivedAt?: Date, payday: number = DEFAULT_PAYDAY) {
  const startDate = startOfDay(receivedAt ?? calculateDefaultCycleStartDate(new Date(), payday));
  const endDate = calculateCycleEndDate(startDate, payday);

  return {
    startDate: toISODate(startDate),
    endDate: toISODate(endDate),
    receivedAt: startDate.toISOString(),
  };
}

export function buildLegacyFinancialCycleDates(year: number, month: number) {
  return buildFinancialCycleDates(new Date(year, month - 1, DEFAULT_PAYDAY), DEFAULT_PAYDAY);
}

export function calculateRemainingDays(month: FinancialMonth, referenceDate: Date): number {
  const monthStart = startOfDay(parseISO(month.startDate));
  const monthEnd = startOfDay(parseISO(month.endDate));
  const today = startOfDay(referenceDate);

  if (isBefore(today, monthStart)) {
    return differenceInCalendarDays(monthEnd, monthStart) + 1;
  }

  if (isAfter(today, monthEnd)) {
    return 0;
  }

  return differenceInCalendarDays(monthEnd, today) + 1;
}

export function calculateSpentBeforeDate(expenses: Expense[], date: Date): MoneyCents {
  const day = startOfDay(date);

  return expenses
    .filter((expense) => isBefore(startOfDay(parseISO(expense.date)), day))
    .reduce((total, expense) => total + expense.amount, 0);
}

export function calculateDailyLimitForDate(month: FinancialMonth, date: Date): MoneyCents {
  const spentBeforeDate = calculateSpentBeforeDate(month.expenses, date);
  const remainingBeforeDate = month.initialAvailableAmount - spentBeforeDate;
  const remainingDays = calculateRemainingDays(month, date);

  return calculateDailyLimit(remainingBeforeDate, remainingDays);
}

export function calculateDayBalance(month: FinancialMonth, date: Date): MoneyCents {
  const dailyLimit = calculateDailyLimitForDate(month, date);
  const daySpent = calculateTodaySpent(month.expenses, date);

  return calculateTodayBalance(dailyLimit, daySpent);
}

export function calculatePercentageRemaining(
  todayBalance: MoneyCents,
  currentDailyLimit: MoneyCents,
): number {
  if (currentDailyLimit <= 0) {
    return todayBalance >= 0 ? 1 : -1;
  }

  return todayBalance / currentDailyLimit;
}

export function calculateDayStatus(
  todayBalance: MoneyCents,
  currentDailyLimit: MoneyCents,
): DayStatus {
  if (todayBalance < 0) {
    return 'negative';
  }

  const percentageRemaining = calculatePercentageRemaining(todayBalance, currentDailyLimit);

  if (percentageRemaining > 0.5) {
    return 'healthy';
  }

  if (percentageRemaining > 0.15) {
    return 'warning';
  }

  return 'critical';
}

export function buildDashboardSummary(
  month: FinancialMonth,
  referenceDate: Date = new Date(),
): DashboardSummary {
  const currentDailyLimit = calculateDailyLimitForDate(month, referenceDate);
  const todaySpent = calculateTodaySpent(month.expenses, referenceDate);
  const todayBalance = calculateTodayBalance(currentDailyLimit, todaySpent);
  const percentageRemaining = calculatePercentageRemaining(todayBalance, currentDailyLimit);

  return {
    cycleLabel: formatCycleLabel(month.startDate, month.endDate),
    initialAvailableAmount: month.initialAvailableAmount,
    remainingAvailableAmount: calculateRemainingAvailableAmount(month),
    totalSpent: calculateTotalSpent(month.expenses),
    currentDailyLimit,
    todaySpent,
    todayBalance,
    percentageRemaining,
    dayStatus: calculateDayStatus(todayBalance, currentDailyLimit),
    remainingDays: calculateRemainingDays(month, referenceDate),
  };
}

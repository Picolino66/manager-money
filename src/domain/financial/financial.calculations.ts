import {
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
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_EXPENSE_CATEGORY,
  Expense,
  ExpenseCategory,
  FixedExpense,
  FinancialConfig,
  FinancialMonth,
  MoneyCents,
} from './financial.types';
import { formatCycleLabel, toISODate } from '../../utils/date';

export const FINANCIAL_CYCLE_START_DAY = 7;
export const FINANCIAL_CYCLE_END_DAY = 6;

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

export function calculateFixedExpensesTotal(config: FinancialConfig): MoneyCents {
  return config.fixedExpenses.reduce(
    (total, expense) => total + calculateFixedExpenseAmount(expense),
    0,
  );
}

export function calculateBaseAvailableAmount(config: FinancialConfig): MoneyCents {
  return config.monthlyIncome - calculateFixedExpensesTotal(config) - config.savingGoal;
}

export function calculateInitialAvailableAmount(
  config: FinancialConfig,
  previousMonthDebt: MoneyCents,
): MoneyCents {
  return calculateBaseAvailableAmount(config) - previousMonthDebt;
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
  if (!previousMonth || previousMonth.finalBalance === undefined || previousMonth.finalBalance >= 0) {
    return 0;
  }

  return Math.abs(previousMonth.finalBalance);
}

export function advanceInstallmentExpenses(config: FinancialConfig): FinancialConfig {
  return {
    ...config,
    fixedExpenses: config.fixedExpenses.map((expense) => {
      if (
        expense.type !== 'installment' ||
        !expense.startedAtCycleId ||
        expense.remainingInstallments <= 0
      ) {
        return expense;
      }

      return {
        ...expense,
        remainingInstallments: Math.max(0, expense.remainingInstallments - 1),
      };
    }),
  };
}

export function startPendingInstallmentExpenses(
  config: FinancialConfig,
  cycleId: string,
): FinancialConfig {
  return {
    ...config,
    fixedExpenses: config.fixedExpenses.map((expense) => {
      if (expense.type !== 'installment' || expense.startedAtCycleId) {
        return expense;
      }

      return {
        ...expense,
        startedAtCycleId: cycleId,
      };
    }),
  };
}

export function calculateCycleEndDate(startDate: Date): Date {
  const cycleStart = startOfDay(startDate);
  const nextMonth = addMonths(new Date(cycleStart.getFullYear(), cycleStart.getMonth(), 1), 1);

  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), FINANCIAL_CYCLE_END_DAY);
}

export function calculateDefaultCycleStartDate(referenceDate: Date = new Date()): Date {
  const today = startOfDay(referenceDate);

  if (today.getDate() >= FINANCIAL_CYCLE_START_DAY) {
    return new Date(today.getFullYear(), today.getMonth(), FINANCIAL_CYCLE_START_DAY);
  }

  const previousMonth = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), -1);

  return new Date(previousMonth.getFullYear(), previousMonth.getMonth(), FINANCIAL_CYCLE_START_DAY);
}

export function canReceiveIncomeEarly(referenceDate: Date = new Date()): boolean {
  const today = startOfDay(referenceDate);

  return today.getDate() < FINANCIAL_CYCLE_START_DAY;
}

export function buildFinancialCycleDates(receivedAt: Date = calculateDefaultCycleStartDate()) {
  const startDate = startOfDay(receivedAt);
  const endDate = calculateCycleEndDate(startDate);

  return {
    startDate: toISODate(startDate),
    endDate: toISODate(endDate),
    receivedAt: startDate.toISOString(),
  };
}

export function buildLegacyFinancialCycleDates(year: number, month: number) {
  return buildFinancialCycleDates(new Date(year, month - 1, FINANCIAL_CYCLE_START_DAY));
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

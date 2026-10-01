import { buildLegacyFinancialCycleDates } from '../../domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_PAYDAY,
  Expense,
  FinancialMonth,
  FixedExpense,
  InstallmentFixedExpense,
  PermanentFixedExpense,
} from '../../domain/financial/financial.types';
import { createEmptyState, LocalState, SyncMeta } from '../../application/state';

/** Chaves do formato v1 (MVP), substituídas pelo documento único v2 (ADR-003). */
export const LEGACY_STORAGE_KEYS = {
  config: '@daily-budget/config',
  months: '@daily-budget/months',
  activeMonth: '@daily-budget/active-month',
} as const;

type StoredFixedExpense =
  | FixedExpense
  | {
      id: string;
      name: string;
      amount: number;
      category?: string;
      type?: 'permanent';
    };

export type LegacyConfig = {
  monthlyIncome: number;
  savingGoal: number;
  updatedAt: string;
  fixedExpenses: StoredFixedExpense[] | number;
  customCategories?: string[];
};

export type LegacyMonth = Omit<FinancialMonth, 'startDate' | 'endDate' | 'receivedAt'> & {
  startDate?: string;
  endDate?: string;
  receivedAt?: string;
  month?: number;
  year?: number;
};

export type LegacySnapshot = {
  config: LegacyConfig | null;
  months: LegacyMonth[] | null;
  activeMonth: LegacyMonth | null;
};

function normalizeFixedExpenses(value: LegacyConfig['fixedExpenses']): FixedExpense[] {
  if (Array.isArray(value)) {
    return value.map((expense) => {
      if (expense.type === 'installment') {
        const installment: InstallmentFixedExpense = {
          ...expense,
          name: expense.name.trim(),
          category: expense.category?.trim() || DEFAULT_EXPENSE_CATEGORY,
          totalInstallments: Math.max(1, expense.totalInstallments),
          remainingInstallments: Math.max(0, expense.remainingInstallments),
          installmentAmount: Math.max(0, expense.installmentAmount),
        };

        return installment;
      }

      const permanent: PermanentFixedExpense = {
        id: expense.id,
        type: 'permanent',
        name: expense.name.trim(),
        category: expense.category?.trim() || DEFAULT_EXPENSE_CATEGORY,
        amount: Math.max(0, expense.amount),
      };

      return permanent;
    });
  }

  if (value <= 0) {
    return [];
  }

  return [
    {
      id: 'legacy-fixed-expenses',
      type: 'permanent',
      name: 'Despesas fixas',
      category: DEFAULT_EXPENSE_CATEGORY,
      amount: value,
    },
  ];
}

function isCalendarMonthCycle(month: LegacyMonth): boolean {
  if (!month.startDate || !month.endDate || !month.receivedAt) {
    return false;
  }

  const start = new Date(`${month.startDate}T00:00:00`);
  const end = new Date(`${month.endDate}T00:00:00`);
  const lastDayOfStartMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

  return (
    start.getDate() === 1 &&
    end.getFullYear() === start.getFullYear() &&
    end.getMonth() === start.getMonth() &&
    end.getDate() === lastDayOfStartMonth
  );
}

/** Converte ciclos de mês civil (versões antigas) para o ciclo do dia de pagamento. */
export function normalizeLegacyMonth(month: LegacyMonth): FinancialMonth {
  const expenses = month.expenses.map((expense) => ({
    ...expense,
    category: expense.category?.trim() || DEFAULT_EXPENSE_CATEGORY,
  }));

  if (month.startDate && month.endDate && month.receivedAt && !isCalendarMonthCycle(month)) {
    return {
      ...month,
      startDate: month.startDate,
      endDate: month.endDate,
      receivedAt: month.receivedAt,
      expenses,
    };
  }

  const storedStartDate = month.startDate ? new Date(`${month.startDate}T00:00:00`) : null;
  const fallbackDate = storedStartDate ?? new Date(month.startedAt);
  const year = month.year ?? fallbackDate.getFullYear();
  const calendarMonth = month.month ?? fallbackDate.getMonth() + 1;

  return {
    id: month.id,
    ...buildLegacyFinancialCycleDates(year, calendarMonth),
    startedAt: month.startedAt,
    closedAt: month.closedAt,
    status: month.status,
    initialAvailableAmount: month.initialAvailableAmount,
    previousMonthDebt: month.previousMonthDebt,
    finalBalance: month.finalBalance,
    expenses,
  };
}

/**
 * Migração v1 → v2: normaliza o legado, achata os gastos com `cycleId` e marca tudo como
 * pendente de envio (dirty) para o primeiro sync.
 */
export function migrateV1ToV2(snapshot: LegacySnapshot, now: Date): LocalState {
  const meta: SyncMeta = { updatedAt: now.toISOString(), deletedAt: null, dirty: true };
  const state = createEmptyState();
  const { config } = snapshot;

  if (config) {
    state.settings = {
      ...meta,
      monthlyIncome: config.monthlyIncome,
      savingGoal: config.savingGoal,
      payday: DEFAULT_PAYDAY,
      customCategories:
        config.customCategories?.map((category) => category.trim()).filter(Boolean) ?? [],
    };
    state.fixedExpenses = normalizeFixedExpenses(config.fixedExpenses).map((expense) => ({
      ...expense,
      ...meta,
    }));
  }

  const months = [...(snapshot.months ?? []), ...(snapshot.activeMonth ? [snapshot.activeMonth] : [])]
    .map(normalizeLegacyMonth)
    .filter((month, index, all) => all.findIndex((other) => other.id === month.id) === index);

  for (const month of months) {
    const { expenses, ...cycle } = month;
    state.cycles.push({ ...cycle, ...meta });
    state.expenses.push(
      ...expenses.map((expense: Expense) => ({ ...expense, cycleId: month.id, ...meta })),
    );
  }

  return state;
}

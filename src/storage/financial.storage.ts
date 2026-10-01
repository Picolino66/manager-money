import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildLegacyFinancialCycleDates } from '../domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  FinancialConfig,
  FixedExpense,
  FinancialMonth,
  InstallmentFixedExpense,
  PermanentFixedExpense,
} from '../domain/financial/financial.types';

const STORAGE_KEYS = {
  config: '@daily-budget/config',
  months: '@daily-budget/months',
  activeMonth: '@daily-budget/active-month',
} as const;

async function readJSON<T>(key: string): Promise<T | null> {
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  return JSON.parse(rawValue) as T;
}

async function writeJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

type StoredFinancialConfig = Omit<FinancialConfig, 'fixedExpenses'> & {
  fixedExpenses: StoredFixedExpense[] | number;
  customCategories?: string[];
};

type StoredFinancialMonth = FinancialMonth & {
  month?: number;
  year?: number;
};

type StoredFixedExpense =
  | FixedExpense
  | {
      id: string;
      name: string;
      amount: number;
      category?: string;
      type?: 'permanent';
    };

function normalizeFixedExpenses(value: StoredFinancialConfig['fixedExpenses']): FixedExpense[] {
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

function normalizeConfig(config: StoredFinancialConfig | null): FinancialConfig | null {
  if (!config) {
    return null;
  }

  return {
    ...config,
    fixedExpenses: normalizeFixedExpenses(config.fixedExpenses),
    customCategories: config.customCategories?.map((category) => category.trim()).filter(Boolean) ?? [],
  };
}

function isCalendarMonthCycle(month: StoredFinancialMonth): boolean {
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

function normalizeMonth(month: StoredFinancialMonth): FinancialMonth {
  if (month.startDate && month.endDate && month.receivedAt && !isCalendarMonthCycle(month)) {
    return month;
  }

  const storedStartDate = month.startDate ? new Date(`${month.startDate}T00:00:00`) : null;
  const fallbackDate = storedStartDate ?? new Date(month.startedAt);
  const year = month.year ?? fallbackDate.getFullYear();
  const calendarMonth = month.month ?? fallbackDate.getMonth() + 1;
  const cycleDates = buildLegacyFinancialCycleDates(year, calendarMonth);

  return {
    id: month.id,
    ...cycleDates,
    startedAt: month.startedAt,
    closedAt: month.closedAt,
    status: month.status,
    initialAvailableAmount: month.initialAvailableAmount,
    previousMonthDebt: month.previousMonthDebt,
    finalBalance: month.finalBalance,
    expenses: month.expenses.map((expense) => ({
      ...expense,
      category: expense.category?.trim() || DEFAULT_EXPENSE_CATEGORY,
    })),
  };
}

export const financialStorage = {
  async getConfig(): Promise<FinancialConfig | null> {
    return normalizeConfig(await readJSON<StoredFinancialConfig>(STORAGE_KEYS.config));
  },

  async saveConfig(config: FinancialConfig): Promise<void> {
    await writeJSON(STORAGE_KEYS.config, config);
  },

  async getActiveMonth(): Promise<FinancialMonth | null> {
    const month = await readJSON<StoredFinancialMonth>(STORAGE_KEYS.activeMonth);

    return month ? normalizeMonth(month) : null;
  },

  async saveActiveMonth(month: FinancialMonth | null): Promise<void> {
    if (!month) {
      await AsyncStorage.removeItem(STORAGE_KEYS.activeMonth);
      return;
    }

    await writeJSON(STORAGE_KEYS.activeMonth, month);
  },

  async getMonths(): Promise<FinancialMonth[]> {
    return ((await readJSON<StoredFinancialMonth[]>(STORAGE_KEYS.months)) ?? []).map(normalizeMonth);
  },

  async saveMonths(months: FinancialMonth[]): Promise<void> {
    await writeJSON(STORAGE_KEYS.months, months);
  },
};

import { isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { create } from 'zustand';

import {
  advanceInstallmentExpenses,
  buildFinancialCycleDates,
  canReceiveIncomeEarly,
  calculateFinalBalance,
  calculateInitialAvailableAmount,
  calculatePreviousMonthDebt,
  getAvailableCategories,
  normalizeCategory,
  startPendingInstallmentExpenses,
} from '../domain/financial/financial.calculations';
import {
  Expense,
  ExpenseInput,
  FinancialConfig,
  FinancialConfigInput,
  FinancialMonth,
} from '../domain/financial/financial.types';
import { financialStorage } from '../storage/financial.storage';

type FinancialState = {
  config: FinancialConfig | null;
  activeMonth: FinancialMonth | null;
  months: FinancialMonth[];
  isLoading: boolean;
  error: string | null;
  loadAppData: () => Promise<void>;
  saveConfig: (config: FinancialConfigInput) => Promise<void>;
  addCategory: (category: string) => Promise<void>;
  startFinancialCycle: (receivedAt?: Date) => Promise<void>;
  receiveIncomeEarly: (receivedAt?: Date) => Promise<void>;
  addExpense: (expense: ExpenseInput) => Promise<void>;
  updateExpense: (expenseId: string, expense: ExpenseInput) => Promise<void>;
  closeActiveMonth: () => Promise<void>;
};

function getLatestClosedMonth(months: FinancialMonth[]): FinancialMonth | undefined {
  return [...months]
    .filter((month) => month.status === 'closed')
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
}

function createFinancialCycle(
  config: FinancialConfig,
  previousMonthDebt: number,
  receivedAt?: Date,
  expenses: Expense[] = [],
): FinancialMonth {
  const cycleDates = buildFinancialCycleDates(receivedAt);
  const initialAvailableAmount = calculateInitialAvailableAmount(config, previousMonthDebt);

  return {
    id: `${cycleDates.startDate}-${Date.now()}`,
    ...cycleDates,
    startedAt: new Date().toISOString(),
    status: 'active',
    initialAvailableAmount,
    previousMonthDebt,
    expenses,
  };
}

function splitExpensesByDate(expenses: Expense[], date: Date) {
  const cycleStart = startOfDay(date);

  return expenses.reduce(
    (result, expense) => {
      if (isBefore(startOfDay(parseISO(expense.date)), cycleStart)) {
        result.previousCycleExpenses.push(expense);
      } else {
        result.nextCycleExpenses.push(expense);
      }

      return result;
    },
    {
      previousCycleExpenses: [] as Expense[],
      nextCycleExpenses: [] as Expense[],
    },
  );
}

function validateExpenseDateWithinActiveMonth(activeMonth: FinancialMonth, date: string) {
  const expenseDate = startOfDay(parseISO(date));
  const cycleStart = startOfDay(parseISO(activeMonth.startDate));
  const cycleEnd = startOfDay(parseISO(activeMonth.endDate));

  if (isBefore(expenseDate, cycleStart) || isAfter(expenseDate, cycleEnd)) {
    throw new Error('A data do gasto precisa estar dentro do ciclo ativo.');
  }
}

function buildExpenseRecord(input: ExpenseInput, existingExpense?: Expense): Expense {
  return {
    id: existingExpense?.id ?? `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    amount: input.amount,
    category: normalizeCategory(input.category),
    description: input.description.trim(),
    date: input.date,
    createdAt: existingExpense?.createdAt ?? new Date().toISOString(),
  };
}

export const useFinancialStore = create<FinancialState>((set, get) => ({
  config: null,
  activeMonth: null,
  months: [],
  isLoading: true,
  error: null,

  async loadAppData() {
    set({ isLoading: true, error: null });

    try {
      const [config, activeMonth, months] = await Promise.all([
        financialStorage.getConfig(),
        financialStorage.getActiveMonth(),
        financialStorage.getMonths(),
      ]);

      set({ config, activeMonth, months, isLoading: false });
    } catch {
      set({ error: 'Nao foi possivel carregar os dados locais.', isLoading: false });
    }
  },

  async saveConfig(input) {
    const { activeMonth } = get();
    let config: FinancialConfig = {
      ...input,
      customCategories: input.customCategories.map(normalizeCategory),
      updatedAt: new Date().toISOString(),
    };

    if (!activeMonth) {
      await financialStorage.saveConfig(config);
      set({ config });
      return;
    }

    config = startPendingInstallmentExpenses(config, activeMonth.id);

    const updatedActiveMonth: FinancialMonth = {
      ...activeMonth,
      initialAvailableAmount: calculateInitialAvailableAmount(
        config,
        activeMonth.previousMonthDebt,
      ),
    };

    await Promise.all([
      financialStorage.saveConfig(config),
      financialStorage.saveActiveMonth(updatedActiveMonth),
    ]);

    set({ config, activeMonth: updatedActiveMonth });
  },

  async addCategory(category) {
    const { config } = get();
    const normalizedCategory = normalizeCategory(category);

    if (!config || getAvailableCategories(config).includes(normalizedCategory)) {
      return;
    }

    const nextConfig: FinancialConfig = {
      ...config,
      customCategories: [...config.customCategories, normalizedCategory],
      updatedAt: new Date().toISOString(),
    };

    await financialStorage.saveConfig(nextConfig);
    set({ config: nextConfig });
  },

  async startFinancialCycle(receivedAt) {
    const { config, months, activeMonth } = get();

    if (!config) {
      throw new Error('Configure renda, fixos e meta antes de iniciar o ciclo.');
    }

    if (activeMonth?.status === 'active') {
      throw new Error('Ja existe um ciclo ativo.');
    }

    const previousMonthDebt = calculatePreviousMonthDebt(getLatestClosedMonth(months));
    const advancedConfig = advanceInstallmentExpenses(config);
    const nextMonth = createFinancialCycle(advancedConfig, previousMonthDebt, receivedAt);
    const nextConfig = startPendingInstallmentExpenses(
      {
        ...advancedConfig,
        updatedAt: new Date().toISOString(),
      },
      nextMonth.id,
    );

    await Promise.all([
      financialStorage.saveConfig(nextConfig),
      financialStorage.saveActiveMonth(nextMonth),
    ]);
    set({ config: nextConfig, activeMonth: nextMonth });
  },

  async receiveIncomeEarly(receivedAt = new Date()) {
    const { config, activeMonth, months } = get();

    if (!config) {
      throw new Error('Configure renda, fixos e meta antes de receber.');
    }

    if (!activeMonth) {
      throw new Error('Nenhum ciclo ativo para antecipar.');
    }

    if (!canReceiveIncomeEarly(receivedAt)) {
      throw new Error('Recebimento antecipado so fica disponivel antes do dia 7.');
    }

    const { previousCycleExpenses, nextCycleExpenses } = splitExpensesByDate(
      activeMonth.expenses,
      receivedAt,
    );
    const closedMonth: FinancialMonth = {
      ...activeMonth,
      expenses: previousCycleExpenses,
      status: 'closed',
      closedAt: new Date().toISOString(),
      finalBalance: calculateFinalBalance({ ...activeMonth, expenses: previousCycleExpenses }),
    };
    const nextMonths = [...months, closedMonth];
    const previousMonthDebt = calculatePreviousMonthDebt(closedMonth);
    const advancedConfig = advanceInstallmentExpenses(config);
    const nextMonth = createFinancialCycle(
      advancedConfig,
      previousMonthDebt,
      receivedAt,
      nextCycleExpenses,
    );
    const nextConfig = startPendingInstallmentExpenses(
      {
        ...advancedConfig,
        updatedAt: new Date().toISOString(),
      },
      nextMonth.id,
    );

    await Promise.all([
      financialStorage.saveConfig(nextConfig),
      financialStorage.saveMonths(nextMonths),
      financialStorage.saveActiveMonth(nextMonth),
    ]);

    set({ config: nextConfig, months: nextMonths, activeMonth: nextMonth });
  },

  async addExpense(input) {
    const { activeMonth } = get();

    if (!activeMonth) {
      throw new Error('Nenhum ciclo ativo para receber gastos.');
    }

    validateExpenseDateWithinActiveMonth(activeMonth, input.date);

    const expense = buildExpenseRecord(input);

    const updatedMonth: FinancialMonth = {
      ...activeMonth,
      expenses: [...activeMonth.expenses, expense],
    };

    await financialStorage.saveActiveMonth(updatedMonth);
    set({ activeMonth: updatedMonth });
  },

  async updateExpense(expenseId, input) {
    const { activeMonth } = get();

    if (!activeMonth) {
      throw new Error('Nenhum ciclo ativo para atualizar gastos.');
    }

    const existingExpense = activeMonth.expenses.find((expense) => expense.id === expenseId);

    if (!existingExpense) {
      throw new Error('Gasto nao encontrado.');
    }

    validateExpenseDateWithinActiveMonth(activeMonth, input.date);

    const updatedExpense = buildExpenseRecord(input, existingExpense);
    const updatedMonth: FinancialMonth = {
      ...activeMonth,
      expenses: activeMonth.expenses.map((expense) =>
        expense.id === expenseId ? updatedExpense : expense,
      ),
    };

    await financialStorage.saveActiveMonth(updatedMonth);
    set({ activeMonth: updatedMonth });
  },

  async closeActiveMonth() {
    const { activeMonth, months } = get();

    if (!activeMonth) {
      throw new Error('Nenhum ciclo ativo para fechar.');
    }

    const closedMonth: FinancialMonth = {
      ...activeMonth,
      status: 'closed',
      closedAt: new Date().toISOString(),
      finalBalance: calculateFinalBalance(activeMonth),
    };

    const nextMonths = [...months, closedMonth];
    await Promise.all([
      financialStorage.saveMonths(nextMonths),
      financialStorage.saveActiveMonth(null),
    ]);

    set({ months: nextMonths, activeMonth: null });
  },
}));

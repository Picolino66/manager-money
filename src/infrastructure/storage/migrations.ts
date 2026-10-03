import {
  buildLegacyFinancialCycleDates,
  calculateFixedExpensesTotal,
} from '../../domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_PAYDAY,
  Expense,
  FinancialMonth,
  FixedExpense,
  IncomeSource,
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

/** Renda única (v1/v2) vira a primeira fonte de renda (BR-FIN-018). */
export function legacyIncomeSources(
  monthlyIncome: number,
  payday: number = DEFAULT_PAYDAY,
): IncomeSource[] {
  return [{ id: 'income-legacy', name: 'Renda', amount: Math.max(0, monthlyIncome), payday }];
}

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
      incomeSources: legacyIncomeSources(config.monthlyIncome),
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

/**
 * Migração v2 → v3 (documento bruto): `settings.monthlyIncome` vira uma fonte de renda e o
 * registro fica pendente de envio para levar `income_sources` ao servidor.
 */
export function migrateV2ToV3(raw: unknown, now: Date): unknown {
  const document = raw as { settings?: Record<string, unknown> | null };
  const { settings } = document;

  if (!settings || typeof settings !== 'object') {
    return { ...document, schemaVersion: 3 };
  }

  return {
    ...document,
    schemaVersion: 3,
    settings: {
      ...settings,
      incomeSources: legacyIncomeSources(
        Number(settings.monthlyIncome) || 0,
        Number(settings.payday) || DEFAULT_PAYDAY,
      ),
      updatedAt: now.toISOString(),
      dirty: true,
    },
  };
}

/** Migração v3 → v4 (documento bruto): cartões de crédito e compras no cartão (ADR-014). */
export function migrateV3ToV4(raw: unknown): unknown {
  const document = raw as { sync?: { cursors?: Record<string, unknown> } };
  const sync = document.sync ?? {};

  return {
    ...document,
    schemaVersion: 4,
    creditCards: [],
    cardPurchases: [],
    sync: {
      ...sync,
      cursors: { ...sync.cursors, credit_cards: null, card_purchases: null },
    },
  };
}

/**
 * Migração v4 → v5 (documento bruto, ADR-015): despesas fixas deixam de descontar o saldo na
 * abertura do ciclo (só ao pagar). O ciclo ativo recupera o valor que já havia sido descontado,
 * para o usuário confirmar os pagamentos sem contar duas vezes.
 */
export function migrateV4ToV5(raw: unknown, now: Date): unknown {
  const document = raw as {
    fixedExpenses?: unknown[];
    cycles?: { status?: string; deletedAt?: string | null; initialAvailableAmount?: number }[];
    sync?: { cursors?: Record<string, unknown> };
  };
  const sync = document.sync ?? {};
  const plannedFixed = calculateFixedExpensesTotal({
    fixedExpenses: (document.fixedExpenses ?? []).filter(
      (expense) => (expense as { deletedAt?: string | null }).deletedAt === null,
    ) as FixedExpense[],
  });
  let restored = false;

  return {
    ...document,
    schemaVersion: 5,
    fixedPayments: [],
    extraIncomes: [],
    cycles: (document.cycles ?? []).map((cycle) => {
      if (restored || cycle.status !== 'active' || cycle.deletedAt !== null || plannedFixed === 0) {
        return cycle;
      }

      restored = true;

      return {
        ...cycle,
        initialAvailableAmount: Number(cycle.initialAvailableAmount) + plannedFixed,
        updatedAt: now.toISOString(),
        dirty: true,
      };
    }),
    sync: {
      ...sync,
      cursors: { ...sync.cursors, fixed_payments: null, extra_incomes: null },
    },
  };
}

/**
 * Migração v5 → v6 (documento bruto, ADR-016): cada fonte de renda ganha o dia de pagamento,
 * herdando o dia global atual, então nenhum ciclo muda. `settings` fica pendente de envio.
 */
export function migrateV5ToV6(raw: unknown, now: Date): unknown {
  const document = raw as { settings?: Record<string, unknown> | null };
  const { settings } = document;

  if (!settings || typeof settings !== 'object') {
    return { ...document, schemaVersion: 6 };
  }

  const payday = Number(settings.payday) || DEFAULT_PAYDAY;
  const sources = Array.isArray(settings.incomeSources) ? settings.incomeSources : [];

  return {
    ...document,
    schemaVersion: 6,
    settings: {
      ...settings,
      incomeSources: sources.map((source: Record<string, unknown>) => ({ ...source, payday })),
      updatedAt: now.toISOString(),
      dirty: true,
    },
  };
}

/** Encadeia as migrações do documento bruto até a versão atual; `null` se já está atual. */
export function migrateDocument(raw: unknown, now: Date): unknown | null {
  let document = raw;
  let version = (document as { schemaVersion?: unknown } | null)?.schemaVersion;

  if (version === 2) {
    document = migrateV2ToV3(document, now);
    version = 3;
  }

  if (version === 3) {
    document = migrateV3ToV4(document);
    version = 4;
  }

  if (version === 4) {
    document = migrateV4ToV5(document, now);
    version = 5;
  }

  if (version === 5) {
    document = migrateV5ToV6(document, now);
    version = 6;
  }

  return document === raw ? null : document;
}

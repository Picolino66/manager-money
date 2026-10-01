import {
  Expense,
  FinancialMonth,
  FixedExpense,
  MoneyCents,
} from '../domain/financial/financial.types';

export const STATE_SCHEMA_VERSION = 2;

/** Metadados de sincronização presentes em todo registro persistido (ADR-004). */
export type SyncMeta = {
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
};

export type SettingsRecord = SyncMeta & {
  monthlyIncome: MoneyCents;
  savingGoal: MoneyCents;
  payday: number;
  customCategories: string[];
};

export type FixedExpenseRecord = FixedExpense & SyncMeta;

export type CycleRecord = Omit<FinancialMonth, 'expenses'> & SyncMeta;

export type ExpenseRecord = Expense & SyncMeta & { cycleId: string };

export const SYNC_TABLES = ['settings', 'fixed_expenses', 'cycles', 'expenses'] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export type SyncState = {
  userId: string | null;
  cursors: Record<SyncTable, string | null>;
  lastSyncAt: string | null;
  lastError: string | null;
};

/** Documento local único (ADR-003 / contracts.md §4). */
export type LocalState = {
  schemaVersion: typeof STATE_SCHEMA_VERSION;
  settings: SettingsRecord | null;
  fixedExpenses: FixedExpenseRecord[];
  cycles: CycleRecord[];
  expenses: ExpenseRecord[];
  sync: SyncState;
};

export type UseCaseContext = {
  now: Date;
  newId: (prefix: string) => string;
};

export function createEmptySyncState(userId: string | null = null): SyncState {
  return {
    userId,
    cursors: { settings: null, fixed_expenses: null, cycles: null, expenses: null },
    lastSyncAt: null,
    lastError: null,
  };
}

export function createEmptyState(): LocalState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: null,
    fixedExpenses: [],
    cycles: [],
    expenses: [],
    sync: createEmptySyncState(),
  };
}

export function createDefaultContext(): UseCaseContext {
  return {
    now: new Date(),
    newId: (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  };
}

export function isLive<T extends { deletedAt: string | null }>(record: T): boolean {
  return record.deletedAt === null;
}

/** Marca um registro como alterado localmente e pendente de envio. */
export function touch<T extends SyncMeta>(record: T, now: Date): T {
  return { ...record, updatedAt: now.toISOString(), dirty: true };
}

export function countPendingChanges(state: LocalState): number {
  return (
    (state.settings?.dirty ? 1 : 0) +
    state.fixedExpenses.filter((record) => record.dirty).length +
    state.cycles.filter((record) => record.dirty).length +
    state.expenses.filter((record) => record.dirty).length
  );
}

export function hasLocalData(state: LocalState): boolean {
  return state.settings !== null || state.cycles.some(isLive);
}

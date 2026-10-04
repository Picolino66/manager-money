import { CardPurchase, CreditCard, StatementPayment } from '../domain/financial/credit-card';
import { ExtraIncome, FixedExpensePayment } from '../domain/financial/payments';
import {
  Expense,
  FinancialMonth,
  FixedExpense,
  IncomeSource,
  MoneyCents,
} from '../domain/financial/financial.types';

export const STATE_SCHEMA_VERSION = 8;

/** Metadados de sincronização presentes em todo registro persistido (ADR-004). */
export type SyncMeta = {
  updatedAt: string;
  deletedAt: string | null;
  dirty: boolean;
};

export type SettingsRecord = SyncMeta & {
  /** Soma de `incomeSources`; mantido para compatibilidade com o contrato remoto v1. */
  monthlyIncome: MoneyCents;
  incomeSources: IncomeSource[];
  savingGoal: MoneyCents;
  payday: number;
  customCategories: string[];
};

export type FixedExpenseRecord = FixedExpense & SyncMeta;

export type CreditCardRecord = CreditCard & SyncMeta;

export type CardPurchaseRecord = CardPurchase & SyncMeta;

export type FixedPaymentRecord = FixedExpensePayment & SyncMeta;

export type StatementPaymentRecord = StatementPayment & SyncMeta;

export type ExtraIncomeRecord = ExtraIncome & SyncMeta;

export type CycleRecord = Omit<FinancialMonth, 'expenses'> & SyncMeta;

export type ExpenseRecord = Expense & SyncMeta & { cycleId: string };

/** Ordem de envio: cartões antes das compras (chave estrangeira). */
export const SYNC_TABLES = [
  'settings',
  'fixed_expenses',
  'credit_cards',
  'cycles',
  'expenses',
  'card_purchases',
  'fixed_payments',
  'extra_incomes',
  'statement_payments',
] as const;

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
  creditCards: CreditCardRecord[];
  cycles: CycleRecord[];
  expenses: ExpenseRecord[];
  cardPurchases: CardPurchaseRecord[];
  fixedPayments: FixedPaymentRecord[];
  extraIncomes: ExtraIncomeRecord[];
  statementPayments: StatementPaymentRecord[];
  sync: SyncState;
};

export type UseCaseContext = {
  now: Date;
  newId: (prefix: string) => string;
};

export function createEmptySyncState(userId: string | null = null): SyncState {
  return {
    userId,
    cursors: {
      settings: null,
      fixed_expenses: null,
      credit_cards: null,
      cycles: null,
      expenses: null,
      card_purchases: null,
      fixed_payments: null,
      extra_incomes: null,
      statement_payments: null,
    },
    lastSyncAt: null,
    lastError: null,
  };
}

export function createEmptyState(): LocalState {
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: null,
    fixedExpenses: [],
    creditCards: [],
    cycles: [],
    expenses: [],
    cardPurchases: [],
    fixedPayments: [],
    extraIncomes: [],
    statementPayments: [],
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
    state.expenses.filter((record) => record.dirty).length +
    state.creditCards.filter((record) => record.dirty).length +
    state.cardPurchases.filter((record) => record.dirty).length +
    state.fixedPayments.filter((record) => record.dirty).length +
    state.extraIncomes.filter((record) => record.dirty).length +
    state.statementPayments.filter((record) => record.dirty).length
  );
}

export function hasLocalData(state: LocalState): boolean {
  return state.settings !== null || state.cycles.some(isLive);
}

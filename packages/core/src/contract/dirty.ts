import { CycleRecord, LocalState, SyncMeta, SyncTable } from '../application/state';
import {
  cardPurchaseToRow,
  creditCardToRow,
  cycleToRow,
  expenseToRow,
  extraIncomeToRow,
  fixedExpenseToRow,
  fixedPaymentToRow,
  settingsToRow,
  statementPaymentToRow,
} from './mappers';
import { RemoteRow } from './types';

/**
 * Registros alterados por um caso de uso (`touch` marca `dirty`). Usado pelo sync do app (outbox) e
 * pela gravação imediata do client web (ADR-022): os dois enviam só o que mudou, na mesma ordem.
 */
export type PushedRef = { id: string; updatedAt: string };

/** Registros pendentes de envio. Em `cycles`, fechados antes de ativos (índice único). */
export function collectDirty(
  state: LocalState,
  table: SyncTable,
  userId: string,
): { refs: PushedRef[]; rows: RemoteRow[] } {
  switch (table) {
    case 'settings': {
      const record = state.settings?.dirty ? state.settings : null;
      return record
        ? {
            refs: [{ id: 'settings', updatedAt: record.updatedAt }],
            rows: [settingsToRow(record, userId)],
          }
        : { refs: [], rows: [] };
    }
    case 'fixed_expenses': {
      const records = state.fixedExpenses.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => fixedExpenseToRow(record, userId)),
      };
    }
    case 'credit_cards': {
      const records = state.creditCards.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => creditCardToRow(record, userId)),
      };
    }
    case 'card_purchases': {
      const records = state.cardPurchases.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => cardPurchaseToRow(record, userId)),
      };
    }
    case 'fixed_payments': {
      const records = state.fixedPayments.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => fixedPaymentToRow(record, userId)),
      };
    }
    case 'extra_incomes': {
      const records = state.extraIncomes.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => extraIncomeToRow(record, userId)),
      };
    }
    case 'statement_payments': {
      const records = state.statementPayments.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => statementPaymentToRow(record, userId)),
      };
    }
    case 'cycles': {
      const order = (cycle: CycleRecord) => (cycle.status === 'closed' || cycle.deletedAt ? 0 : 1);
      const records = state.cycles
        .filter((record) => record.dirty)
        .sort((a, b) => order(a) - order(b));
      return { refs: records.map(ref), rows: records.map((record) => cycleToRow(record, userId)) };
    }
    case 'expenses': {
      const records = state.expenses.filter((record) => record.dirty);
      return {
        refs: records.map(ref),
        rows: records.map((record) => expenseToRow(record, userId)),
      };
    }
  }
}

function ref(record: { id: string } & SyncMeta): PushedRef {
  return { id: record.id, updatedAt: record.updatedAt };
}

/** Marca como limpos os registros enviados que não mudaram desde o envio. */
export function acknowledge(state: LocalState, table: SyncTable, pushed: PushedRef[]): LocalState {
  const sent = new Map(pushed.map((item) => [item.id, item.updatedAt]));
  const clean = <T extends { id: string } & SyncMeta>(record: T): T =>
    record.dirty && sent.get(record.id) === record.updatedAt ? { ...record, dirty: false } : record;

  switch (table) {
    case 'settings':
      return state.settings && sent.get('settings') === state.settings.updatedAt
        ? { ...state, settings: { ...state.settings, dirty: false } }
        : state;
    case 'fixed_expenses':
      return { ...state, fixedExpenses: state.fixedExpenses.map(clean) };
    case 'credit_cards':
      return { ...state, creditCards: state.creditCards.map(clean) };
    case 'card_purchases':
      return { ...state, cardPurchases: state.cardPurchases.map(clean) };
    case 'fixed_payments':
      return { ...state, fixedPayments: state.fixedPayments.map(clean) };
    case 'extra_incomes':
      return { ...state, extraIncomes: state.extraIncomes.map(clean) };
    case 'statement_payments':
      return { ...state, statementPayments: state.statementPayments.map(clean) };
    case 'cycles':
      return { ...state, cycles: state.cycles.map(clean) };
    case 'expenses':
      return { ...state, expenses: state.expenses.map(clean) };
  }
}

/**
 * Estado recém-lido do servidor: nada pendente. O client web usa após montar o estado (e após o
 * recálculo do saldo em memória), para que só as mudanças do próximo caso de uso sejam gravadas.
 */
export function markAllClean(state: LocalState): LocalState {
  const clean = <T extends SyncMeta>(record: T): T =>
    record.dirty ? { ...record, dirty: false } : record;

  return {
    ...state,
    settings: state.settings ? clean(state.settings) : null,
    fixedExpenses: state.fixedExpenses.map(clean),
    creditCards: state.creditCards.map(clean),
    cycles: state.cycles.map(clean),
    expenses: state.expenses.map(clean),
    cardPurchases: state.cardPurchases.map(clean),
    fixedPayments: state.fixedPayments.map(clean),
    extraIncomes: state.extraIncomes.map(clean),
    statementPayments: state.statementPayments.map(clean),
  };
}

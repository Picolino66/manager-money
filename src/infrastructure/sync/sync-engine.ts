import {
  createEmptyState,
  createEmptySyncState,
  CycleRecord,
  hasLocalData,
  isLive,
  LocalState,
  SYNC_TABLES,
  SyncMeta,
  SyncTable,
  touch,
} from '../../application/state';
import { logger } from '../monitoring/logger';
import {
  cardPurchaseFromRow,
  cardPurchaseToRow,
  creditCardFromRow,
  creditCardToRow,
  cycleFromRow,
  cycleToRow,
  expenseFromRow,
  expenseToRow,
  extraIncomeFromRow,
  extraIncomeToRow,
  fixedExpenseFromRow,
  fixedExpenseToRow,
  fixedPaymentFromRow,
  fixedPaymentToRow,
  settingsFromRow,
  settingsToRow,
} from './mappers';
import {
  CardPurchaseRow,
  CreditCardRow,
  CycleRow,
  ExpenseRow,
  ExtraIncomeRow,
  FixedExpenseRow,
  FixedPaymentRow,
  RemoteRow,
  SettingsRow,
  SyncError,
  SyncRemote,
} from './types';

/**
 * Acesso ao estado vivo da store. O sync lê o estado atual a cada passo e aplica
 * atualizações funcionais, para nunca sobrescrever escritas feitas durante a rede.
 */
export type StateAccess = {
  get(): LocalState;
  commit(update: (state: LocalState) => LocalState): Promise<void>;
};

export type SyncOutcome = { ok: true } | { ok: false; code: string };

type PushedRef = { id: string; updatedAt: string };

// ---------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------

/** Registros pendentes de envio. Em `cycles`, fechados antes de ativos (índice único). */
export function collectDirty(state: LocalState, table: SyncTable, userId: string): { refs: PushedRef[]; rows: RemoteRow[] } {
  switch (table) {
    case 'settings': {
      const record = state.settings?.dirty ? state.settings : null;
      return record
        ? { refs: [{ id: 'settings', updatedAt: record.updatedAt }], rows: [settingsToRow(record, userId)] }
        : { refs: [], rows: [] };
    }
    case 'fixed_expenses': {
      const records = state.fixedExpenses.filter((record) => record.dirty);
      return { refs: records.map(ref), rows: records.map((record) => fixedExpenseToRow(record, userId)) };
    }
    case 'credit_cards': {
      const records = state.creditCards.filter((record) => record.dirty);
      return { refs: records.map(ref), rows: records.map((record) => creditCardToRow(record, userId)) };
    }
    case 'card_purchases': {
      const records = state.cardPurchases.filter((record) => record.dirty);
      return { refs: records.map(ref), rows: records.map((record) => cardPurchaseToRow(record, userId)) };
    }
    case 'fixed_payments': {
      const records = state.fixedPayments.filter((record) => record.dirty);
      return { refs: records.map(ref), rows: records.map((record) => fixedPaymentToRow(record, userId)) };
    }
    case 'extra_incomes': {
      const records = state.extraIncomes.filter((record) => record.dirty);
      return { refs: records.map(ref), rows: records.map((record) => extraIncomeToRow(record, userId)) };
    }
    case 'cycles': {
      const order = (cycle: CycleRecord) => (cycle.status === 'closed' || cycle.deletedAt ? 0 : 1);
      const records = state.cycles.filter((record) => record.dirty).sort((a, b) => order(a) - order(b));
      return { refs: records.map(ref), rows: records.map((record) => cycleToRow(record, userId)) };
    }
    case 'expenses': {
      const records = state.expenses.filter((record) => record.dirty);
      return { refs: records.map(ref), rows: records.map((record) => expenseToRow(record, userId)) };
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
    case 'cycles':
      return { ...state, cycles: state.cycles.map(clean) };
    case 'expenses':
      return { ...state, expenses: state.expenses.map(clean) };
  }
}

function mergeRecords<T extends { id: string } & SyncMeta>(local: T[], remote: T[]): T[] {
  const result = [...local];

  for (const incoming of remote) {
    const index = result.findIndex((record) => record.id === incoming.id);
    const current = index >= 0 ? result[index] : undefined;

    if (current?.dirty) {
      continue; // BR-SYNC-002: alteração local pendente vence até ser enviada.
    }

    if (!current) {
      if (incoming.deletedAt === null) result.push(incoming);
      continue;
    }

    result[index] = incoming;
  }

  return result;
}

function maxCursor(current: string | null, rows: RemoteRow[]): string | null {
  return rows.reduce<string | null>((cursor, row) => {
    const value = row.server_updated_at;
    return value && (!cursor || value > cursor) ? value : cursor;
  }, current);
}

/** Aplica linhas remotas ao estado local e avança o cursor da tabela. */
export function applyRemoteRows(state: LocalState, table: SyncTable, rows: RemoteRow[]): LocalState {
  let next: LocalState = state;

  switch (table) {
    case 'settings': {
      const row = rows[rows.length - 1] as SettingsRow | undefined;
      if (row && !state.settings?.dirty) next = { ...state, settings: settingsFromRow(row) };
      break;
    }
    case 'fixed_expenses':
      next = {
        ...state,
        fixedExpenses: mergeRecords(state.fixedExpenses, (rows as FixedExpenseRow[]).map(fixedExpenseFromRow)),
      };
      break;
    case 'credit_cards':
      next = {
        ...state,
        creditCards: mergeRecords(state.creditCards, (rows as CreditCardRow[]).map(creditCardFromRow)),
      };
      break;
    case 'card_purchases':
      next = {
        ...state,
        cardPurchases: mergeRecords(state.cardPurchases, (rows as CardPurchaseRow[]).map(cardPurchaseFromRow)),
      };
      break;
    case 'fixed_payments':
      next = {
        ...state,
        fixedPayments: mergeRecords(state.fixedPayments, (rows as FixedPaymentRow[]).map(fixedPaymentFromRow)),
      };
      break;
    case 'extra_incomes':
      next = {
        ...state,
        extraIncomes: mergeRecords(state.extraIncomes, (rows as ExtraIncomeRow[]).map(extraIncomeFromRow)),
      };
      break;
    case 'cycles':
      next = { ...state, cycles: mergeRecords(state.cycles, (rows as CycleRow[]).map(cycleFromRow)) };
      break;
    case 'expenses':
      next = { ...state, expenses: mergeRecords(state.expenses, (rows as ExpenseRow[]).map(expenseFromRow)) };
      break;
  }

  return {
    ...next,
    sync: { ...next.sync, cursors: { ...next.sync.cursors, [table]: maxCursor(next.sync.cursors[table], rows) } },
  };
}

/**
 * ADR-004 §4: outro aparelho já tem um ciclo ativo no servidor. Adota o ciclo remoto,
 * move os gastos do ciclo local duplicado e exclui logicamente o duplicado.
 */
export function adoptRemoteActiveCycle(state: LocalState, remoteCycleId: string, now: Date): LocalState {
  const duplicates = new Set(
    state.cycles
      .filter((cycle) => cycle.id !== remoteCycleId && cycle.status === 'active' && isLive(cycle) && cycle.dirty)
      .map((cycle) => cycle.id),
  );

  if (duplicates.size === 0) return state;

  return {
    ...state,
    cycles: state.cycles.map((cycle) =>
      duplicates.has(cycle.id) ? touch({ ...cycle, deletedAt: now.toISOString() }, now) : cycle,
    ),
    expenses: state.expenses.map((expense) =>
      duplicates.has(expense.cycleId) ? touch({ ...expense, cycleId: remoteCycleId }, now) : expense,
    ),
  };
}

function markAllDirty(state: LocalState): LocalState {
  const dirty = <T extends SyncMeta>(record: T): T => ({ ...record, dirty: true });

  return {
    ...state,
    settings: state.settings ? dirty(state.settings) : null,
    fixedExpenses: state.fixedExpenses.map(dirty),
    creditCards: state.creditCards.map(dirty),
    cycles: state.cycles.map(dirty),
    expenses: state.expenses.map(dirty),
    cardPurchases: state.cardPurchases.map(dirty),
    fixedPayments: state.fixedPayments.map(dirty),
    extraIncomes: state.extraIncomes.map(dirty),
  };
}

// ---------------------------------------------------------------------------
// Vínculo de conta (SPEC-006 primeiro login / SPEC-005 sair)
// ---------------------------------------------------------------------------

export type FirstLoginPlan = 'upload' | 'download' | 'choose';

export async function planFirstLogin(state: LocalState, remote: SyncRemote): Promise<FirstLoginPlan> {
  if (!(await remote.hasData())) return 'upload';
  if (!hasLocalData(state)) return 'download';
  return 'choose';
}

/** Vincula mantendo os dados locais: tudo vira pendente de envio. */
export function linkKeepingLocal(state: LocalState, userId: string): LocalState {
  return { ...markAllDirty(state), sync: createEmptySyncState(userId) };
}

/** Vincula usando os dados da nuvem: descarta os locais e baixa tudo no próximo pull. */
export function linkUsingRemote(userId: string): LocalState {
  return { ...createEmptyState(), sync: createEmptySyncState(userId) };
}

/** Desvincula a conta. Dados mantidos ficam pendentes para um futuro login. */
export function unlinkAccount(state: LocalState, erase: boolean): LocalState {
  return erase ? createEmptyState() : { ...markAllDirty(state), sync: createEmptySyncState(null) };
}

// ---------------------------------------------------------------------------
// Orquestração com I/O
// ---------------------------------------------------------------------------

async function pushTable(access: StateAccess, remote: SyncRemote, table: SyncTable, userId: string) {
  const { refs, rows } = collectDirty(access.get(), table, userId);

  if (rows.length === 0) return;

  await remote.upsert(table, rows as never[]);
  await access.commit((state) => acknowledge(state, table, refs));
}

async function resolveActiveCycleConflict(access: StateAccess, remote: SyncRemote, now: Date) {
  logger.event('sync.conflict', { table: 'cycles' });
  const rows = await remote.pull('cycles', null);
  const remoteActive = rows.find((row) => row.status === 'active' && row.deleted_at === null);

  await access.commit((state) => {
    const merged = applyRemoteRows(state, 'cycles', rows);
    return remoteActive ? adoptRemoteActiveCycle(merged, remoteActive.id, now) : merged;
  });
}

export async function runSync(
  liveAccess: StateAccess,
  remote: SyncRemote,
  clock: () => Date = () => new Date(),
): Promise<SyncOutcome> {
  const userId = liveAccess.get().sync.userId;
  const startedAt = Date.now();

  if (!userId) {
    return { ok: false, code: 'no-user' };
  }

  // Se a conta mudar durante a rede (logout/troca), nenhuma escrita deste sync é aplicada.
  const access: StateAccess = {
    get: liveAccess.get,
    commit: (update) => liveAccess.commit((state) => (state.sync.userId === userId ? update(state) : state)),
  };

  try {
    for (const table of SYNC_TABLES) {
      try {
        await pushTable(access, remote, table, userId);
      } catch (error) {
        if (!(error instanceof SyncError) || error.code !== 'conflict-active-cycle') throw error;
        await resolveActiveCycleConflict(access, remote, clock());
        await pushTable(access, remote, table, userId);
      }
    }

    for (const table of SYNC_TABLES) {
      const rows = await remote.pull(table, access.get().sync.cursors[table]);
      if (rows.length > 0) await access.commit((state) => applyRemoteRows(state, table, rows));
    }

    await access.commit((state) => ({
      ...state,
      sync: { ...state.sync, lastSyncAt: clock().toISOString(), lastError: null },
    }));
    logger.event('sync.run', { ok: true, durationMs: Date.now() - startedAt });

    return { ok: true };
  } catch (error) {
    const code = error instanceof SyncError ? error.code : 'unknown';
    if (!(error instanceof SyncError)) logger.error(error);
    logger.event('sync.run', { ok: false, code, durationMs: Date.now() - startedAt });
    await access.commit((state) => ({ ...state, sync: { ...state.sync, lastError: code } }));

    return { ok: false, code };
  }
}

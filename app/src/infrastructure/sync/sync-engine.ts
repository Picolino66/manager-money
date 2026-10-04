import { recalculateActiveCycleBalance } from '@manager-money/core/application/cycle.use-cases';
import {
  createDefaultContext,
  createEmptyState,
  createEmptySyncState,
  hasLocalData,
  isLive,
  LocalState,
  SYNC_TABLES,
  SyncMeta,
  SyncTable,
  touch,
} from '@manager-money/core/application/state';
import { acknowledge, collectDirty } from '@manager-money/core/contract/dirty';
import { logger } from '../monitoring/logger';
import {
  cardPurchaseFromRow,
  creditCardFromRow,
  cycleFromRow,
  expenseFromRow,
  extraIncomeFromRow,
  fixedExpenseFromRow,
  fixedPaymentFromRow,
  settingsFromRow,
  statementPaymentFromRow,
} from '@manager-money/core/contract/mappers';
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
  StatementPaymentRow,
  SyncError,
  SyncRemote,
} from '@manager-money/core/contract/types';

/**
 * Acesso ao estado vivo da store. O sync lê o estado atual a cada passo e aplica
 * atualizações funcionais, para nunca sobrescrever escritas feitas durante a rede.
 */
export type StateAccess = {
  get(): LocalState;
  commit(update: (state: LocalState) => LocalState): Promise<void>;
};

export type SyncOutcome = { ok: true } | { ok: false; code: string };

// ---------------------------------------------------------------------------
// Funções puras
// ---------------------------------------------------------------------------

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
export function applyRemoteRows(
  state: LocalState,
  table: SyncTable,
  rows: RemoteRow[],
): LocalState {
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
        fixedExpenses: mergeRecords(
          state.fixedExpenses,
          (rows as FixedExpenseRow[]).map(fixedExpenseFromRow),
        ),
      };
      break;
    case 'credit_cards':
      next = {
        ...state,
        creditCards: mergeRecords(
          state.creditCards,
          (rows as CreditCardRow[]).map(creditCardFromRow),
        ),
      };
      break;
    case 'card_purchases':
      next = {
        ...state,
        cardPurchases: mergeRecords(
          state.cardPurchases,
          (rows as CardPurchaseRow[]).map((row) =>
            cardPurchaseFromRow(
              row,
              (cardId) => state.creditCards.find((card) => card.id === cardId)?.closingDay,
            ),
          ),
        ),
      };
      break;
    case 'fixed_payments':
      next = {
        ...state,
        fixedPayments: mergeRecords(
          state.fixedPayments,
          (rows as FixedPaymentRow[]).map(fixedPaymentFromRow),
        ),
      };
      break;
    case 'extra_incomes':
      next = {
        ...state,
        extraIncomes: mergeRecords(
          state.extraIncomes,
          (rows as ExtraIncomeRow[]).map(extraIncomeFromRow),
        ),
      };
      break;
    case 'statement_payments':
      next = {
        ...state,
        statementPayments: mergeRecords(
          state.statementPayments,
          (rows as StatementPaymentRow[]).map(statementPaymentFromRow),
        ),
      };
      break;
    case 'cycles':
      next = {
        ...state,
        cycles: mergeRecords(state.cycles, (rows as CycleRow[]).map(cycleFromRow)),
      };
      break;
    case 'expenses':
      next = {
        ...state,
        expenses: mergeRecords(state.expenses, (rows as ExpenseRow[]).map(expenseFromRow)),
      };
      break;
  }

  return {
    ...next,
    sync: {
      ...next.sync,
      cursors: { ...next.sync.cursors, [table]: maxCursor(next.sync.cursors[table], rows) },
    },
  };
}

/**
 * ADR-004 §4: outro aparelho já tem um ciclo ativo no servidor. Adota o ciclo remoto, move os
 * gastos, pagamentos de fixas, rendas avulsas e pagamentos de fatura do ciclo local duplicado e
 * exclui logicamente o duplicado. O saldo é recalculado ao fim do sync.
 */
export function adoptRemoteActiveCycle(
  state: LocalState,
  remoteCycleId: string,
  now: Date,
): LocalState {
  const duplicates = new Set(
    state.cycles
      .filter(
        (cycle) =>
          cycle.id !== remoteCycleId && cycle.status === 'active' && isLive(cycle) && cycle.dirty,
      )
      .map((cycle) => cycle.id),
  );

  if (duplicates.size === 0) return state;

  const moveTo = <T extends SyncMeta & { cycleId: string }>(record: T): T =>
    duplicates.has(record.cycleId) ? touch({ ...record, cycleId: remoteCycleId }, now) : record;

  return {
    ...state,
    cycles: state.cycles.map((cycle) =>
      duplicates.has(cycle.id) ? touch({ ...cycle, deletedAt: now.toISOString() }, now) : cycle,
    ),
    expenses: state.expenses.map(moveTo),
    fixedPayments: state.fixedPayments.map(moveTo),
    extraIncomes: state.extraIncomes.map(moveTo),
    statementPayments: state.statementPayments.map(moveTo),
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
    statementPayments: state.statementPayments.map(dirty),
  };
}

// ---------------------------------------------------------------------------
// Vínculo de conta (SPEC-006 primeiro login / SPEC-005 sair)
// ---------------------------------------------------------------------------

export type FirstLoginPlan = 'upload' | 'download' | 'choose';

export async function planFirstLogin(
  state: LocalState,
  remote: SyncRemote,
): Promise<FirstLoginPlan> {
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

async function pushTable(
  access: StateAccess,
  remote: SyncRemote,
  table: SyncTable,
  userId: string,
) {
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
    commit: (update) =>
      liveAccess.commit((state) => (state.sync.userId === userId ? update(state) : state)),
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

    // O saldo do ciclo ativo é derivado: recalcula com o que chegou de outros aparelhos (BR-FIN-005).
    await access.commit((state) =>
      recalculateActiveCycleBalance(state, { ...createDefaultContext(), now: clock() }),
    );

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

import { create } from 'zustand';

import * as useCases from '../application/cycle.use-cases';
import { selectActiveMonth, selectClosedMonths, selectConfig } from '../application/selectors';
import {
  countPendingChanges,
  createDefaultContext,
  createEmptyState,
  LocalState,
  UseCaseContext,
} from '../application/state';
import {
  ExpenseInput,
  FinancialConfig,
  FinancialConfigInput,
  FinancialMonth,
} from '../domain/financial/financial.types';
import { buildExportPayload, exportFileName, shareJson } from '../infrastructure/export/share-json';
import { logger } from '../infrastructure/monitoring/logger';
import { localStore } from '../infrastructure/storage/local-store';
import { runSync, SyncOutcome } from '../infrastructure/sync/sync-engine';
import { SyncRemote } from '../infrastructure/sync/types';

type FinancialState = {
  doc: LocalState;
  config: FinancialConfig | null;
  activeMonth: FinancialMonth | null;
  months: FinancialMonth[];
  pendingChanges: number;
  isLoading: boolean;
  loadError: string | null;
  isSyncing: boolean;
  loadAppData: () => Promise<void>;
  saveConfig: (config: FinancialConfigInput) => Promise<void>;
  addCategory: (category: string) => Promise<void>;
  startFinancialCycle: () => Promise<void>;
  receiveIncomeEarly: () => Promise<void>;
  addExpense: (expense: ExpenseInput) => Promise<void>;
  updateExpense: (expenseId: string, expense: ExpenseInput) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  closeActiveMonth: () => Promise<void>;
  exportData: () => Promise<void>;
  exportRawData: () => Promise<void>;
  /** Substitui o documento inteiro (vínculo/desvínculo de conta). */
  replaceDocument: (update: (doc: LocalState) => LocalState) => Promise<void>;
  setSyncRemote: (remote: SyncRemote | null) => void;
  syncNow: () => Promise<SyncOutcome>;
  scheduleSync: (delayMs?: number) => void;
};

const SYNC_DEBOUNCE_MS = 2_000;
const MAX_BACKOFF_MS = 60_000;

let contextFactory: () => UseCaseContext = createDefaultContext;
let writeQueue: Promise<unknown> = Promise.resolve();
let syncRemote: SyncRemote | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let backoffMs = 0;

/** Permite relógio e IDs determinísticos em testes. */
export function setUseCaseContextFactory(factory: () => UseCaseContext) {
  contextFactory = factory;
}

function derive(doc: LocalState) {
  return {
    doc,
    config: selectConfig(doc),
    activeMonth: selectActiveMonth(doc),
    months: selectClosedMonths(doc),
    pendingChanges: countPendingChanges(doc),
  };
}

export const useFinancialStore = create<FinancialState>((set, get) => {
  /**
   * Aplica uma atualização sobre o documento mais recente, grava (1 setItem, ADR-003) e
   * publica o novo estado. Escritas são serializadas para não perder atualizações.
   */
  function commit(update: (doc: LocalState) => LocalState, options = { sync: true }): Promise<void> {
    const task = writeQueue.then(async () => {
      const next = update(get().doc);

      if (next === get().doc) return;

      await localStore.save(next);
      set(derive(next));

      if (options.sync) get().scheduleSync();
    });

    writeQueue = task.catch(() => undefined);

    return task;
  }

  function run(useCase: (doc: LocalState, ctx: UseCaseContext) => LocalState) {
    return commit((doc) => useCase(doc, contextFactory()));
  }

  return {
    ...derive(createEmptyState()),
    isLoading: true,
    loadError: null,
    isSyncing: false,

    async loadAppData() {
      set({ isLoading: true, loadError: null });
      const startedAt = Date.now();

      try {
        const result = await localStore.load();

        if (result.status === 'corrupted') {
          set({ isLoading: false, loadError: 'Não foi possível ler os dados salvos neste aparelho.' });
          return;
        }

        set({ ...derive(result.state), isLoading: false });
        logger.event('app.load', { ok: true, durationMs: Date.now() - startedAt });
        get().scheduleSync(0);
      } catch (error) {
        logger.error(error);
        set({ isLoading: false, loadError: 'Não foi possível ler os dados salvos neste aparelho.' });
      }
    },

    saveConfig: (input) => run((doc, ctx) => useCases.saveConfig(doc, input, ctx)),
    addCategory: (name) => run((doc, ctx) => useCases.addCategory(doc, name, ctx)),
    startFinancialCycle: () => run((doc, ctx) => useCases.openCycle(doc, ctx)),
    receiveIncomeEarly: () => run((doc, ctx) => useCases.receiveIncomeEarly(doc, ctx)),
    addExpense: (input) => run((doc, ctx) => useCases.addExpense(doc, input, ctx)),
    updateExpense: (id, input) => run((doc, ctx) => useCases.updateExpense(doc, id, input, ctx)),
    deleteExpense: (id) => run((doc, ctx) => useCases.deleteExpense(doc, id, ctx)),
    closeActiveMonth: () => run((doc, ctx) => useCases.closeCycle(doc, ctx)),

    async exportData() {
      const now = new Date();
      await shareJson(exportFileName(now), buildExportPayload(get().doc, now));
      logger.event('account.export', { ok: true });
    },

    async exportRawData() {
      const raw = (await localStore.readRaw()) ?? '{}';
      await shareJson(`manager-money-recuperacao-${Date.now()}.json`, raw);
    },

    replaceDocument: (update) => commit(update),

    setSyncRemote(remote) {
      syncRemote = remote;
      backoffMs = 0;
      if (remote) get().scheduleSync(0);
    },

    scheduleSync(delayMs = SYNC_DEBOUNCE_MS) {
      if (!syncRemote || !get().doc.sync.userId) return;
      if (syncTimer) clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        syncTimer = null;
        void get().syncNow();
      }, delayMs);
    },

    async syncNow() {
      if (!syncRemote) return { ok: false, code: 'disabled' };
      if (get().isSyncing) return { ok: false, code: 'busy' };

      set({ isSyncing: true });
      const outcome = await runSync(
        { get: () => get().doc, commit: (update) => commit(update, { sync: false }) },
        syncRemote,
      );
      set({ isSyncing: false });

      if (outcome.ok) {
        backoffMs = 0;
        if (get().pendingChanges > 0) get().scheduleSync();
      } else if (outcome.code === 'network' || outcome.code === 'unknown') {
        backoffMs = Math.min(MAX_BACKOFF_MS, backoffMs ? backoffMs * 2 : SYNC_DEBOUNCE_MS);
        get().scheduleSync(backoffMs);
      }

      return outcome;
    },
  };
});

import { addExpense, deleteExpense, openCycle, receiveIncomeEarly, saveConfig } from '../../application/cycle.use-cases';
import { selectActiveMonth } from '../../application/selectors';
import { countPendingChanges, createEmptyState, LocalState, UseCaseContext } from '../../application/state';
import { FinancialConfigInput } from '../../domain/financial/financial.types';
import { MemoryRemote, MemoryServer } from './memory-remote';
import { settingsToRow } from './mappers';
import {
  acknowledge,
  applyRemoteRows,
  collectDirty,
  linkKeepingLocal,
  linkUsingRemote,
  planFirstLogin,
  runSync,
  StateAccess,
  unlinkAccount,
} from './sync-engine';

const USER = 'user-a';
let sequence = 0;

function ctx(year: number, month: number, day: number, device = 'x'): UseCaseContext {
  return { now: new Date(year, month - 1, day, 12), newId: (prefix) => `${prefix}-${device}-${++sequence}` };
}

const config: FinancialConfigInput = {
  monthlyIncome: 500000,
  savingGoal: 0,
  payday: 7,
  customCategories: [],
  fixedExpenses: [
    { id: 'tv', type: 'installment', name: 'TV', category: 'Lazer', installmentAmount: 10000, totalInstallments: 5, remainingInstallments: 5 },
  ],
};

/** Aparelho simulado: estado em memória + acesso no formato usado pela store. */
class Device {
  constructor(
    public state: LocalState,
    public remote: MemoryRemote,
  ) {}

  access: StateAccess = {
    get: () => this.state,
    commit: async (update) => {
      this.state = update(this.state);
    },
  };

  sync() {
    return runSync(this.access, this.remote, () => new Date(2026, 10, 1, 12));
  }

  apply(update: (state: LocalState) => LocalState) {
    this.state = update(this.state);
  }
}

function linkedDevice(server: MemoryServer, state = createEmptyState()) {
  return new Device(linkKeepingLocal(state, USER), server.clientFor(USER));
}

beforeEach(() => {
  sequence = 0;
});

describe('runSync (SPEC-006)', () => {
  it('sem usuário vinculado não faz nada', async () => {
    const server = new MemoryServer();
    const device = new Device(createEmptyState(), server.clientFor(USER));
    expect(await device.sync()).toEqual({ ok: false, code: 'no-user' });
  });

  it('dois aparelhos convergem', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server);
    a.apply((s) => openCycle(saveConfig(s, config, ctx(2026, 10, 10, 'a')), ctx(2026, 10, 10, 'a')));
    a.apply((s) => addExpense(s, { amount: 1000, category: 'Lazer', description: 'Cinema', date: '2026-10-11' }, ctx(2026, 10, 11, 'a')));
    expect(await a.sync()).toEqual({ ok: true });
    expect(countPendingChanges(a.state)).toBe(0);

    const b = new Device(linkUsingRemote(USER), server.clientFor(USER));
    await b.sync();
    expect(selectActiveMonth(b.state)?.expenses.map((e) => e.description)).toEqual(['Cinema']);

    b.apply((s) => addExpense(s, { amount: 500, category: 'Outros', description: 'Pão', date: '2026-10-12' }, ctx(2026, 10, 12, 'b')));
    const firstId = selectActiveMonth(b.state)!.expenses[0]!.id;
    b.apply((s) => deleteExpense(s, firstId, ctx(2026, 10, 12, 'b')));
    await b.sync();
    await a.sync();

    expect(selectActiveMonth(a.state)?.expenses.map((e) => e.description)).toEqual(['Pão']);
    expect(selectActiveMonth(a.state)?.initialAvailableAmount).toBe(selectActiveMonth(b.state)?.initialAvailableAmount);
  });

  it('registro sujo local não é sobrescrito pelo pull; limpo é atualizado', () => {
    const local = linkKeepingLocal(saveConfig(createEmptyState(), config, ctx(2026, 10, 10)), USER);
    const remoteRow = {
      ...settingsToRow({ ...local.settings!, monthlyIncome: 999 }, USER),
      server_updated_at: '2030-01-01T00:00:00.000Z',
    };
    const dirtyResult = applyRemoteRows(local, 'settings', [remoteRow]);
    expect(dirtyResult.settings?.monthlyIncome).toBe(500000);
    expect(dirtyResult.sync.cursors.settings).toBe('2030-01-01T00:00:00.000Z');

    const clean = acknowledge(local, 'settings', [{ id: 'settings', updatedAt: local.settings!.updatedAt }]);
    expect(applyRemoteRows(clean, 'settings', [remoteRow]).settings?.monthlyIncome).toBe(999);
  });

  it('LWW: o último push vence entre aparelhos', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server);
    a.apply((s) => saveConfig(s, config, ctx(2026, 10, 10, 'a')));
    await a.sync();
    const b = new Device(linkUsingRemote(USER), server.clientFor(USER));
    await b.sync();
    b.apply((s) => saveConfig(s, { ...config, monthlyIncome: 600000 }, ctx(2026, 10, 11, 'b')));
    a.apply((s) => saveConfig(s, { ...config, monthlyIncome: 700000 }, ctx(2026, 10, 11, 'a')));
    await b.sync();
    await a.sync();
    await b.sync();
    expect(a.state.settings?.monthlyIncome).toBe(700000);
    expect(b.state.settings?.monthlyIncome).toBe(700000);
  });

  it('linhas excluídas desconhecidas não são inseridas', () => {
    const state = linkUsingRemote(USER);
    const row = {
      user_id: USER, id: 'x', cycle_id: 'c', amount: 1, category: 'Outros', description: 'x',
      date: '2026-10-10', created_at: 'a', client_updated_at: 'a', deleted_at: 'a', server_updated_at: 'z',
    };
    expect(applyRemoteRows(state, 'expenses', [row]).expenses).toHaveLength(0);
  });

  it('receber antecipado envia fechado antes do ativo (sem 23505)', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server);
    a.apply((s) => openCycle(saveConfig(s, config, ctx(2026, 10, 10)), ctx(2026, 10, 10)));
    await a.sync();
    a.apply((s) => receiveIncomeEarly(s, ctx(2026, 11, 3)));
    expect(await a.sync()).toEqual({ ok: true });
    const cyclesUpsert = a.remote.calls.filter((call) => call.op === 'upsert' && call.table === 'cycles').pop();
    expect(cyclesUpsert?.ids).toHaveLength(2);
    expect(server.store(USER).cycles.filter((c) => c.status === 'active')).toHaveLength(1);
  });

  it('conflito de ciclo ativo concorrente é resolvido sem perder gastos', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server);
    a.apply((s) => saveConfig(s, config, ctx(2026, 10, 10)));
    await a.sync();
    const b = new Device(linkUsingRemote(USER), server.clientFor(USER));
    await b.sync();

    a.apply((s) => openCycle(s, ctx(2026, 10, 10, 'a')));
    b.apply((s) => openCycle(s, ctx(2026, 10, 10, 'b')));
    b.apply((s) => addExpense(s, { amount: 700, category: 'Outros', description: 'Offline', date: '2026-10-10' }, ctx(2026, 10, 10, 'b')));
    await a.sync();
    expect(await b.sync()).toEqual({ ok: true });

    const remoteActive = server.store(USER).cycles.filter((c) => c.status === 'active' && c.deleted_at === null);
    expect(remoteActive).toHaveLength(1);
    expect(selectActiveMonth(b.state)?.id).toBe(remoteActive[0]?.id);
    expect(selectActiveMonth(b.state)?.expenses.map((e) => e.description)).toEqual(['Offline']);
    await a.sync();
    expect(selectActiveMonth(a.state)?.expenses.map((e) => e.description)).toEqual(['Offline']);
  });

  it('falha de rede mantém pendências e registra o erro', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server);
    a.apply((s) => saveConfig(s, config, ctx(2026, 10, 10)));
    a.remote.offline = true;
    expect(await a.sync()).toEqual({ ok: false, code: 'network' });
    expect(a.state.sync.lastError).toBe('network');
    expect(countPendingChanges(a.state)).toBeGreaterThan(0);
    a.remote.offline = false;
    expect(await a.sync()).toEqual({ ok: true });
    expect(a.state.sync.lastError).toBeNull();
  });

  it('logout durante o sync descarta as escritas do sync', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server);
    a.apply((s) => saveConfig(s, config, ctx(2026, 10, 10)));
    const access: StateAccess = {
      get: () => a.state,
      commit: async (update) => {
        a.state = unlinkAccount(a.state, false); // usuário saiu antes do commit
        a.state = update(a.state);
      },
    };
    await runSync(access, a.remote);
    expect(a.state.sync.userId).toBeNull();
    expect(a.state.sync.lastSyncAt).toBeNull();
  });
});

describe('primeiro login (BR-ACC-002)', () => {
  it('planeja upload, download ou escolha', async () => {
    const server = new MemoryServer();
    const remote = server.clientFor(USER);
    const withData = saveConfig(createEmptyState(), config, ctx(2026, 10, 10));
    expect(await planFirstLogin(withData, remote)).toBe('upload');

    const a = linkedDevice(server, withData);
    await a.sync();
    expect(await planFirstLogin(createEmptyState(), remote)).toBe('download');
    expect(await planFirstLogin(withData, remote)).toBe('choose');
  });

  it('manter dados deste aparelho substitui a nuvem', async () => {
    const server = new MemoryServer();
    const a = linkedDevice(server, openCycle(saveConfig(createEmptyState(), config, ctx(2026, 10, 10, 'a')), ctx(2026, 10, 10, 'a')));
    await a.sync();

    const localOnly = openCycle(saveConfig(createEmptyState(), { ...config, monthlyIncome: 1 }, ctx(2026, 10, 10, 'b')), ctx(2026, 10, 10, 'b'));
    const remote = server.clientFor(USER);
    await remote.markAllDeleted('2026-10-10T00:00:00.000Z');
    const b = new Device(linkKeepingLocal(localOnly, USER), remote);
    expect(await b.sync()).toEqual({ ok: true });
    expect(server.store(USER).settings[0]?.monthly_income).toBe(1);
    expect(server.store(USER).cycles.filter((c) => c.deleted_at === null)).toHaveLength(1);
  });

  it('sair apagando ou mantendo os dados', () => {
    const state = linkKeepingLocal(saveConfig(createEmptyState(), config, ctx(2026, 10, 10)), USER);
    expect(unlinkAccount(state, true)).toEqual(createEmptyState());
    const kept = unlinkAccount(acknowledge(state, 'settings', [{ id: 'settings', updatedAt: state.settings!.updatedAt }]), false);
    expect(kept.sync.userId).toBeNull();
    expect(kept.settings?.dirty).toBe(true);
  });
});

describe('collectDirty / acknowledge', () => {
  it('ack não limpa registro alterado durante o envio', () => {
    let state = linkKeepingLocal(saveConfig(createEmptyState(), config, ctx(2026, 10, 10)), USER);
    const { refs } = collectDirty(state, 'fixed_expenses', USER);
    state = saveConfig(state, { ...config, fixedExpenses: [] }, ctx(2026, 10, 11));
    state = acknowledge(state, 'fixed_expenses', refs);
    expect(state.fixedExpenses[0]?.dirty).toBe(true);
    expect(collectDirty(state, 'settings', USER).rows).toHaveLength(1);
  });
});

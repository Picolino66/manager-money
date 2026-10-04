import AsyncStorage from '@react-native-async-storage/async-storage';

import { createEmptyState, UseCaseContext } from '../application/state';
import { STATE_STORAGE_KEY } from '../infrastructure/storage/local-store';
import { MemoryServer } from '../infrastructure/sync/memory-remote';
import { linkKeepingLocal } from '../infrastructure/sync/sync-engine';
import { setUseCaseContextFactory, useFinancialStore } from './financial.store';

jest.mock('../infrastructure/export/share-json', () => ({
  ...jest.requireActual('../infrastructure/export/share-json'),
  shareJson: jest.fn().mockResolvedValue(undefined),
}));

const { shareJson } = jest.requireMock('../infrastructure/export/share-json') as {
  shareJson: jest.Mock;
};

let sequence = 0;
let now = new Date(2026, 9, 10, 12);
const context = (): UseCaseContext => ({ now, newId: (prefix) => `${prefix}-${++sequence}` });

const config = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 300000, payday: 7 }],
  savingGoal: 0,
  payday: 7,
  customCategories: [],
  fixedExpenses: [],
};

const store = () => useFinancialStore.getState();

beforeEach(async () => {
  jest.useRealTimers();
  await AsyncStorage.clear();
  sequence = 0;
  now = new Date(2026, 9, 10, 12);
  setUseCaseContextFactory(context);
  store().setSyncRemote(null);
  useFinancialStore.setState({
    doc: createEmptyState(),
    config: null,
    activeMonth: null,
    months: [],
    pendingChanges: 0,
    isSyncing: false,
  });
});

describe('useFinancialStore', () => {
  it('carrega, configura, abre ciclo e persiste em 1 documento', async () => {
    await store().loadAppData();
    expect(store()).toMatchObject({ isLoading: false, loadError: null, config: null });

    await store().saveConfig(config);
    await store().startFinancialCycle();
    expect(store().activeMonth?.startDate).toBe('2026-10-07');

    const persisted = JSON.parse((await AsyncStorage.getItem(STATE_STORAGE_KEY)) ?? '{}');
    expect(persisted.cycles).toHaveLength(1);
  });

  it('ao carregar, recalcula o saldo do ciclo ativo com as regras atuais e persiste (ADR-017)', async () => {
    const { openCycle, saveConfig } = jest.requireActual(
      '../application/cycle.use-cases',
    ) as typeof import('../application/cycle.use-cases');
    const withRent = {
      ...config,
      fixedExpenses: [
        {
          id: 'aluguel',
          type: 'permanent' as const,
          name: 'Aluguel',
          category: 'Moradia',
          amount: 100000,
        },
      ],
    };
    const opened = openCycle(saveConfig(createEmptyState(), withRent, context()), context());
    // Saldo gravado por uma versão antiga, sem a reserva do aluguel pendente.
    const stale = {
      ...opened,
      cycles: opened.cycles.map((cycle) => ({ ...cycle, initialAvailableAmount: 300000 })),
    };
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stale));

    await store().loadAppData();

    expect(store().activeMonth?.initialAvailableAmount).toBe(200000);
    expect(
      JSON.parse((await AsyncStorage.getItem(STATE_STORAGE_KEY)) ?? '{}').cycles[0]
        .initialAvailableAmount,
    ).toBe(200000);
  });

  it('escritas concorrentes não se perdem (fila serializada)', async () => {
    await store().saveConfig(config);
    await store().startFinancialCycle();
    const input = (description: string) => ({
      amount: 100,
      category: 'Outros',
      description,
      date: '2026-10-10',
    });
    await Promise.all([
      store().addExpense(input('A')),
      store().addExpense(input('B')),
      store().addExpense(input('C')),
    ]);
    expect(store().activeMonth?.expenses.map((expense) => expense.description)).toEqual([
      'A',
      'B',
      'C',
    ]);

    const id = store().activeMonth!.expenses[0]!.id;
    await store().updateExpense(id, input('A2'));
    await store().deleteExpense(id);
    expect(store().activeMonth?.expenses.map((expense) => expense.description)).toEqual(['B', 'C']);
  });

  it('erro de regra rejeita a ação e mantém o estado', async () => {
    await expect(store().startFinancialCycle()).rejects.toThrow('Configure renda');
    await store().saveConfig(config);
    await store().addCategory('Viagem');
    await store().startFinancialCycle();
    await expect(store().closeActiveMonth()).rejects.toThrow('O ciclo termina em 06/11.');
    now = new Date(2026, 10, 3, 12);
    await store().receiveIncomeEarly();
    expect(store().months).toHaveLength(1);
    expect(store().config?.customCategories).toEqual(['Viagem']);
    now = new Date(2026, 11, 7, 12);
    await store().closeActiveMonth();
    expect(store().activeMonth).toBeNull();
  });

  it('documento corrompido mostra erro e permite exportar o bruto', async () => {
    await AsyncStorage.setItem(STATE_STORAGE_KEY, 'não é json');
    await store().loadAppData();
    expect(store().loadError).toContain('Não foi possível ler');
    await store().exportRawData();
    expect(shareJson).toHaveBeenCalledWith(expect.stringContaining('recuperacao'), 'não é json');
  });

  it('exportData compartilha JSON sem identificador de usuário', async () => {
    await store().replaceDocument((doc) => linkKeepingLocal(doc, 'user-secreto'));
    await store().exportData();
    const payload = shareJson.mock.calls.at(-1)?.[1] as string;
    expect(payload).not.toContain('user-secreto');
    expect(JSON.parse(payload)).toMatchObject({ app: 'manager-money', schemaVersion: 8 });
  });

  it('sincroniza com debounce depois das escritas e faz backoff offline', async () => {
    jest.useFakeTimers();
    const server = new MemoryServer();
    const remote = server.clientFor('u1');
    await store().replaceDocument((doc) => linkKeepingLocal(doc, 'u1'));
    store().setSyncRemote(remote);
    await store().saveConfig(config);
    expect(store().pendingChanges).toBe(1);

    await jest.advanceTimersByTimeAsync(2_000);
    expect(store().pendingChanges).toBe(0);
    expect(server.store('u1').settings).toHaveLength(1);

    remote.offline = true;
    await store().saveConfig({
      ...config,
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 1, payday: 7 }],
    });
    expect(await store().syncNow()).toEqual({ ok: false, code: 'network' });
    remote.offline = false;
    await jest.advanceTimersByTimeAsync(60_000);
    expect(server.store('u1').settings[0]?.monthly_income).toBe(1);
    jest.useRealTimers();
  });

  it('sem remote ou sem conta, o sync fica desligado', async () => {
    expect(await store().syncNow()).toEqual({ ok: false, code: 'disabled' });
    store().setSyncRemote(new MemoryServer().clientFor('x'));
    store().scheduleSync(0); // sem userId: no-op
    useFinancialStore.setState({ isSyncing: true });
    expect(await store().syncNow()).toEqual({ ok: false, code: 'busy' });
  });
});

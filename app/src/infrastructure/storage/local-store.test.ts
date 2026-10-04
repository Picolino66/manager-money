import AsyncStorage from '@react-native-async-storage/async-storage';

import { createEmptyState } from '@manager-money/core/application/state';
import { localStore, STATE_STORAGE_KEY } from './local-store';
import {
  openCycle,
  recalculateActiveCycleBalance,
  saveConfig,
} from '@manager-money/core/application/cycle.use-cases';
import { LEGACY_STORAGE_KEYS } from './migrations';

const legacyConfig = {
  monthlyIncome: 880000,
  savingGoal: 150000,
  updatedAt: '2026-04-01T00:00:00.000Z',
  fixedExpenses: 418000, // formato mais antigo: total numérico
  customCategories: [' Viagem ', ''],
};

const legacyActive = {
  id: 'active-1',
  startDate: '2026-04-07',
  endDate: '2026-05-06',
  receivedAt: '2026-04-07T03:00:00.000Z',
  startedAt: '2026-04-07T03:00:00.000Z',
  status: 'active',
  initialAvailableAmount: 312000,
  previousMonthDebt: 0,
  expenses: [
    {
      id: 'e1',
      amount: 1500,
      category: '',
      description: 'Café',
      date: '2026-04-08',
      createdAt: '2026-04-08T10:00:00.000Z',
    },
  ],
};

const legacyCalendarMonth = {
  id: 'closed-1',
  year: 2026,
  month: 3,
  startedAt: '2026-03-01T03:00:00.000Z',
  closedAt: '2026-04-01T03:00:00.000Z',
  status: 'closed',
  initialAvailableAmount: 300000,
  previousMonthDebt: 0,
  finalBalance: -1000,
  expenses: [],
};

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('localStore (SPEC-004)', () => {
  it('sem dados retorna estado vazio', async () => {
    const result = await localStore.load();
    expect(result).toEqual({ status: 'ok', state: createEmptyState(), migrated: false });
  });

  it('migra v1 → v8 sem perda, incluindo formatos legados', async () => {
    await AsyncStorage.multiSet([
      [LEGACY_STORAGE_KEYS.config, JSON.stringify(legacyConfig)],
      [LEGACY_STORAGE_KEYS.months, JSON.stringify([legacyCalendarMonth])],
      [LEGACY_STORAGE_KEYS.activeMonth, JSON.stringify(legacyActive)],
    ]);

    const result = await localStore.load(new Date('2026-10-01T12:00:00Z'));
    if (result.status !== 'ok') throw new Error('falhou');

    const { state } = result;
    expect(result.migrated).toBe(true);
    expect(state.settings).toMatchObject({
      monthlyIncome: 880000,
      payday: 7,
      customCategories: ['Viagem'],
      dirty: true,
    });
    expect(state.fixedExpenses).toEqual([
      expect.objectContaining({ id: 'legacy-fixed-expenses', type: 'permanent', amount: 418000 }),
    ]);
    expect(state.cycles.map((cycle) => [cycle.id, cycle.startDate, cycle.endDate])).toEqual([
      ['closed-1', '2026-03-07', '2026-04-06'],
      ['active-1', '2026-04-07', '2026-05-06'],
    ]);
    expect(state.expenses).toEqual([
      expect.objectContaining({ id: 'e1', cycleId: 'active-1', category: 'Outros' }),
    ]);

    // Chaves v1 removidas somente após gravar a v2.
    expect(await AsyncStorage.getItem(LEGACY_STORAGE_KEYS.config)).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(STATE_STORAGE_KEY)) ?? '{}').schemaVersion).toBe(
      8,
    );

    const reloaded = await localStore.load();
    expect(reloaded).toMatchObject({ status: 'ok', migrated: false });
  });

  it('migra fixos em lista (permanentes e parcelamentos)', async () => {
    await AsyncStorage.setItem(
      LEGACY_STORAGE_KEYS.config,
      JSON.stringify({
        ...legacyConfig,
        fixedExpenses: [
          { id: 'a', name: ' Aluguel ', amount: -5 },
          {
            id: 'b',
            type: 'installment',
            name: 'TV',
            category: 'Lazer',
            installmentAmount: 100,
            totalInstallments: 0,
            remainingInstallments: -1,
          },
        ],
      }),
    );
    const result = await localStore.load();
    if (result.status !== 'ok') throw new Error('falhou');
    expect(result.state.fixedExpenses).toEqual([
      expect.objectContaining({ id: 'a', name: 'Aluguel', amount: 0, category: 'Outros' }),
      expect.objectContaining({ id: 'b', totalInstallments: 1, remainingInstallments: 0 }),
    ]);
  });

  it('migra documento v2 → v8: renda vira fonte e settings fica pendente de envio', async () => {
    const v2 = {
      ...createEmptyState(),
      schemaVersion: 2,
      settings: {
        monthlyIncome: 880000,
        savingGoal: 0,
        payday: 7,
        customCategories: [],
        updatedAt: '2026-04-01T00:00:00.000Z',
        deletedAt: null,
        dirty: false,
      },
    };
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(v2));

    const result = await localStore.load(new Date('2026-10-03T12:00:00Z'));
    if (result.status !== 'ok') throw new Error('falhou');

    expect(result.migrated).toBe(true);
    expect(result.state.schemaVersion).toBe(8);
    expect(result.state.settings).toMatchObject({
      monthlyIncome: 880000,
      incomeSources: [{ id: 'income-legacy', name: 'Renda', amount: 880000, payday: 7 }],
      dirty: true,
    });
    expect(JSON.parse((await AsyncStorage.getItem(STATE_STORAGE_KEY)) ?? '{}').schemaVersion).toBe(
      8,
    );
  });

  it('migra v3 → v8: acrescenta cartões, compras, pagamentos e rendas vazios e os cursores', async () => {
    const { creditCards, cardPurchases, ...rest } = createEmptyState();
    const { credit_cards, card_purchases, ...cursors } = rest.sync.cursors;
    void creditCards;
    void cardPurchases;
    void credit_cards;
    void card_purchases;
    await AsyncStorage.setItem(
      STATE_STORAGE_KEY,
      JSON.stringify({
        ...rest,
        schemaVersion: 3,
        sync: { ...rest.sync, cursors: { ...cursors, settings: 'c1' } },
      }),
    );

    const result = await localStore.load();
    if (result.status !== 'ok') throw new Error('falhou');

    expect(result.migrated).toBe(true);
    expect(result.state).toMatchObject({
      schemaVersion: 8,
      creditCards: [],
      cardPurchases: [],
      fixedPayments: [],
      extraIncomes: [],
      sync: {
        cursors: {
          settings: 'c1',
          credit_cards: null,
          card_purchases: null,
          fixed_payments: null,
          extra_incomes: null,
        },
      },
    });
  });

  it('migra v4 → v8: v4→v5 devolve as fixas e o recálculo ao carregar volta a reservá-las (BR-FIN-004)', async () => {
    const ctx = { now: new Date(2026, 9, 10, 12), newId: (prefix: string) => `${prefix}-1` };
    const config = {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
      savingGoal: 50000,
      payday: 7,
      customCategories: [],
      fixedExpenses: [
        {
          id: 'aluguel',
          type: 'permanent' as const,
          name: 'Aluguel',
          category: 'Moradia',
          amount: 150000,
        },
        {
          id: 'tv',
          type: 'installment' as const,
          name: 'TV',
          category: 'Lazer',
          installmentAmount: 10000,
          totalInstallments: 3,
          remainingInstallments: 3,
        },
      ],
    };
    const current = openCycle(saveConfig(createEmptyState(), config, ctx), ctx);
    // Documento como a v4 gravava: fixas já descontadas do saldo inicial do ciclo.
    const { fixedPayments, extraIncomes, ...rest } = current;
    const { fixed_payments, extra_incomes, ...cursors } = rest.sync.cursors;
    void fixedPayments;
    void extraIncomes;
    void fixed_payments;
    void extra_incomes;
    const v4 = {
      ...rest,
      schemaVersion: 4,
      cycles: rest.cycles.map((cycle) => ({
        ...cycle,
        initialAvailableAmount: 290000,
        dirty: false,
      })),
      fixedExpenses: [
        ...rest.fixedExpenses,
        {
          ...rest.fixedExpenses[0]!,
          id: 'antiga',
          amount: 999999,
          deletedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      sync: { ...rest.sync, cursors },
    };
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(v4));

    const result = await localStore.load(new Date('2026-10-11T12:00:00Z'));
    if (result.status !== 'ok') throw new Error('falhou');

    expect(result.migrated).toBe(true);
    expect(result.state).toMatchObject({
      schemaVersion: 8,
      fixedPayments: [],
      extraIncomes: [],
      sync: { cursors: { fixed_payments: null, extra_incomes: null } },
    });
    // v4→v5: 290.000 + 150.000 (aluguel) + 10.000 (parcela da TV) = 450.000; a fixa excluída não conta.
    // v6→v7 não mexe no saldo gravado; a store recalcula ao carregar e as fixas pendentes voltam a
    // ficar reservadas: 450.000 − 160.000.
    expect(result.state.cycles[0]).toMatchObject({ initialAvailableAmount: 450000 });
    expect(recalculateActiveCycleBalance(result.state, ctx).cycles[0]?.initialAvailableAmount).toBe(
      290000,
    );
  });

  it('migra v4 sem fixas nem ciclo ativo sem alterar os ciclos', async () => {
    const { fixedPayments, extraIncomes, ...rest } = createEmptyState();
    void fixedPayments;
    void extraIncomes;
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ ...rest, schemaVersion: 4 }));
    const result = await localStore.load();
    expect(result).toMatchObject({ status: 'ok', migrated: true });
    if (result.status === 'ok') expect(result.state.cycles).toEqual([]);
  });

  it('migra v5 → v8: cada fonte herda o dia de pagamento global e settings fica pendente (BR-FIN-024)', async () => {
    const v5 = {
      ...createEmptyState(),
      schemaVersion: 5,
      settings: {
        monthlyIncome: 600000,
        incomeSources: [
          { id: 'a', name: 'Salário', amount: 500000 },
          { id: 'b', name: 'Freela', amount: 100000 },
        ],
        savingGoal: 0,
        payday: 15,
        customCategories: [],
        updatedAt: '2026-04-01T00:00:00.000Z',
        deletedAt: null,
        dirty: false,
      },
    };
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(v5));

    const result = await localStore.load(new Date('2026-10-03T12:00:00Z'));
    if (result.status !== 'ok') throw new Error('falhou');

    expect(result.migrated).toBe(true);
    expect(result.state.schemaVersion).toBe(8);
    expect(result.state.settings).toMatchObject({
      payday: 15,
      incomeSources: [
        expect.objectContaining({ id: 'a', payday: 15 }),
        expect.objectContaining({ id: 'b', payday: 15 }),
      ],
      dirty: true,
    });
  });

  it('migra v6 → v8: cartões ganham limite e ativo; compras ganham fatura sem mudar o ciclo (ADR-017)', async () => {
    const meta = { updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null, dirty: false };
    const { statementPayments, ...rest } = createEmptyState();
    const { statement_payments, ...cursors } = rest.sync.cursors;
    void statementPayments;
    void statement_payments;
    const v6 = {
      ...rest,
      schemaVersion: 6,
      creditCards: [{ ...meta, id: 'k1', name: 'Nubank', closingDay: 20, dueDay: 27 }],
      cardPurchases: [
        {
          ...meta,
          id: 'p1',
          cardId: 'k1',
          description: 'Tênis',
          category: 'Pessoal',
          totalAmount: 60000,
          installments: 6,
          purchaseDate: '2026-10-22',
          firstCycleKey: '2026-11',
          createdAt: '2026-10-22T12:00:00.000Z',
        },
        {
          ...meta,
          id: 'p0',
          cardId: 'k1',
          description: 'Mercado',
          category: 'Alimentação',
          totalAmount: 20000,
          installments: 2,
          purchaseDate: '2026-08-10',
          firstCycleKey: '2026-08',
          createdAt: '2026-08-10T12:00:00.000Z',
        },
      ],
      cycles: [
        {
          ...meta,
          id: 'c1',
          startDate: '2026-10-07',
          endDate: '2026-11-06',
          receivedAt: '2026-10-07T03:00:00.000Z',
          startedAt: '2026-10-07T12:00:00.000Z',
          status: 'active',
          initialAvailableAmount: 100000,
          previousMonthDebt: 0,
        },
      ],
      sync: { ...rest.sync, cursors },
    };
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(v6));

    const result = await localStore.load(new Date('2026-10-23T12:00:00Z'));
    if (result.status !== 'ok') throw new Error('falhou');

    expect(result.state).toMatchObject({
      schemaVersion: 8,
      creditCards: [{ id: 'k1', creditLimit: null, active: true, dirty: false }],
      // 22/10 é depois do fechamento (20): fatura de novembro; o ciclo gravado não muda.
      cardPurchases: [
        {
          id: 'p1',
          firstStatementKey: '2026-11',
          firstCycleKey: '2026-11',
          settledInstallments: 0,
          dirty: false,
        },
        { id: 'p0', firstStatementKey: '2026-08' },
      ],
      // Faturas já vencidas antes da v7 (08 e 09/2026) contam como pagas, sem juros; nada mais
      // fica pendente de envio, e o ciclo não muda.
      statementPayments: [
        {
          id: 'statement-k1-2026-08',
          statementKey: '2026-08',
          statementAmount: 10000,
          paidAmount: 10000,
          paidAt: '2026-08-27',
          cycleId: 'c1',
          dirty: true,
        },
        {
          id: 'statement-k1-2026-09',
          statementKey: '2026-09',
          statementAmount: 10000,
          paidAmount: 10000,
          paidAt: '2026-09-27',
          cycleId: 'c1',
          dirty: true,
        },
      ],
      cycles: [{ id: 'c1', initialAvailableAmount: 100000, dirty: false }],
      sync: { cursors: { statement_payments: null } },
    });
  });

  it('migra v6 → v8 sem mexer no saldo; o recálculo reserva só as fixas vivas pendentes no ciclo ativo (BR-FIN-004)', async () => {
    const meta = { updatedAt: '2026-10-01T00:00:00.000Z', deletedAt: null, dirty: false };
    const { statementPayments, ...rest } = createEmptyState();
    const { statement_payments, ...cursors } = rest.sync.cursors;
    void statementPayments;
    void statement_payments;
    const cycle = { receivedAt: '2026-09-07T03:00:00.000Z', previousMonthDebt: 0, ...meta };
    const v6 = {
      ...rest,
      schemaVersion: 6,
      settings: {
        ...meta,
        monthlyIncome: 600000,
        incomeSources: [{ id: 'renda', name: 'Salário', amount: 600000, payday: 7 }],
        savingGoal: 0,
        payday: 7,
        customCategories: [],
      },
      fixedExpenses: [
        {
          ...meta,
          id: 'aluguel',
          type: 'permanent',
          name: 'Aluguel',
          category: 'Moradia',
          amount: 150000,
        },
        {
          ...meta,
          id: 'tv',
          type: 'installment',
          name: 'TV',
          category: 'Lazer',
          installmentAmount: 10000,
          totalInstallments: 3,
          remainingInstallments: 2,
          startedAtCycleId: 'c0',
        },
        {
          ...meta,
          id: 'antiga',
          type: 'permanent',
          name: 'Antiga',
          category: 'Outros',
          amount: 999999,
          deletedAt: '2026-10-01T00:00:00.000Z',
        },
      ],
      cycles: [
        {
          ...cycle,
          id: 'c0',
          startDate: '2026-09-07',
          endDate: '2026-10-06',
          startedAt: '2026-09-07T12:00:00.000Z',
          status: 'closed',
          initialAvailableAmount: 450000,
          finalBalance: 1000,
        },
        {
          ...cycle,
          id: 'c1',
          startDate: '2026-10-07',
          endDate: '2026-11-06',
          startedAt: '2026-10-07T12:00:00.000Z',
          status: 'active',
          initialAvailableAmount: 450000,
        },
      ],
      fixedPayments: [
        // Aluguel pago à vista no ciclo ativo: já pesa como pago, não reserva de novo.
        {
          ...meta,
          id: 'pg1',
          cycleId: 'c1',
          fixedExpenseId: 'aluguel',
          name: 'Aluguel',
          category: 'Moradia',
          method: 'pix',
          amount: 150000,
          interest: 0,
          paidAt: '2026-10-08',
        },
        // Pagamento da TV no ciclo fechado não conta para o ativo.
        {
          ...meta,
          id: 'pg0',
          cycleId: 'c0',
          fixedExpenseId: 'tv',
          name: 'TV',
          category: 'Lazer',
          method: 'pix',
          amount: 10000,
          interest: 0,
          paidAt: '2026-09-08',
        },
      ],
      sync: { ...rest.sync, cursors },
    };
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(v6));

    const result = await localStore.load(new Date('2026-10-10T12:00:00Z'));
    if (result.status !== 'ok') throw new Error('falhou');

    expect(
      result.state.cycles.map((cycle) => [cycle.id, cycle.initialAvailableAmount, cycle.dirty]),
    ).toEqual([
      ['c0', 450000, false],
      ['c1', 450000, false],
    ]);

    const [closed, active] = recalculateActiveCycleBalance(result.state, {
      now: new Date(2026, 9, 10, 12),
      newId: (prefix) => `${prefix}-1`,
    }).cycles;
    // 600.000 − 150.000 (aluguel pago à vista) − 10.000 (parcela pendente da TV); o fechado não muda.
    expect(active).toMatchObject({ id: 'c1', initialAvailableAmount: 440000, dirty: true });
    expect(closed).toMatchObject({ id: 'c0', initialAvailableAmount: 450000, dirty: false });
  });

  it('migra documento v2 sem settings', async () => {
    await AsyncStorage.setItem(
      STATE_STORAGE_KEY,
      JSON.stringify({ ...createEmptyState(), schemaVersion: 2 }),
    );
    const result = await localStore.load();
    expect(result).toMatchObject({ status: 'ok', migrated: true });
  });

  it('cada save é um único setItem (DEF-002)', async () => {
    await localStore.save(createEmptyState());
    // O mock implementa setItem via multiSet; o que importa é 1 gravação de 1 chave.
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(STATE_STORAGE_KEY, expect.any(String));
  });

  it('documento inválido não é sobrescrito (DEF-004)', async () => {
    await AsyncStorage.setItem(STATE_STORAGE_KEY, '{"schemaVersion":2,"settings":"quebrado"}');
    const result = await localStore.load();
    expect(result.status).toBe('corrupted');
    expect(await localStore.readRaw()).toBe('{"schemaVersion":2,"settings":"quebrado"}');
  });

  it('legado com JSON inválido também é preservado', async () => {
    await AsyncStorage.setItem(LEGACY_STORAGE_KEYS.config, '{inválido');
    const result = await localStore.load();
    expect(result.status).toBe('corrupted');
    expect(await AsyncStorage.getItem(LEGACY_STORAGE_KEYS.config)).toBe('{inválido');
  });
});

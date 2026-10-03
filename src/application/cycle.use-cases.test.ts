import {
  addCategory,
  addExpense,
  calculateNextCycleStartDate,
  canCloseActiveCycle,
  canReceiveIncomeEarlyNow,
  closeCycle,
  deleteExpense,
  openCycle,
  receiveIncomeEarly,
  saveConfig,
  updateExpense,
} from './cycle.use-cases';
import { DomainError } from './errors';
import { selectActiveMonth, selectClosedMonths, selectConfig } from './selectors';
import { countPendingChanges, createEmptyState, hasLocalData, LocalState, UseCaseContext } from './state';
import { FinancialConfigInput } from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';

let sequence = 0;
const at = (year: number, month: number, day: number): UseCaseContext => ({
  now: new Date(year, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

const baseConfig: FinancialConfigInput = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000 }],
  savingGoal: 50000,
  payday: 7,
  customCategories: [],
  fixedExpenses: [
    { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 150000 },
    {
      id: 'notebook',
      type: 'installment',
      name: 'Notebook',
      category: 'Educação',
      installmentAmount: 10000,
      totalInstallments: 3,
      remainingInstallments: 3,
    },
  ],
};

function configured(ctx = at(2026, 10, 10)): LocalState {
  return saveConfig(createEmptyState(), baseConfig, ctx);
}

function installment(state: LocalState) {
  const record = state.fixedExpenses.find((expense) => expense.id === 'notebook');
  if (record?.type !== 'installment') throw new Error('parcelamento ausente');
  return record;
}

beforeEach(() => {
  sequence = 0;
});

describe('saveConfig (RF-01, BR-FIN-014)', () => {
  it('cria settings e fixos sujos', () => {
    const state = configured();
    expect(selectConfig(state)?.payday).toBe(7);
    expect(state.fixedExpenses.every((record) => record.dirty)).toBe(true);
    expect(hasLocalData(state)).toBe(true);
  });

  it('BR-FIN-018: renda mensal é a soma das fontes e exige ao menos uma', () => {
    const state = saveConfig(
      createEmptyState(),
      {
        ...baseConfig,
        incomeSources: [
          { id: 'salario', name: ' Salário ', amount: 400000 },
          { id: 'freela', name: 'Freela', amount: 150000 },
        ],
      },
      at(2026, 10, 10),
    );
    expect(state.settings?.monthlyIncome).toBe(550000);
    expect(selectConfig(state)?.incomeSources[0]?.name).toBe('Salário');
    expect(selectConfig(state)).toMatchObject({ monthlyIncome: 550000 });
    expect(() =>
      saveConfig(createEmptyState(), { ...baseConfig, incomeSources: [] }, at(2026, 10, 10)),
    ).toThrow('ao menos uma fonte de renda');
  });

  it('BR-FIN-018: alterar só as fontes marca settings como sujo', () => {
    const state = configured();
    const clean: LocalState = {
      ...state,
      settings: state.settings && { ...state.settings, dirty: false },
    };
    const changed = saveConfig(
      clean,
      { ...baseConfig, incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000 }, { id: 'x', name: 'Extra', amount: 1000 }] },
      at(2026, 10, 11),
    );
    expect(changed.settings).toMatchObject({ dirty: true, monthlyIncome: 501000 });
  });

  it('salvar sem mudanças não marca registros como sujos', () => {
    const state = configured();
    const clean: LocalState = {
      ...state,
      settings: state.settings && { ...state.settings, dirty: false },
      fixedExpenses: state.fixedExpenses.map((record) => ({ ...record, dirty: false })),
    };
    const resaved = saveConfig(clean, baseConfig, at(2026, 10, 11));
    expect(countPendingChanges(resaved)).toBe(0);
  });

  it('remover um fixo vira exclusão lógica', () => {
    const state = saveConfig(configured(), { ...baseConfig, fixedExpenses: [] }, at(2026, 10, 11));
    expect(state.fixedExpenses.every((record) => record.deletedAt !== null)).toBe(true);
    expect(selectConfig(state)?.fixedExpenses).toHaveLength(0);
  });

  it('com ciclo ativo, recalcula o saldo inicial e inicia parcelamentos pendentes', () => {
    const opened = openCycle(configured(), at(2026, 10, 10));
    const before = selectActiveMonth(opened)?.initialAvailableAmount;
    const updated = saveConfig(
      opened,
      {
        ...baseConfig,
        fixedExpenses: [
          ...baseConfig.fixedExpenses,
          {
            id: 'celular',
            type: 'installment',
            name: 'Celular',
            category: 'Pessoal',
            installmentAmount: 20000,
            totalInstallments: 2,
            remainingInstallments: 2,
          },
        ],
      },
      at(2026, 10, 12),
    );
    // Fixa nova pendente não muda o saldo; só o pagamento desconta (BR-FIN-021).
    expect(selectActiveMonth(updated)?.initialAvailableAmount).toBe(before);
    const celular = updated.fixedExpenses.find((record) => record.id === 'celular');
    expect(celular?.type === 'installment' && celular.startedAtCycleId).toBe(
      selectActiveMonth(updated)?.id,
    );
  });

  it('addCategory ignora duplicadas e exige configuração', () => {
    const state = addCategory(configured(), 'Viagem', at(2026, 10, 10));
    expect(state.settings?.customCategories).toEqual(['Viagem']);
    expect(addCategory(state, 'Viagem', at(2026, 10, 10))).toBe(state);
    expect(() => addCategory(createEmptyState(), 'X', at(2026, 10, 10))).toThrow(DomainError);
  });
});

describe('openCycle (RF-03, BR-FIN-013, BR-FIN-017)', () => {
  it('exige configuração e um único ciclo ativo', () => {
    expect(() => openCycle(createEmptyState(), at(2026, 10, 10))).toThrow(DomainError);
    const opened = openCycle(configured(), at(2026, 10, 10));
    expect(() => openCycle(opened, at(2026, 10, 10))).toThrow('Já existe um ciclo ativo.');
  });

  it('abre com o período do dia de pagamento e saldo correto', () => {
    const month = selectActiveMonth(openCycle(configured(), at(2026, 10, 10)));
    expect(month).toMatchObject({ startDate: '2026-10-07', endDate: '2026-11-06' });
    // BR-FIN-004: fixas pendentes não descontam. 500000 − 50000 (meta)
    expect(month?.initialAvailableAmount).toBe(450000);
  });

  it('respeita payday configurado', () => {
    const state = saveConfig(createEmptyState(), { ...baseConfig, payday: 20 }, at(2026, 10, 10));
    expect(selectActiveMonth(openCycle(state, at(2026, 10, 10)))).toMatchObject({
      startDate: '2026-09-20',
      endDate: '2026-10-19',
    });
  });

  it('DEF-006: o próximo ciclo nunca repete o período de um ciclo fechado', () => {
    let state = openCycle(configured(), at(2026, 10, 10));
    // Ciclo 07/10–06/11 fechado no fim (07/11); um ciclo legado poderia ter terminado depois do início padrão.
    state = closeCycle(state, at(2026, 11, 7));
    const reopened = openCycle(state, at(2026, 11, 7));
    expect(selectActiveMonth(reopened)?.startDate).toBe('2026-11-07');

    const legacy: LocalState = {
      ...state,
      cycles: state.cycles.map((cycle) => ({ ...cycle, endDate: '2026-11-10' })),
    };
    expect(toISODate(calculateNextCycleStartDate(legacy, new Date(2026, 10, 8)))).toBe('2026-11-11');
  });

  it('parcelas avançam uma vez por ciclo e herdam dívida', () => {
    let state = openCycle(configured(), at(2026, 10, 10));
    expect(installment(state).remainingInstallments).toBe(3);
    state = addExpense(state, { amount: 600000, category: 'Lazer', description: 'Viagem', date: '2026-10-11' }, at(2026, 10, 11));
    state = closeCycle(state, at(2026, 11, 7));
    expect(selectClosedMonths(state)[0]?.finalBalance).toBe(-150000);
    state = openCycle(state, at(2026, 11, 7));
    expect(installment(state).remainingInstallments).toBe(2);
    expect(selectActiveMonth(state)?.previousMonthDebt).toBe(150000);
  });
});

describe('receiveIncomeEarly (BR-FIN-003, BR-FIN-016)', () => {
  function inEarlyWindow() {
    let state = openCycle(configured(), at(2026, 10, 10));
    state = addExpense(state, { amount: 1000, category: '', description: 'Antes', date: '2026-11-02' }, at(2026, 11, 2));
    state = addExpense(state, { amount: 2000, category: 'Lazer', description: 'Depois', date: '2026-11-04' }, at(2026, 11, 2));
    return state;
  }

  it('fecha o ciclo na véspera e move os gastos do novo período', () => {
    const state = receiveIncomeEarly(inEarlyWindow(), at(2026, 11, 3));
    const [closed] = selectClosedMonths(state);
    const active = selectActiveMonth(state);
    expect(closed).toMatchObject({ endDate: '2026-11-02', status: 'closed' });
    expect(closed?.expenses.map((expense) => expense.description)).toEqual(['Antes']);
    expect(active).toMatchObject({ startDate: '2026-11-03', endDate: '2026-12-06' });
    expect(active?.expenses.map((expense) => expense.description)).toEqual(['Depois']);
    expect(installment(state).remainingInstallments).toBe(2);
  });

  it('DEF-001: segundo acionamento é rejeitado e parcelas não avançam de novo', () => {
    const state = receiveIncomeEarly(inEarlyWindow(), at(2026, 11, 3));
    expect(canReceiveIncomeEarlyNow(state, new Date(2026, 10, 4))).toBe(false);
    expect(() => receiveIncomeEarly(state, at(2026, 11, 4))).toThrow(DomainError);
    expect(() => receiveIncomeEarly(state, at(2026, 11, 3))).toThrow(DomainError);
    expect(installment(state).remainingInstallments).toBe(2);
  });

  it('exige ciclo ativo, configuração e janela', () => {
    expect(() => receiveIncomeEarly(configured(), at(2026, 11, 3))).toThrow('Nenhum ciclo ativo para antecipar.');
    expect(() => receiveIncomeEarly(createEmptyState(), at(2026, 11, 3))).toThrow(DomainError);
    expect(() => receiveIncomeEarly(openCycle(configured(), at(2026, 10, 10)), at(2026, 10, 20))).toThrow(DomainError);
  });
});

describe('closeCycle (RF-11, BR-FIN-017)', () => {
  it('bloqueia antes do fim e permite depois', () => {
    const state = openCycle(configured(), at(2026, 10, 10));
    expect(canCloseActiveCycle(state, new Date(2026, 10, 6))).toBe(false);
    expect(() => closeCycle(state, at(2026, 11, 6))).toThrow('O ciclo termina em 06/11.');
    const closed = closeCycle(state, at(2026, 11, 7));
    expect(selectActiveMonth(closed)).toBeNull();
    expect(selectClosedMonths(closed)[0]?.finalBalance).toBe(450000);
    expect(() => closeCycle(closed, at(2026, 11, 7))).toThrow('Nenhum ciclo ativo para fechar.');
  });
});

describe('gastos (RF-05, RF-06, BR-FIN-011)', () => {
  const input = { amount: 2500, category: ' Alimentação ', description: ' Almoço ', date: '2026-10-12' };

  it('cria normalizado, edita e exclui logicamente', () => {
    let state = openCycle(configured(), at(2026, 10, 10));
    expect(() => addExpense(configured(), input, at(2026, 10, 12))).toThrow(DomainError);
    state = addExpense(state, input, at(2026, 10, 12));
    const created = state.expenses[0];
    expect(created).toMatchObject({ category: 'Alimentação', description: 'Almoço', dirty: true });

    state = updateExpense(state, created!.id, { ...input, amount: 3000 }, at(2026, 10, 13));
    expect(selectActiveMonth(state)?.expenses[0]?.amount).toBe(3000);

    state = deleteExpense(state, created!.id, at(2026, 10, 14));
    expect(selectActiveMonth(state)?.expenses).toHaveLength(0);
    expect(state.expenses[0]?.deletedAt).not.toBeNull();
    expect(() => deleteExpense(state, created!.id, at(2026, 10, 14))).toThrow('Gasto não encontrado no ciclo ativo.');
  });

  it('rejeita data fora do ciclo e gasto de ciclo fechado', () => {
    let state = openCycle(configured(), at(2026, 10, 10));
    expect(() => addExpense(state, { ...input, date: '2026-11-07' }, at(2026, 10, 12))).toThrow(
      'A data do gasto precisa estar dentro do ciclo ativo.',
    );
    state = addExpense(state, input, at(2026, 10, 12));
    const id = state.expenses[0]!.id;
    state = openCycle(closeCycle(state, at(2026, 11, 7)), at(2026, 11, 7));
    expect(() => updateExpense(state, id, input, at(2026, 11, 8))).toThrow(DomainError);
    expect(() => deleteExpense(configured(), id, at(2026, 11, 8))).toThrow(DomainError);
    expect(() => updateExpense(configured(), id, input, at(2026, 11, 8))).toThrow(DomainError);
  });
});

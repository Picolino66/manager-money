/**
 * Filtro de mês e ano da tela Ciclos: o que pesa em cada ciclo (passado, atual e futuro).
 *
 * Base: renda R$ 5.000 (dia 5), aluguel R$ 1.500; cartão fecha dia 20 e vence dia 27.
 * Hoje = 16/10/2026, ciclo 05/10–04/11.
 */
import { addCardPurchase, saveCreditCard } from './card.use-cases';
import { addExpense, closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import { selectCycleSpending, selectCycleSpendingRange } from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (month: number, day: number, year = 2026): UseCaseContext => ({
  now: new Date(year, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});
const TODAY = at(10, 16);

const config: FinancialConfigInput = {
  incomeSources: [{ id: 'salario', name: 'Salário', amount: 500000, payday: 5 }],
  savingGoal: 0,
  customCategories: [],
  fixedExpenses: [
    { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 150000 },
  ],
};

function base(): LocalState {
  const configured = saveConfig(createEmptyState(), config, TODAY);
  const withCard = saveCreditCard(
    configured,
    { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: 600000 },
    TODAY,
  );
  const state = openCycle(withCard, TODAY);

  return addCardPurchase(
    addExpense(
      state,
      { amount: 4500, category: 'Alimentação', description: 'Mercado', date: '2026-10-10' },
      TODAY,
    ),
    {
      cardId: state.creditCards[0]!.id,
      description: 'TV',
      category: 'Lazer',
      totalAmount: 30000,
      installments: 3,
      date: '2026-10-10',
    },
    TODAY,
  );
}

beforeEach(() => {
  sequence = 0;
});

describe('selectCycleSpending', () => {
  it('ciclo atual: gastos, fatura que vence nele com a parcela e fixas pendentes', () => {
    const spending = selectCycleSpending(base(), '2026-10', TODAY.now);

    expect(spending.phase).toBe('active');
    expect(spending.expensesTotal).toBe(4500);
    expect(spending.statements).toHaveLength(1);
    expect(spending.statements[0]).toMatchObject({
      cardName: 'Nubank',
      dueDate: '2026-10-27',
      total: 10000,
    });
    expect(spending.statements[0]!.items[0]).toMatchObject({
      description: 'TV',
      installmentLabel: '1/3',
      amount: 10000,
    });
    expect(spending.fixedPlanned).toEqual([{ id: 'aluguel', name: 'Aluguel', amount: 150000 }]);
    expect(spending.total).toBe(4500 + 10000 + 150000);
    expect(spending.isEmpty).toBe(false);
  });

  it('ciclo futuro: mostra as parcelas que foram para faturas futuras e as fixas previstas', () => {
    const spending = selectCycleSpending(base(), '2026-12', TODAY.now);

    expect(spending.phase).toBe('future');
    expect(spending.expenses).toHaveLength(0);
    expect(spending.statements[0]!.items[0]).toMatchObject({ installmentLabel: '3/3' });
    expect(spending.cardTotal).toBe(10000);
    expect(spending.fixedPlannedTotal).toBe(150000);
    expect(spending.total).toBe(160000);
  });

  it('ciclo futuro além das parcelas: só as fixas previstas; sem nada, fica vazio', () => {
    const spending = selectCycleSpending(base(), '2027-03', TODAY.now);

    expect(spending.statements).toHaveLength(0);
    expect(spending.fixedPlannedTotal).toBe(150000);
  });

  it('ciclo passado sem registro é vazio', () => {
    const spending = selectCycleSpending(base(), '2026-08', TODAY.now);

    expect(spending).toMatchObject({ phase: 'empty', isEmpty: true, total: 0 });
  });

  it('ciclo fechado mantém o que foi gasto e não prevê fixas', () => {
    const closed = closeCycle(base(), at(11, 5));
    const spending = selectCycleSpending(closed, '2026-10', at(11, 5).now);

    expect(spending.phase).toBe('closed');
    expect(spending.expensesTotal).toBe(4500);
    expect(spending.fixedPlanned).toHaveLength(0);
    expect(spending.statements[0]!.total).toBe(10000);
  });
});

describe('selectCycleSpendingRange', () => {
  it('vai do ciclo mais antigo até o último com parcela, com 3 ciclos de margem', () => {
    const range = selectCycleSpendingRange(base(), TODAY.now);

    expect(range).toEqual({ min: '2026-10', max: '2027-01', current: '2026-10' });
  });

  it('estende até a última parcela quando passa da margem', () => {
    const initial = base();
    const state = addCardPurchase(
      initial,
      {
        cardId: initial.creditCards[0]!.id,
        description: 'Notebook',
        category: 'Pessoal',
        totalAmount: 120000,
        installments: 12,
        date: '2026-10-10',
      },
      TODAY,
    );

    expect(selectCycleSpendingRange(state, TODAY.now).max).toBe('2027-09');
  });
});

import { addCardPurchase, saveCreditCard } from './card.use-cases';
import {
  filterCategorizedItems,
  selectCategorizedItems,
  sumCategorizedItems,
  summarizeByCategory,
} from './category-analysis';
import { addExpense, closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import { payFixedExpense } from './payment.use-cases';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const at = (day: number, month = 10): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});
const ALL = { expense: true, card: true, fixed: true, installment: true };

function fixture(): LocalState {
  let state = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [
        { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 100000 },
        {
          id: 'curso',
          type: 'installment',
          name: 'Curso',
          category: 'Educação',
          installmentAmount: 20000,
          totalInstallments: 3,
          remainingInstallments: 3,
        },
      ],
    },
    at(10),
  );
  state = openCycle(state, at(10));
  state = addExpense(
    state,
    { amount: 3000, category: 'Alimentação', description: 'Almoço', date: '2026-10-10' },
    at(10),
  );
  state = closeCycle(state, at(7, 11));
  state = openCycle(state, at(7, 11));
  state = addExpense(
    state,
    { amount: 1500, category: ' Alimentação ', description: 'Café', date: '2026-11-08' },
    at(8, 11),
  );
  state = saveCreditCard(state, { name: 'Cartão', closingDay: 1, dueDay: 10 }, at(8, 11));
  const cardId = state.creditCards[0]!.id;
  state = addCardPurchase(
    state,
    {
      cardId,
      description: 'Tênis',
      category: 'Vestuário',
      totalAmount: 30000,
      installments: 3,
      date: '2026-11-08',
    },
    at(8, 11),
  );
  state = payFixedExpense(state, { fixedExpenseId: 'aluguel', method: 'pix' }, at(8, 11));
  state = payFixedExpense(
    state,
    { fixedExpenseId: 'curso', method: 'credit', cardId, installments: 1, interest: 500 },
    at(8, 11),
  );
  return state;
}

describe('selectCategorizedItems', () => {
  it('reúne gastos de todos os ciclos, compras e fixas pagas (fixa no crédito conta uma vez)', () => {
    const items = selectCategorizedItems(fixture());

    expect(items.filter((item) => item.type === 'expense')).toHaveLength(2);
    expect(items.filter((item) => item.type === 'card').map((item) => item.name)).toEqual([
      'Tênis (3x)',
    ]);
    expect(items.find((item) => item.type === 'installment')).toMatchObject({
      name: 'Curso (no crédito)',
      amount: 20500,
    });
    expect(items.find((item) => item.type === 'fixed')).toMatchObject({ amount: 100000 });
  });
});

describe('filterCategorizedItems e totais', () => {
  it('filtra por período, tipo e categoria e soma em centavos', () => {
    const items = selectCategorizedItems(fixture());
    const november = filterCategorizedItems(items, {
      start: new Date(2026, 10, 1),
      end: new Date(2026, 10, 30),
      category: null,
      types: ALL,
    });

    expect(sumCategorizedItems(november)).toBe(1500 + 30000 + 100000 + 20500);
    expect(summarizeByCategory(november)[0]).toEqual({ category: 'Moradia', total: 100000 });

    const food = filterCategorizedItems(items, {
      start: new Date(2026, 9, 1),
      end: new Date(2026, 10, 30),
      category: 'Alimentação',
      types: { ...ALL, card: false },
    });
    expect(summarizeByCategory(food)).toEqual([{ category: 'Alimentação', total: 4500 }]);
  });

  it('período inválido não devolve itens', () => {
    const items = selectCategorizedItems(fixture());
    const filter = { category: null, types: ALL };

    expect(filterCategorizedItems(items, { ...filter, start: null, end: new Date() })).toEqual([]);
    expect(
      filterCategorizedItems(items, {
        ...filter,
        start: new Date(2026, 10, 30),
        end: new Date(2026, 10, 1),
      }),
    ).toEqual([]);
  });
});

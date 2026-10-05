import { addCardPurchase, payStatement, saveCreditCard } from './card.use-cases';
import { addExpense, closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import {
  EMPTY_PAID_HISTORY_FILTER,
  filterPaidHistory,
  listHistoryStatementKeys,
  PAID_HISTORY_LABELS,
  selectPaidHistory,
  sumPaidHistory,
} from './paid-history';
import { payFixedExpense } from './payment.use-cases';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const at = (day: number, month = 10): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

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
  state = saveCreditCard(state, { name: 'Nubank', closingDay: 1, dueDay: 10 }, at(8, 11));
  const cardId = state.creditCards[0]!.id;
  state = addCardPurchase(
    state,
    {
      cardId,
      description: 'Tênis',
      category: 'Vestuário',
      totalAmount: 30000,
      installments: 1,
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

describe('selectPaidHistory', () => {
  it('reúne gasto, cartão, fixa e parcelado de todos os ciclos, do mais recente ao mais antigo', () => {
    const items = selectPaidHistory(fixture());

    expect(items.at(-1)?.name).toBe('Almoço');
    expect(items.map((item) => `${item.type}:${item.name}`).sort()).toEqual([
      'card:Tênis',
      'expense:Almoço',
      'expense:Café',
      'fixed:Aluguel',
      'installment:Curso (no crédito)',
    ]);
    expect(sumPaidHistory(items)).toBe(100000 + 20500 + 1500 + 30000 + 3000);
    expect(PAID_HISTORY_LABELS.statement).toBe('Fatura');
  });

  it('editar: gasto e compra liberados; excluir/desfazer também em fixa e parcelado; ciclo fechado não', () => {
    const items = selectPaidHistory(fixture());

    const names = (pick: (item: (typeof items)[number]) => boolean) =>
      items
        .filter(pick)
        .map((item) => item.name)
        .sort();

    expect(names((item) => item.editable)).toEqual(['Café', 'Tênis']);
    expect(names((item) => item.deletable)).toEqual([
      'Aluguel',
      'Café',
      'Curso (no crédito)',
      'Tênis',
    ]);
    expect(items.find((item) => item.name === 'Almoço')?.cycleId).not.toBeNull();
    expect(items.find((item) => item.name === 'Almoço')?.cycleId).not.toBe(
      items.find((item) => item.name === 'Café')?.cycleId,
    );
    // BR-FIN-039: a compra de 08/11 cai na fatura que fecha 01/12 e vence 10/12, num ciclo que
    // ainda não foi aberto; a fixa paga no crédito segue a mesma fatura.
    expect(items.find((item) => item.name === 'Tênis')).toMatchObject({
      cycleId: null,
      statementKey: '2026-12',
      dueDate: '2026-12-10',
    });
    expect(items.find((item) => item.name === 'Curso (no crédito)')).toMatchObject({
      cycleId: null,
      statementKey: '2026-12',
    });
    expect(items.find((item) => item.name === 'Café')).toMatchObject({
      statementKey: null,
      dueDate: null,
    });
  });

  it('BR-FIN-039: o crédito fica no ciclo em que a fatura vence; o filtro de fatura isola as linhas', () => {
    let state = fixture();
    state = saveCreditCard(state, { name: 'Inter', closingDay: 20, dueDay: 25 }, at(8, 11));
    const inter = state.creditCards.find((card) => card.name === 'Inter')!.id;
    state = addCardPurchase(
      state,
      {
        cardId: inter,
        description: 'Livro',
        category: 'Educação',
        totalAmount: 5000,
        installments: 1,
        date: '2026-11-08',
      },
      at(8, 11),
    );
    const items = selectPaidHistory(state);
    const cafe = items.find((item) => item.name === 'Café')!;

    // Fecha 20/11 e vence 25/11, dentro do ciclo ativo (07/11 a 06/12).
    expect(items.find((item) => item.name === 'Livro')).toMatchObject({
      cycleId: cafe.cycleId,
      statementKey: '2026-11',
      dueDate: '2026-11-25',
    });
    expect(
      filterPaidHistory(items, { ...EMPTY_PAID_HISTORY_FILTER, statementKey: '2026-12' })
        .map((item) => item.name)
        .sort(),
    ).toEqual(['Curso (no crédito)', 'Tênis']);
    expect(listHistoryStatementKeys(items)).toEqual(['2026-12', '2026-11']);
  });

  it('meio: compra e fixa no crédito = Crédito; gasto, fixa no pix e fatura = Saldo', () => {
    const items = selectPaidHistory(fixture());
    const meansOf = (name: string) => items.find((item) => item.name === name)?.means;

    expect(meansOf('Tênis')).toBe('credit');
    expect(meansOf('Curso (no crédito)')).toBe('credit');
    expect(meansOf('Café')).toBe('balance');
    expect(meansOf('Aluguel')).toBe('balance');
  });

  it('ignora itens excluídos', () => {
    const state = fixture();
    const next = {
      ...state,
      expenses: state.expenses.map((expense) =>
        expense.description === 'Café'
          ? { ...expense, deletedAt: '2026-11-09T00:00:00Z' }
          : expense,
      ),
    };

    expect(selectPaidHistory(next).map((item) => item.name)).not.toContain('Café');
  });

  it('pagamento de fatura é informativo e os encargos entram no total', () => {
    let state = fixture();
    const cardId = state.creditCards[0]!.id;
    const before = sumPaidHistory(selectPaidHistory(state));
    state = payStatement(state, { cardId, statementKey: '2026-12', paidAmount: 60000 }, at(5, 12));
    const items = selectPaidHistory(state).filter((item) => item.type === 'statement');
    const principal = items.find((item) => item.name.startsWith('Pagamento'));
    const charges = items.find((item) => item.name.startsWith('Encargos'));

    expect(principal).toMatchObject({
      means: 'balance',
      countsInTotal: false,
      editable: false,
      deletable: true,
    });
    expect(principal!.sourceId).toBe(charges!.sourceId);
    expect(principal!.amount + charges!.amount).toBe(60000);
    expect(charges).toMatchObject({ countsInTotal: true, amount: charges!.amount });
    expect(sumPaidHistory(selectPaidHistory(state))).toBe(before + charges!.amount);
  });
});

describe('filterPaidHistory', () => {
  const items = selectPaidHistory(fixture());
  const names = (filter: Partial<typeof EMPTY_PAID_HISTORY_FILTER>) =>
    filterPaidHistory(items, { ...EMPTY_PAID_HISTORY_FILTER, ...filter })
      .map((item) => item.name)
      .sort();

  it('sem filtro devolve tudo; busca ignora acento e olha a categoria', () => {
    expect(names({})).toHaveLength(items.length);
    expect(names({ search: 'cafe' })).toEqual(['Café']);
    expect(names({ search: 'moradia' })).toEqual(['Aluguel']);
  });

  it('filtra por tipo, categoria, ciclo e período', () => {
    expect(names({ type: 'card' })).toEqual(['Tênis']);
    expect(names({ category: 'Alimentação' })).toEqual(['Almoço', 'Café']);
    expect(names({ cycleId: items.find((i) => i.name === 'Almoço')!.cycleId })).toEqual(['Almoço']);
    expect(names({ from: '2026-11-01', to: '2026-11-30' })).not.toContain('Almoço');
    expect(names({ to: '2026-10-31' })).toEqual(['Almoço']);
  });

  it('filtra por cartão: compra e fixa paga no crédito; o saldo some', () => {
    const cardId = items.find((item) => item.name === 'Tênis')!.cardId!;

    expect(
      items
        .filter((item) => item.cardId === null)
        .map((item) => item.name)
        .sort(),
    ).toEqual(['Almoço', 'Aluguel', 'Café']);
    expect(names({ cardId })).toEqual(['Curso (no crédito)', 'Tênis']);
    expect(names({ cardId: 'outro-cartao' })).toEqual([]);
  });
});

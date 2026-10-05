import { addCardPurchase, addExistingCardDebt, saveCreditCard } from './card.use-cases';
import { openCycle, saveConfig } from './cycle.use-cases';
import {
  filterPaidHistory,
  EMPTY_PAID_HISTORY_FILTER,
  selectPaidHistory,
  sumPaidHistory,
} from './paid-history';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const TODAY: UseCaseContext = {
  now: new Date(2026, 9, 16, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
};

/** Hoje = 16/10/2026, ciclo 05/10–04/11; cartão fecha dia 20 e vence dia 27. */
function base(): LocalState {
  const configured = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [],
    },
    TODAY,
  );

  return openCycle(
    saveCreditCard(configured, { name: 'Nubank', closingDay: 20, dueDay: 27 }, TODAY),
    TODAY,
  );
}

const cardRows = (state: LocalState) =>
  selectPaidHistory(state, '2026-10-16')
    .filter((item) => item.type === 'card')
    .sort((a, b) => a.date.localeCompare(b.date));

describe('histórico: parcelas do cartão (BR-FIN-038)', () => {
  it('compra 3x gera 3 linhas (1/3, 2/3, 3/3) com centavos certos e datas mês a mês', () => {
    const configured = base();
    const state = addCardPurchase(
      configured,
      {
        cardId: configured.creditCards[0]!.id,
        description: 'Celular',
        category: 'Pessoal',
        totalAmount: 10001,
        installments: 3,
        date: '2026-10-10',
      },
      TODAY,
    );
    expect(state.cardPurchases).toHaveLength(1);

    const rows = cardRows(state);

    expect(rows.map((row) => row.name)).toEqual([
      'Celular (1/3)',
      'Celular (2/3)',
      'Celular (3/3)',
    ]);
    expect(rows.map((row) => row.amount)).toEqual([3334, 3334, 3333]);
    expect(rows.map((row) => row.date)).toEqual(['2026-10-10', '2026-11-10', '2026-12-10']);
    expect(rows.map((row) => row.installment)).toEqual([
      { number: 1, total: 3 },
      { number: 2, total: 3 },
      { number: 3, total: 3 },
    ]);
    expect(rows.map((row) => row.upcoming)).toEqual([false, true, true]);
    // Só a parcela de hoje soma; as por vir são informativas.
    expect(sumPaidHistory(rows)).toBe(3334);
    expect(new Set(rows.map((row) => row.sourceId))).toEqual(new Set([state.cardPurchases[0]!.id]));
    expect(new Set(rows.map((row) => row.id)).size).toBe(3);
    expect(rows.every((row) => row.editable && row.deletable && row.means === 'credit')).toBe(true);
  });

  it('compra à vista no cartão continua uma linha só, sem 1/1', () => {
    const configured = base();
    const state = addCardPurchase(
      configured,
      {
        cardId: configured.creditCards[0]!.id,
        description: 'Tênis',
        category: 'Pessoal',
        totalAmount: 25000,
        installments: 1,
        date: '2026-10-12',
      },
      TODAY,
    );
    const rows = cardRows(state);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'Tênis',
      amount: 25000,
      installment: null,
      upcoming: false,
    });
    expect(rows[0]!.id).toBe(state.cardPurchases[0]!.id);
  });

  it('compra anterior ao app mostra todas as parcelas; as quitadas antes não somam', () => {
    const configured = base();
    const state = addExistingCardDebt(
      configured,
      {
        cardId: configured.creditCards[0]!.id,
        description: 'Geladeira',
        category: 'Casa',
        installmentAmount: 10000,
        totalInstallments: 10,
        remainingInstallments: 6,
        nextStatementKey: '2026-10',
      },
      TODAY,
    );
    const rows = cardRows(state);

    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.installment!.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // 1–4 já estavam pagas; 5 (fatura 10, fecha 20/10) e as seguintes são por vir.
    expect(rows.slice(0, 4).every((row) => !row.countsInTotal && !row.upcoming)).toBe(true);
    expect(rows.slice(4).every((row) => row.upcoming && !row.countsInTotal)).toBe(true);
    expect(rows[4]).toMatchObject({ name: 'Geladeira (5/10)', date: '2026-10-20' });
    expect(sumPaidHistory(rows)).toBe(0);
  });

  it('o filtro por tipo e período vale para as parcelas', () => {
    const configured = base();
    const state = addCardPurchase(
      configured,
      {
        cardId: configured.creditCards[0]!.id,
        description: 'Celular',
        category: 'Pessoal',
        totalAmount: 9000,
        installments: 3,
        date: '2026-10-10',
      },
      TODAY,
    );
    const all = selectPaidHistory(state, '2026-10-16');
    const november = filterPaidHistory(all, {
      ...EMPTY_PAID_HISTORY_FILTER,
      type: 'card',
      from: '2026-11-01',
      to: '2026-11-30',
    });

    expect(november.map((row) => row.name)).toEqual(['Celular (2/3)']);
  });
});

describe('histórico: filtro por cartão (parcelas e fatura)', () => {
  it('cada cartão só vê as próprias parcelas; gasto à vista não tem cartão', () => {
    let state = saveCreditCard(base(), { name: 'Itaú', closingDay: 10, dueDay: 20 }, TODAY);
    const [nubank, itau] = state.creditCards.map((card) => card.id) as [string, string];
    const buyOn = (cardId: string, description: string, installments: number) =>
      addCardPurchase(
        state,
        {
          cardId,
          description,
          category: 'Pessoal',
          totalAmount: 9000,
          installments,
          date: '2026-10-10',
        },
        TODAY,
      );

    state = buyOn(nubank, 'Celular', 3);
    state = buyOn(itau, 'Mochila', 2);

    const all = selectPaidHistory(state, '2026-10-16');
    const names = (cardId: string | null) =>
      filterPaidHistory(all, { ...EMPTY_PAID_HISTORY_FILTER, cardId })
        .map((item) => item.name)
        .sort();

    expect(names(nubank)).toEqual(['Celular (1/3)', 'Celular (2/3)', 'Celular (3/3)']);
    expect(names(itau)).toEqual(['Mochila (1/2)', 'Mochila (2/2)']);
    expect(names(null)).toHaveLength(5);
    expect(all.every((item) => item.cardId !== null)).toBe(true);
  });
});

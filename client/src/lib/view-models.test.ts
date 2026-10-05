import { parseISO } from 'date-fns';

import { addCardPurchase, saveCreditCard } from '@manager-money/core/application/card.use-cases';
import { deleteExpense, saveConfig } from '@manager-money/core/application/cycle.use-cases';
import {
  filterCategorizedItems,
  selectCategorizedItems,
  summarizeByCategory,
} from '@manager-money/core/application/category-analysis';
import { payFixedExpense } from '@manager-money/core/application/payment.use-cases';
import {
  selectActiveMonth,
  selectClosedMonths,
  selectCreditSnapshot,
  selectUpcomingCommitments,
} from '@manager-money/core/application/selectors';
import { createEmptyState } from '@manager-money/core/application/state';
import {
  buildDashboardSummary,
  calculateDayBalance,
} from '@manager-money/core/domain/financial/financial.calculations';

import { at, userFixture } from '../test/fixtures';
import { buildClosedCycles, buildCycleDetail } from './cycles';
import {
  buildHistoryRows,
  categoriesOf,
  EMPTY_FILTER,
  filterHistoryRows,
  sumAmounts,
} from './expenses';
import { buildOverview } from './overview';

const NOW = new Date(2026, 10, 12, 12);

describe('visão geral (paridade com o Hoje do app)', () => {
  it('KPIs e compromissos são os do núcleo para a mesma fixture', () => {
    const state = userFixture();
    const view = buildOverview(state, NOW);
    if (view.kind !== 'active') throw new Error('esperava ciclo ativo');

    expect(view.summary).toEqual(buildDashboardSummary(selectActiveMonth(state)!, NOW));
    expect(view.commitments).toEqual(selectUpcomingCommitments(state, NOW));
    expect(view.savingGoal).toBe(50000);
    expect(view.credit).toEqual(selectCreditSnapshot(state, NOW));
    // 07/11 a 12/11: um ponto por dia, gasto do dia em centavos.
    expect(view.daily.map((point) => point.date)).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
    ]);
    expect(view.daily.find((point) => point.date === '2026-11-08')?.spent).toBe(3000);
  });

  it('estados sem configuração e sem ciclo', () => {
    expect(buildOverview(createEmptyState(), NOW)).toEqual({ kind: 'no-config' });
    const configured = saveConfig(
      createEmptyState(),
      {
        incomeSources: [{ id: 'r', name: 'R', amount: 1000, payday: 5 }],
        savingGoal: 0,
        customCategories: [],
        fixedExpenses: [],
      },
      at(2026, 11, 1),
    );
    expect(buildOverview(configured, NOW)).toEqual({ kind: 'no-cycle' });
  });
});

describe('histórico (tudo que foi pago)', () => {
  const fixture = userFixture();
  const rows = buildHistoryRows(fixture);

  it('lista todos os ciclos, mais recentes primeiro, e marca o fechado como somente leitura', () => {
    expect(rows.map((row) => row.name)).toEqual(['Padaria', 'Ração', 'Ônibus', 'Mercado']);
    expect(rows.filter((row) => row.editable).map((row) => row.name)).toEqual(['Padaria', 'Ração']);
    expect(sumAmounts(rows)).toBe(4590 + 1200 + 3000 + 2550);
  });

  it('busca sem acento, filtra por ciclo, categoria e período', () => {
    expect(filterHistoryRows(rows, { ...EMPTY_FILTER, search: 'onibus' })).toHaveLength(1);
    expect(filterHistoryRows(rows, { ...EMPTY_FILTER, search: 'aliment' })).toHaveLength(2);
    const closedId = selectClosedMonths(fixture)[0]!.id;
    expect(filterHistoryRows(rows, { ...EMPTY_FILTER, cycleId: closedId })).toHaveLength(2);
    expect(filterHistoryRows(rows, { ...EMPTY_FILTER, category: 'Pets' })).toHaveLength(1);
    expect(
      sumAmounts(
        filterHistoryRows(rows, { ...EMPTY_FILTER, from: '2026-10-20', to: '2026-11-08' }),
      ),
    ).toBe(1200 + 3000);
    expect(categoriesOf(rows)).toEqual(['Alimentação', 'Pets', 'Transporte']);
  });

  it('gasto excluído some da tabela', () => {
    const state = userFixture();
    const id = selectActiveMonth(state)!.expenses[0]!.id;
    expect(buildHistoryRows(deleteExpense(state, id, at(2026, 11, 12)))).toHaveLength(3);
  });
});

describe('histórico: parcelas do cartão (BR-FIN-038)', () => {
  it('compra 3x vira 3 linhas (1/3, 2/3, 3/3); só a de hoje soma; lápis aponta a compra', () => {
    let state = userFixture();
    state = saveCreditCard(state, { name: 'Nubank', closingDay: 1, dueDay: 10 }, at(2026, 11, 8));
    state = addCardPurchase(
      state,
      {
        cardId: state.creditCards[0]!.id,
        description: 'Notebook',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 3,
        date: '2026-11-10',
      },
      at(2026, 11, 10),
    );
    const parcels = buildHistoryRows(state, '2026-11-12').filter((row) => row.type === 'card');

    expect(parcels.map((row) => row.name).sort()).toEqual([
      'Notebook (1/3)',
      'Notebook (2/3)',
      'Notebook (3/3)',
    ]);
    expect(parcels.map((row) => row.amount)).toEqual([30000, 30000, 30000]);
    expect(parcels.filter((row) => row.upcoming)).toHaveLength(2);
    expect(sumAmounts(parcels)).toBe(30000);
    expect(new Set(parcels.map((row) => row.sourceId)).size).toBe(1);
  });
});

describe('histórico com cartão e fixas', () => {
  function paidFixture() {
    let state = userFixture();
    state = saveCreditCard(state, { name: 'Nubank', closingDay: 1, dueDay: 10 }, at(2026, 11, 8));
    state = addCardPurchase(
      state,
      {
        cardId: state.creditCards[0]!.id,
        description: 'Tênis',
        category: 'Vestuário',
        totalAmount: 25000,
        installments: 1,
        date: '2026-11-09',
      },
      at(2026, 11, 9),
    );
    return payFixedExpense(state, { fixedExpenseId: 'aluguel', method: 'pix' }, at(2026, 11, 9));
  }

  it('inclui compra no cartão e fixa paga, somente leitura, e filtra por tipo', () => {
    const rows = buildHistoryRows(paidFixture());

    expect(rows.map((row) => row.type).sort()).toEqual([
      'card',
      'expense',
      'expense',
      'expense',
      'expense',
      'fixed',
    ]);
    expect(
      rows
        .filter((row) => row.editable)
        .map((row) => row.name)
        .sort(),
    ).toEqual(['Padaria', 'Ração', 'Tênis']);
    expect(rows.find((row) => row.name === 'Tênis')?.means).toBe('credit');
    expect(rows.find((row) => row.name === 'Aluguel')?.means).toBe('balance');
    expect(sumAmounts(rows)).toBe(4590 + 1200 + 3000 + 2550 + 25000 + 150000);
    expect(filterHistoryRows(rows, { ...EMPTY_FILTER, type: 'card' }).map((r) => r.name)).toEqual([
      'Tênis',
    ]);
    expect(rows.every((row) => row.cycleLabel !== '—')).toBe(true);
  });
});

describe('ciclos', () => {
  it('lista fechados com o resultado gravado no fechamento', () => {
    const state = userFixture();
    const [closed] = buildClosedCycles(state);
    const month = selectClosedMonths(state)[0]!;

    expect(closed).toMatchObject({
      id: month.id,
      year: '2026',
      finalBalance: month.finalBalance,
      totalSpent: 5790,
      expenseCount: 2,
    });
  });

  it('detalhe por dia igual ao histórico diário do app', () => {
    const state = userFixture();
    const month = selectClosedMonths(state)[0]!;
    const detail = buildCycleDetail(state, month.id, NOW)!;

    expect(detail.days.map((day) => [day.date, day.total])).toEqual([
      ['2026-10-20', 1200],
      ['2026-10-08', 4590],
    ]);
    for (const day of detail.days) {
      expect(day.balance).toBe(calculateDayBalance(month, parseISO(day.date)));
    }
    expect(detail.totalSpent).toBe(5790);
    expect(detail.spending.expensesTotal).toBe(5790);
    expect(buildCycleDetail(state, 'nao-existe', NOW)).toBeNull();
  });
});

describe('análise (mesma função do app)', () => {
  it('totais por categoria no período do ciclo ativo', () => {
    const items = selectCategorizedItems(userFixture());
    const totals = summarizeByCategory(
      filterCategorizedItems(items, {
        start: new Date(2026, 10, 7),
        end: new Date(2026, 11, 6),
        category: null,
        types: { expense: true, card: true, installment: false, fixed: false },
      }),
    );
    expect(totals).toEqual([
      { category: 'Pets', total: 3000 },
      { category: 'Alimentação', total: 2550 },
    ]);
  });
});

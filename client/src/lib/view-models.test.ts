import { parseISO } from 'date-fns';

import { deleteExpense, saveConfig } from '@manager-money/core/application/cycle.use-cases';
import {
  filterCategorizedItems,
  selectCategorizedItems,
  summarizeByCategory,
} from '@manager-money/core/application/category-analysis';
import {
  selectActiveMonth,
  selectClosedMonths,
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
  buildExpenseRows,
  categoriesOf,
  EMPTY_FILTER,
  filterExpenseRows,
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

describe('tabela de gastos', () => {
  const fixture = userFixture();
  const rows = buildExpenseRows(fixture);

  it('lista todos os ciclos, mais recentes primeiro, e marca o fechado como somente leitura', () => {
    expect(rows.map((row) => row.description)).toEqual(['Padaria', 'Ração', 'Ônibus', 'Mercado']);
    expect(rows.filter((row) => row.editable).map((row) => row.description)).toEqual([
      'Padaria',
      'Ração',
    ]);
    expect(sumAmounts(rows)).toBe(4590 + 1200 + 3000 + 2550);
  });

  it('busca sem acento, filtra por ciclo, categoria e período', () => {
    expect(filterExpenseRows(rows, { ...EMPTY_FILTER, search: 'onibus' })).toHaveLength(1);
    expect(filterExpenseRows(rows, { ...EMPTY_FILTER, search: 'aliment' })).toHaveLength(2);
    const closedId = selectClosedMonths(fixture)[0]!.id;
    expect(filterExpenseRows(rows, { ...EMPTY_FILTER, cycleId: closedId })).toHaveLength(2);
    expect(filterExpenseRows(rows, { ...EMPTY_FILTER, category: 'Pets' })).toHaveLength(1);
    expect(
      sumAmounts(
        filterExpenseRows(rows, { ...EMPTY_FILTER, from: '2026-10-20', to: '2026-11-08' }),
      ),
    ).toBe(1200 + 3000);
    expect(categoriesOf(rows)).toEqual(['Alimentação', 'Pets', 'Transporte']);
  });

  it('gasto excluído some da tabela', () => {
    const state = userFixture();
    const id = selectActiveMonth(state)!.expenses[0]!.id;
    expect(buildExpenseRows(deleteExpense(state, id, at(2026, 11, 12)))).toHaveLength(3);
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

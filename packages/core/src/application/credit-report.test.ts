import { addCardPurchase, addExistingCardDebt, saveCreditCard } from './card.use-cases';
import {
  filterCategorizedItemsByType,
  selectCycleCategorizedItems,
  sumCategorizedItems,
} from './category-analysis';
import { selectCreditReport, selectCreditReportYears } from './credit-report';
import { addExpense, openCycle, saveConfig } from './cycle.use-cases';
import { selectActiveCycle, selectCycleSpending } from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const at = (day: number): UseCaseContext => ({
  now: new Date(2026, 9, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

/** Hoje = 16/10/2026; ciclo 05/10–04/11; cartão fecha dia 8 e vence dia 15. */
function fixture(): LocalState {
  let state = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [],
    },
    at(16),
  );
  state = openCycle(
    saveCreditCard(state, { name: 'Inter', closingDay: 8, dueDay: 15, creditLimit: 500000 }, at(6)),
    at(6),
  );
  const cardId = state.creditCards[0]!.id;
  state = addExistingCardDebt(
    state,
    {
      cardId,
      description: 'Sofá',
      category: 'Casa',
      installmentAmount: 10000,
      totalInstallments: 5,
      remainingInstallments: 3,
      nextStatementKey: '2026-10',
    },
    at(6),
  );
  const buy = (date: string, totalAmount: number, installments: number, description: string) =>
    addCardPurchase(
      state,
      { cardId, description, category: 'Lazer', totalAmount, installments, date },
      at(16),
    );
  state = buy('2026-10-06', 9000, 3, 'Show');
  state = buy('2026-10-10', 20000, 1, 'Viagem');

  return addExpense(
    state,
    { description: 'Mercado', category: 'Mercado', amount: 5000, date: '2026-10-06' },
    at(16),
  );
}

describe('selectCycleCategorizedItems (BR-FIN-039)', () => {
  it('base "Ciclo": gastos do ciclo e parcelas das faturas que vencem nele', () => {
    const state = fixture();
    const cycle = selectActiveCycle(state)!;
    const items = selectCycleCategorizedItems(state, cycle.id);

    expect(items.map((item) => [item.type, item.name, item.amount])).toEqual([
      ['expense', 'Mercado', 5000],
      ['card', 'Sofá (3/5)', 10000],
      ['card', 'Show (1/3)', 3000],
    ]);
    // Mesmo total do ciclo (gastos + faturas que vencem nele).
    const spending = selectCycleSpending(state, '2026-10', at(16).now);

    expect(sumCategorizedItems(items)).toBe(spending.expensesTotal + spending.cardTotal);
    expect(
      filterCategorizedItemsByType(items, {
        category: 'Lazer',
        types: { expense: true, card: true, fixed: true, installment: true },
      }).map((item) => item.name),
    ).toEqual(['Show (1/3)']);
    expect(selectCycleCategorizedItems(state, 'nao-existe')).toEqual([]);
  });
});

describe('selectCreditReport (BR-FIN-039)', () => {
  it('faturas com período, vencimento, ciclo em que pesam e total por mês', () => {
    const state = fixture();
    const cycle = selectActiveCycle(state)!;
    const report = selectCreditReport(state, at(16).now, { cardId: null, year: null });

    expect(
      report.statements.map((item) => [item.key, item.openDate, item.closingDate, item.amount]),
    ).toEqual([
      ['2026-12', '2026-11-09', '2026-12-08', 13000],
      ['2026-11', '2026-10-09', '2026-11-08', 33000],
      ['2026-10', '2026-09-09', '2026-10-08', 13000],
    ]);
    expect(report.statements.at(-1)).toMatchObject({
      dueDate: '2026-10-15',
      cycleId: cycle.id,
      status: 'overdue',
    });
    expect(report.statements[0]!.cycleId).toBeNull();
    expect(report.months.map((month) => [month.key, month.amount])).toEqual([
      ['2026-10', 13000],
      ['2026-11', 33000],
      ['2026-12', 13000],
    ]);
    expect(report.totals).toEqual({ amount: 59000, charges: 0, paid: 0, remaining: 59000 });
    expect(selectCreditReportYears(state, at(16).now)).toEqual(['2026']);
  });

  it('filtra por cartão e por ano', () => {
    const state = fixture();

    expect(
      selectCreditReport(state, at(16).now, { cardId: 'outro', year: null }).statements,
    ).toEqual([]);
    expect(selectCreditReport(state, at(16).now, { cardId: null, year: '2027' }).totals).toEqual({
      amount: 0,
      charges: 0,
      paid: 0,
      remaining: 0,
    });
  });
});

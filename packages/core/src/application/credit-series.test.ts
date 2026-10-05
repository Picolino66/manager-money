import { addCardPurchase, addExistingCardDebt, saveCreditCard } from './card.use-cases';
import { selectCreditDailySeries } from './credit-series';
import { openCycle, saveConfig } from './cycle.use-cases';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const TODAY: UseCaseContext = {
  now: new Date(2026, 9, 16, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
};

/** Hoje = 16/10/2026, ciclo 05/10–04/11; cartão fecha dia 20 e vence dia 27. */
function base(limit: number | null = 500000): LocalState {
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
    saveCreditCard(
      configured,
      { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: limit ?? undefined },
      TODAY,
    ),
    TODAY,
  );
}

const buy = (state: LocalState, date: string, totalAmount: number, installments = 1) =>
  addCardPurchase(
    state,
    {
      cardId: state.creditCards[0]!.id,
      description: 'Compra',
      category: 'Pessoal',
      totalAmount,
      installments,
      date,
    },
    TODAY,
  );

const DAYS = ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13'];

describe('selectCreditDailySeries (BR-FIN-037)', () => {
  it('gasto do dia pelo valor total e limite disponível "como estava" em cada dia', () => {
    let state = buy(base(), '2026-10-10', 30000);

    state = buy(state, '2026-10-12', 9000, 3);

    const series = selectCreditDailySeries(state, DAYS);

    expect(series.map((point) => point.creditSpent)).toEqual([0, 30000, 0, 9000, 0]);
    expect(series.map((point) => point.creditAvailable)).toEqual([
      500000, 470000, 470000, 461000, 461000,
    ]);
  });

  it('compra anterior ao app já pesa desde o 1º dia e não conta como gasto do dia', () => {
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
    const series = selectCreditDailySeries(state, DAYS);

    expect(series.every((point) => point.creditSpent === 0)).toBe(true);
    // 6 parcelas restantes de R$ 100,00 comprometem R$ 600,00 desde sempre.
    expect(series.every((point) => point.creditAvailable === 500000 - 60000)).toBe(true);
  });

  it('cartão sem limite: disponível nulo, mas o gasto aparece', () => {
    const state = buy(base(null), '2026-10-10', 12000);
    const series = selectCreditDailySeries(state, DAYS);

    expect(series.map((point) => point.creditAvailable)).toEqual([null, null, null, null, null]);
    expect(series[1]!.creditSpent).toBe(12000);
  });

  it('sem cartões: tudo zerado e sem limite', () => {
    const state = openCycle(
      saveConfig(
        createEmptyState(),
        {
          incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
          savingGoal: 0,
          customCategories: [],
          fixedExpenses: [],
        },
        TODAY,
      ),
      TODAY,
    );

    expect(selectCreditDailySeries(state, DAYS.slice(0, 2))).toEqual([
      { date: '2026-10-09', creditSpent: 0, creditAvailable: null },
      { date: '2026-10-10', creditSpent: 0, creditAvailable: null },
    ]);
  });
});

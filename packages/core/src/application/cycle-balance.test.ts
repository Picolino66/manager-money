import { saveCreditCard } from './card.use-cases';
import { selectBalanceDailySeries } from './credit-series';
import { selectCycleBalance } from './cycle-balance';
import { addExpense, openCycle, saveConfig } from './cycle.use-cases';
import { payFixedExpense } from './payment.use-cases';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const TODAY: UseCaseContext = {
  now: new Date(2026, 9, 16, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
};

/** Renda R$ 5.000,00; meta R$ 500,00; aluguel R$ 1.000,00 e luz R$ 200,00; ciclo 05/10–04/11. */
function fixture(): LocalState {
  const configured = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 5 }],
      savingGoal: 50000,
      customCategories: [],
      fixedExpenses: [
        { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 100000 },
        { id: 'luz', type: 'permanent', name: 'Luz', category: 'Moradia', amount: 20000 },
      ],
    },
    TODAY,
  );

  return saveCreditCard(
    openCycle(configured, TODAY),
    { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: 500000 },
    TODAY,
  );
}

describe('selectCycleBalance (BR-FIN-041)', () => {
  it('saldo em conta = disponível + reservados + meta', () => {
    expect(selectCycleBalance(fixture(), TODAY.now)).toEqual({
      balance: 500000,
      reserved: 120000,
      savingGoal: 50000,
      fixedPaid: 0,
    });
  });

  it('pagar fixa pelo saldo baixa o saldo, não o disponível; gasto baixa os dois', () => {
    let state = payFixedExpense(fixture(), { fixedExpenseId: 'aluguel', method: 'pix' }, TODAY);
    state = addExpense(
      state,
      { description: 'Mercado', category: 'Mercado', amount: 10000, date: '2026-10-16' },
      TODAY,
    );

    expect(selectCycleBalance(state, TODAY.now)).toEqual({
      balance: 390000,
      reserved: 20000,
      savingGoal: 50000,
      fixedPaid: 100000,
    });
  });

  it('sem ciclo ativo não há saldo', () => {
    expect(selectCycleBalance(createEmptyState(), TODAY.now)).toBeNull();
  });
});

describe('selectBalanceDailySeries: fixas pagas (BR-FIN-041)', () => {
  it('fixa paga pelo saldo aparece no dia; no crédito, não; o disponível não muda', () => {
    const before = selectBalanceDailySeries(fixture(), ['2026-10-16'], '2026-10-16')[0]!;
    let state = payFixedExpense(fixture(), { fixedExpenseId: 'aluguel', method: 'pix' }, TODAY);
    state = payFixedExpense(
      state,
      {
        fixedExpenseId: 'luz',
        method: 'credit',
        cardId: state.creditCards[0]!.id,
        installments: 1,
      },
      TODAY,
    );
    const [point] = selectBalanceDailySeries(state, ['2026-10-16'], '2026-10-16');

    expect(point).toMatchObject({ spent: 0, fixedPaid: 100000 });
    expect(point!.available).toBe(before.available);
  });
});

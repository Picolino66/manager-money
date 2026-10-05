import { addCardPurchase, saveCreditCard, setCreditCardActive } from './card.use-cases';
import { openCycle, saveConfig } from './cycle.use-cases';
import { selectCreditSnapshot } from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (month: number, day: number): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});
const TODAY = at(10, 16);

const config: FinancialConfigInput = {
  incomeSources: [{ id: 'salario', name: 'Salário', amount: 500000, payday: 5 }],
  savingGoal: 100000,
  customCategories: [],
  fixedExpenses: [],
};

/** Hoje = 16/10; ciclo 05/10–04/11; fatura vigente de cada cartão fecha dia 20. */
function base(limit: number | null = 500000): LocalState {
  const configured = saveConfig(createEmptyState(), config, TODAY);

  return openCycle(
    saveCreditCard(
      configured,
      { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: limit ?? undefined },
      TODAY,
    ),
    TODAY,
  );
}

const buy = (state: LocalState, date: string, totalAmount: number, cardId?: string) =>
  addCardPurchase(
    state,
    {
      cardId: cardId ?? state.creditCards[0]!.id,
      description: 'Compra',
      category: 'Pessoal',
      totalAmount,
      installments: 1,
      date,
    },
    TODAY,
  );

describe('selectCreditSnapshot (BR-FIN-037)', () => {
  it('sem compras: limite inteiro disponível e fatura vigente zerada', () => {
    expect(selectCreditSnapshot(base(), TODAY.now)).toEqual({
      availableLimit: 500000,
      cardsWithoutLimit: 0,
      currentStatementAmount: 0,
      cards: 1,
    });
  });

  it('compra até o fechamento cai na fatura vigente e reduz o limite', () => {
    const state = buy(base(), '2026-10-10', 30000);
    const snapshot = selectCreditSnapshot(state, TODAY.now);

    expect(snapshot.currentStatementAmount).toBe(30000);
    expect(snapshot.availableLimit).toBe(470000);
  });

  it('compra depois do fechamento vai para a próxima fatura, não para a vigente', () => {
    const state = buy(base(), '2026-10-25', 30000);
    // Hoje (16/10) ainda é a fatura que fecha dia 20: a compra de 25/10 não entra nela.
    const snapshot = selectCreditSnapshot(state, new Date(2026, 9, 25, 12));

    expect(snapshot.currentStatementAmount).toBe(30000);
    expect(selectCreditSnapshot(state, TODAY.now).currentStatementAmount).toBe(0);
    expect(snapshot.availableLimit).toBe(470000);
  });

  it('cartão sem limite não entra no disponível; só ele → null', () => {
    const state = buy(base(null), '2026-10-10', 12000);
    const snapshot = selectCreditSnapshot(state, TODAY.now);

    expect(snapshot).toMatchObject({
      availableLimit: null,
      cardsWithoutLimit: 1,
      currentStatementAmount: 12000,
    });
  });

  it('soma cartões ativos e ignora o inativo', () => {
    let state = saveCreditCard(
      buy(base(), '2026-10-10', 30000),
      { name: 'Itaú', closingDay: 20, dueDay: 27, creditLimit: 200000 },
      TODAY,
    );
    state = buy(state, '2026-10-12', 5000, state.creditCards[1]!.id);

    expect(selectCreditSnapshot(state, TODAY.now)).toMatchObject({
      availableLimit: 470000 + 195000,
      currentStatementAmount: 35000,
      cards: 2,
    });

    const off = setCreditCardActive(state, state.creditCards[1]!.id, false, TODAY);

    expect(selectCreditSnapshot(off, TODAY.now)).toMatchObject({
      availableLimit: 470000,
      currentStatementAmount: 30000,
      cards: 1,
    });
  });

  it('limite estourado fica negativo', () => {
    const state = buy(base(10000), '2026-10-10', 15000);

    expect(selectCreditSnapshot(state, TODAY.now).availableLimit).toBe(-5000);
  });

  it('sem cartões: tudo zerado', () => {
    const state = openCycle(saveConfig(createEmptyState(), config, TODAY), TODAY);

    expect(selectCreditSnapshot(state, TODAY.now)).toEqual({
      availableLimit: null,
      cardsWithoutLimit: 0,
      currentStatementAmount: 0,
      cards: 0,
    });
  });
});

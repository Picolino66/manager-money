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
      cycleStatementsAmount: 0,
      statements: [],
      cards: 1,
    });
  });

  it('compra até o fechamento cai na fatura que vence no ciclo e reduz o limite', () => {
    const state = buy(base(), '2026-10-10', 30000);
    const snapshot = selectCreditSnapshot(state, TODAY.now);

    expect(snapshot.cycleStatementsAmount).toBe(30000);
    expect(snapshot.availableLimit).toBe(470000);
    // Fatura 2026-10: abre 21/09, fecha 20/10 e vence 27/10 (dentro do ciclo 05/10–04/11).
    expect(snapshot.statements).toEqual([
      {
        cardId: state.creditCards[0]!.id,
        cardName: 'Nubank',
        key: '2026-10',
        openDate: '2026-09-21',
        closingDate: '2026-10-20',
        dueDate: '2026-10-27',
        amount: 30000,
      },
    ]);
  });

  it('compra depois do fechamento vence no ciclo seguinte: não entra no gasto deste ciclo', () => {
    const state = buy(base(), '2026-10-25', 30000);
    const snapshot = selectCreditSnapshot(state, TODAY.now);

    expect(snapshot.cycleStatementsAmount).toBe(0);
    expect(snapshot.statements).toEqual([]);
    // O limite, porém, já está comprometido.
    expect(snapshot.availableLimit).toBe(470000);
  });

  it('exemplo: ciclo 25/09–24/10, cartão 05→fechamento, vencimento 10/10', () => {
    const ctx: UseCaseContext = { ...TODAY, now: new Date(2026, 9, 5, 12) };
    const configured = saveConfig(
      createEmptyState(),
      {
        incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 25 }],
        savingGoal: 0,
        customCategories: [],
        fixedExpenses: [],
      },
      ctx,
    );
    let state = openCycle(
      saveCreditCard(configured, { name: 'Picpay', closingDay: 5, dueDay: 10 }, ctx),
      ctx,
    );
    const cardId = state.creditCards[0]!.id;
    const purchase = (date: string, totalAmount: number) =>
      addCardPurchase(
        state,
        { cardId, description: 'Compra', category: 'Pessoal', totalAmount, installments: 1, date },
        ctx,
      );

    state = purchase('2026-09-27', 10000); // fatura que fecha em 05/10 e vence em 10/10
    state = purchase('2026-10-05', 5000); // ainda é a mesma fatura (fecha no dia 5)
    state = purchase('2026-10-06', 7000); // próxima fatura: vence só em 10/11

    const snapshot = selectCreditSnapshot(state, ctx.now);

    expect(snapshot.cycleStatementsAmount).toBe(15000);
    expect(snapshot.statements).toMatchObject([
      { key: '2026-10', openDate: '2026-09-06', closingDate: '2026-10-05', dueDate: '2026-10-10' },
    ]);
  });

  it('cartão sem limite não entra no disponível; só ele → null', () => {
    const state = buy(base(null), '2026-10-10', 12000);
    const snapshot = selectCreditSnapshot(state, TODAY.now);

    expect(snapshot).toMatchObject({
      availableLimit: null,
      cardsWithoutLimit: 1,
      cycleStatementsAmount: 12000,
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
      cycleStatementsAmount: 35000,
      cards: 2,
    });

    const off = setCreditCardActive(state, state.creditCards[1]!.id, false, TODAY);

    expect(selectCreditSnapshot(off, TODAY.now)).toMatchObject({
      availableLimit: 470000,
      cycleStatementsAmount: 30000,
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
      cycleStatementsAmount: 0,
      statements: [],
      cards: 0,
    });
  });
});

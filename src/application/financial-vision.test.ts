/**
 * Cenários de comportamento da visão de produto (SPEC-016/017/018, ADR-017): orçamento do ciclo,
 * limite diário, cartão, fatura, parcelamento, situação inicial e projeção.
 *
 * Base: renda R$ 5.000 (dia 5), meta R$ 1.000, aluguel R$ 1.500; cartão com limite R$ 6.000,
 * fecha dia 20 e vence dia 27. Hoje = 16/10/2026, ciclo 05/10–04/11 (restam 20 dias).
 */
import {
  addCardPurchase,
  addExistingCardDebt,
  canModifyCardPurchase,
  deleteCardPurchase,
  payStatement,
  saveCreditCard,
  undoStatementPayment,
  updateCardPurchase,
} from './card.use-cases';
import { addExpense, closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import { addExtraIncome, payFixedExpense } from './payment.use-cases';
import {
  selectActiveCycle,
  selectActiveMonth,
  selectCardLimitUsage,
  selectCardStatements,
  selectCycleProjections,
  selectUpcomingCommitments,
} from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import { buildDashboardSummary } from '../domain/financial/financial.calculations';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (month: number, day: number, year = 2026): UseCaseContext => ({
  now: new Date(year, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});
const TODAY = at(10, 16);

const config: FinancialConfigInput = {
  incomeSources: [{ id: 'salario', name: 'Salário', amount: 500000, payday: 5 }],
  savingGoal: 100000,
  customCategories: [],
  fixedExpenses: [
    { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 150000 },
  ],
};

function base(ctx = TODAY): LocalState {
  const configured = saveConfig(createEmptyState(), config, ctx);
  const withCard = saveCreditCard(
    configured,
    { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: 600000 },
    ctx,
  );

  return openCycle(withCard, ctx);
}

const cardId = (state: LocalState) => state.creditCards[0]!.id;
const initial = (state: LocalState) => selectActiveCycle(state)!.initialAvailableAmount;
const summaryOn = (state: LocalState, month: number, day: number) =>
  buildDashboardSummary(selectActiveMonth(state)!, new Date(2026, month - 1, day, 12));
const limitOf = (state: LocalState) => selectCardLimitUsage(state, cardId(state))!;
const purchase = (
  state: LocalState,
  date: string,
  totalAmount: number,
  installments = 1,
  ctx = TODAY,
) =>
  addCardPurchase(
    state,
    {
      cardId: cardId(state),
      description: 'Compra',
      category: 'Pessoal',
      totalAmount,
      installments,
      date,
    },
    ctx,
  );

beforeEach(() => {
  sequence = 0;
});

describe('resultado esperado (seção 26 da visão)', () => {
  it('R$ 2.500 disponíveis no ciclo, 20 dias, R$ 125 por dia; parcelas futuras não pesam agora', () => {
    const state = addExistingCardDebt(
      base(),
      {
        cardId: 'card-1',
        description: 'Celular',
        category: 'Pessoal',
        installmentAmount: 10000,
        totalInstallments: 7,
        remainingInstallments: 7,
        nextStatementKey: '2026-11',
      },
      TODAY,
    );
    const summary = summaryOn(state, 10, 16);

    expect(selectActiveCycle(state)).toMatchObject({
      startDate: '2026-10-05',
      endDate: '2026-11-04',
    });
    expect(initial(state)).toBe(250000);
    expect(summary.remainingDays).toBe(20);
    expect(summary.currentDailyLimit).toBe(12500);
    // As 7 parcelas de R$ 100 aparecem na projeção dos próximos ciclos.
    expect(selectCycleProjections(state, TODAY.now, 2)).toEqual([
      expect.objectContaining({
        cycleKey: '2026-11',
        income: 500000,
        savingGoal: 100000,
        fixedExpenses: 150000,
        cardCharges: 10000,
        free: 240000,
      }),
      expect.objectContaining({ cycleKey: '2026-12', cardCharges: 10000, free: 240000 }),
    ]);
  });

  it('gasto no Pix reduz o saldo na hora e recalcula o limite dos próximos dias', () => {
    const state = addExpense(
      base(),
      { amount: 5000, category: 'Alimentação', description: 'Pix', date: '2026-10-16' },
      TODAY,
    );

    expect(summaryOn(state, 10, 16)).toMatchObject({
      todaySpent: 5000,
      todayBalance: 7500,
      remainingAvailableAmount: 245000,
    });
    // (2.500 − 50) ÷ 19 dias.
    expect(summaryOn(state, 10, 17).currentDailyLimit).toBe(Math.trunc(245000 / 19));
    expect(limitOf(state).available).toBe(600000);
  });

  it('gastar acima ou abaixo do limite de hoje muda o limite dos próximos dias', () => {
    const above = addExpense(
      base(),
      { amount: 30000, category: 'Lazer', description: 'Show', date: '2026-10-16' },
      TODAY,
    );
    const below = addExpense(
      base(),
      { amount: 2500, category: 'Lazer', description: 'Café', date: '2026-10-16' },
      TODAY,
    );

    expect(summaryOn(above, 10, 17).currentDailyLimit).toBe(Math.trunc(220000 / 19));
    expect(summaryOn(above, 10, 17).currentDailyLimit).toBeLessThan(12500);
    expect(summaryOn(below, 10, 17).currentDailyLimit).toBe(Math.trunc(247500 / 19));
    expect(summaryOn(below, 10, 17).currentDailyLimit).toBeGreaterThan(12500);
  });

  it('compra de R$ 600 no crédito antes do fechamento: limite cai na hora e a fatura pesa neste ciclo', () => {
    const state = purchase(base(), '2026-10-16', 60000);

    expect(limitOf(state)).toEqual({ creditLimit: 600000, committed: 60000, available: 540000 });
    // Fatura de outubro (fecha 20/10, vence 27/10) pertence ao ciclo atual.
    expect(selectCardStatements(state, cardId(state), TODAY.now)).toEqual([
      expect.objectContaining({
        key: '2026-10',
        closingDate: '2026-10-20',
        dueDate: '2026-10-27',
        amount: 60000,
        status: 'open',
      }),
    ]);
    expect(initial(state)).toBe(190000);
    // A compra não é gasto do dia: o dia não fica negativo, mas o limite diário cai.
    expect(summaryOn(state, 10, 16)).toMatchObject({ todaySpent: 0, currentDailyLimit: 9500 });
  });

  it('compra depois do fechamento entra na próxima fatura e compromete o próximo ciclo', () => {
    const ctx = at(10, 22);
    const state = purchase(base(), '2026-10-22', 60000, 1, ctx);

    expect(selectCardStatements(state, cardId(state), ctx.now)).toEqual([
      expect.objectContaining({ key: '2026-11', dueDate: '2026-11-27', amount: 60000 }),
    ]);
    expect(initial(state)).toBe(250000);
    expect(limitOf(state).available).toBe(540000);
    expect(selectCycleProjections(state, ctx.now, 1)[0]).toMatchObject({
      cycleKey: '2026-11',
      cardCharges: 60000,
    });
  });

  it('6x de R$ 100: cada parcela cai na sua fatura e compromete o respectivo ciclo', () => {
    const ctx = at(10, 22);
    const state = purchase(base(), '2026-10-22', 60000, 6, ctx);
    const statements = selectCardStatements(state, cardId(state), ctx.now);

    expect(
      statements.map((statement) => [statement.key, statement.dueDate, statement.amount]),
    ).toEqual([
      ['2026-11', '2026-11-27', 10000],
      ['2026-12', '2026-12-27', 10000],
      ['2027-01', '2027-01-27', 10000],
      ['2027-02', '2027-02-27', 10000],
      ['2027-03', '2027-03-27', 10000],
      ['2027-04', '2027-04-27', 10000],
    ]);
    expect(statements[0]!.installments[0]).toMatchObject({ number: 1, cycleKey: '2026-11' });
    expect(statements[5]!.installments[0]).toMatchObject({ number: 6, cycleKey: '2027-04' });
    // O limite compromete o total na hora.
    expect(limitOf(state).committed).toBe(60000);
    expect(
      selectCycleProjections(state, ctx.now, 7).map((projection) => projection.cardCharges),
    ).toEqual([10000, 10000, 10000, 10000, 10000, 10000, 0]);
  });
});

describe('orçamento do ciclo (BR-FIN-004/005/030)', () => {
  it('renda extra aumenta e a meta reduz a capacidade de gasto', () => {
    const withIncome = addExtraIncome(
      base(),
      { name: 'Bônus', amount: 40000, date: '2026-10-16' },
      TODAY,
    );
    const biggerGoal = saveConfig(base(), { ...config, savingGoal: 140000 }, TODAY);

    expect(initial(withIncome)).toBe(290000);
    expect(summaryOn(withIncome, 10, 16).currentDailyLimit).toBe(14500);
    expect(initial(biggerGoal)).toBe(210000);
    expect(summaryOn(biggerGoal, 10, 16).currentDailyLimit).toBe(10500);
  });

  it('fixa pendente fica reservada; pagar à vista não desconta de novo', () => {
    const state = base();
    const paid = payFixedExpense(state, { fixedExpenseId: 'aluguel', method: 'cash' }, TODAY);

    expect(initial(state)).toBe(250000);
    expect(initial(paid)).toBe(250000);
    expect(selectUpcomingCommitments(state, TODAY.now)).toEqual([
      expect.objectContaining({ kind: 'fixed', label: 'Aluguel', amount: 150000 }),
    ]);
    expect(selectUpcomingCommitments(paid, TODAY.now)).toEqual([]);
  });

  it('fixa paga no crédito sai da reserva e pesa só pela fatura (sem dupla contagem)', () => {
    const payOnCredit = (state: LocalState, ctx: UseCaseContext) =>
      payFixedExpense(
        state,
        { fixedExpenseId: 'aluguel', method: 'credit', cardId: cardId(state) },
        ctx,
      );
    const sameCycle = payOnCredit(base(), TODAY);
    const ctx = at(10, 22);
    const nextCycle = payOnCredit(base(ctx), ctx);

    // Fatura de outubro vence no ciclo atual: o valor só muda de lugar.
    expect(initial(sameCycle)).toBe(250000);
    expect(limitOf(sameCycle).committed).toBe(150000);
    // Depois do fechamento, a fatura vence no próximo ciclo: este ciclo fica livre do aluguel.
    expect(initial(nextCycle)).toBe(400000);
    expect(selectCycleProjections(nextCycle, ctx.now, 1)[0]).toMatchObject({
      fixedExpenses: 150000,
      cardCharges: 150000,
    });
  });

  it('abrir o ciclo seguinte não conta duas vezes a parcela já projetada', () => {
    const ctx = at(10, 22);
    const state = purchase(base(), '2026-10-22', 60000, 3, ctx);
    const projectedNext = selectCycleProjections(state, ctx.now, 1)[0]!;
    const closed = closeCycle(state, at(11, 5));
    const next = openCycle(closed, at(11, 5));

    expect(selectActiveCycle(next)).toMatchObject({ startDate: '2026-11-05' });
    expect(initial(next)).toBe(projectedNext.free);
  });
});

describe('fatura e limite (BR-FIN-026)', () => {
  it('"Paguei a fatura" até o vencimento libera o limite sem juros; desfazer volta a comprometer', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const ctx = at(10, 25);
    const paid = payStatement(state, { cardId: cardId(state), statementKey: '2026-10' }, ctx);

    expect(() =>
      payStatement(state, { cardId: cardId(state), statementKey: '2026-10' }, TODAY),
    ).toThrow('ainda está aberta');
    expect(limitOf(paid).available).toBe(600000);
    expect(initial(paid)).toBe(initial(state));
    expect(selectCardStatements(paid, cardId(paid), ctx.now)[0]).toMatchObject({ status: 'paid' });
    expect(() =>
      payStatement(paid, { cardId: cardId(paid), statementKey: '2026-10' }, ctx),
    ).toThrow('já foi paga');

    const undone = undoStatementPayment(paid, paid.statementPayments[0]!.id, ctx);
    expect(limitOf(undone).available).toBe(540000);
  });

  it('depois do vencimento exige o valor pago; os juros pesam no ciclo ativo', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const ctx = at(10, 28);

    expect(selectCardStatements(state, cardId(state), ctx.now)[0]).toMatchObject({
      status: 'overdue',
    });
    expect(() =>
      payStatement(state, { cardId: cardId(state), statementKey: '2026-10' }, ctx),
    ).toThrow('Informe o valor pago');
    expect(() =>
      payStatement(
        state,
        { cardId: cardId(state), statementKey: '2026-10', paidAmount: 50000 },
        ctx,
      ),
    ).toThrow('menor que o valor');

    const paid = payStatement(
      state,
      { cardId: cardId(state), statementKey: '2026-10', paidAmount: 61500 },
      ctx,
    );
    expect(paid.statementPayments[0]).toMatchObject({ statementAmount: 60000, paidAmount: 61500 });
    expect(initial(paid)).toBe(initial(state) - 1500);
    expect(limitOf(paid).available).toBe(600000);
  });

  it('sem pagar a fatura o limite continua comprometido, mesmo depois do vencimento', () => {
    const state = purchase(base(), '2026-10-16', 60000);

    expect(selectCardLimitUsage(state, cardId(state))!.committed).toBe(60000);
    expect(selectUpcomingCommitments(state, at(10, 28).now)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'statement', amount: 60000, overdue: true }),
      ]),
    );
  });

  it('compra acima do limite disponível é registrada e o disponível fica negativo', () => {
    const state = purchase(base(), '2026-10-16', 700000, 10);

    expect(limitOf(state)).toMatchObject({ committed: 700000, available: -100000 });
  });

  it('compra em fatura já paga é recusada', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const paid = payStatement(
      state,
      { cardId: cardId(state), statementKey: '2026-10' },
      at(10, 25),
    );

    expect(() => purchase(paid, '2026-10-18', 1000, 1, at(10, 25))).toThrow('já foi paga');
  });

  it('alterar o limite muda só o disponível; alterar fechamento não reescreve compras', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const changed = saveCreditCard(
      state,
      { id: cardId(state), name: 'Nubank', closingDay: 10, dueDay: 17, creditLimit: 800000 },
      TODAY,
    );

    expect(limitOf(changed)).toMatchObject({ creditLimit: 800000, available: 740000 });
    expect(changed.cardPurchases[0]).toMatchObject({
      firstStatementKey: '2026-10',
      firstCycleKey: '2026-10',
    });
    expect(initial(changed)).toBe(initial(state));
  });
});

describe('situação inicial (BR-FIN-027)', () => {
  it('fatura atual e parcelamentos existentes geram os compromissos futuros e o limite já usado', () => {
    const debt = (
      state: LocalState,
      input: Omit<Parameters<typeof addExistingCardDebt>[1], 'cardId'>,
    ) => addExistingCardDebt(state, { ...input, cardId: cardId(state) }, TODAY);
    let state = base();
    state = debt(state, {
      description: 'Fatura atual',
      category: 'Outros',
      installmentAmount: 135000,
      totalInstallments: 1,
      remainingInstallments: 1,
      nextStatementKey: '2026-10',
    });
    state = debt(state, {
      description: 'Notebook',
      category: 'Educação',
      installmentAmount: 30000,
      totalInstallments: 10,
      remainingInstallments: 6,
      nextStatementKey: '2026-10',
    });
    state = debt(state, {
      description: 'Celular',
      category: 'Pessoal',
      installmentAmount: 15000,
      totalInstallments: 12,
      remainingInstallments: 7,
      nextStatementKey: '2026-10',
    });

    const notebook = state.cardPurchases.find((item) => item.description === 'Notebook')!;
    expect(notebook).toMatchObject({
      totalAmount: 300000,
      settledInstallments: 4,
      firstStatementKey: '2026-06',
      firstCycleKey: '2026-06',
    });
    // Fatura de outubro: 1.350 + 300 + 150, no ciclo atual.
    expect(initial(state)).toBe(250000 - 180000);
    expect(limitOf(state)).toEqual({
      creditLimit: 600000,
      committed: 135000 + 6 * 30000 + 7 * 15000,
      available: 600000 - 420000,
    });
    expect(
      selectCycleProjections(state, TODAY.now, 7).map((projection) => projection.cardCharges),
    ).toEqual([45000, 45000, 45000, 45000, 45000, 15000, 0]);
    // Parcelas quitadas antes do cadastro não aparecem nas faturas.
    expect(
      selectCardStatements(state, cardId(state), TODAY.now)[0]!.installments.map(
        (item) => item.number,
      ),
    ).toEqual([1, 5, 6]);
  });

  it('valida restantes, fatura vencida e fatura muito distante', () => {
    const state = base();
    const input = {
      cardId: cardId(state),
      description: 'X',
      category: 'Outros',
      installmentAmount: 1000,
      totalInstallments: 3,
      remainingInstallments: 4,
      nextStatementKey: '2026-10',
    };

    expect(() => addExistingCardDebt(state, input, TODAY)).toThrow('parcelas restantes');
    expect(() =>
      addExistingCardDebt(
        state,
        { ...input, remainingInstallments: 2, nextStatementKey: '2026-09' },
        TODAY,
      ),
    ).toThrow('ainda não venceu');
    expect(() =>
      addExistingCardDebt(
        state,
        { ...input, remainingInstallments: 2, nextStatementKey: '2028-01' },
        TODAY,
      ),
    ).toThrow('ainda não venceu');
  });

  it('pode ser cadastrada antes de abrir o primeiro ciclo e pesa quando ele abre', () => {
    const configured = saveCreditCard(
      saveConfig(createEmptyState(), config, TODAY),
      { name: 'Nubank', closingDay: 20, dueDay: 27, creditLimit: 600000 },
      TODAY,
    );
    const withDebt = addExistingCardDebt(
      configured,
      {
        cardId: 'card-1',
        description: 'Fatura atual',
        category: 'Outros',
        installmentAmount: 50000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
      },
      TODAY,
    );

    expect(initial(openCycle(withDebt, TODAY))).toBe(200000);
  });

  it('compra anterior ao app só muda descrição e categoria', () => {
    const state = addExistingCardDebt(
      base(),
      {
        cardId: 'card-1',
        description: 'Notebook',
        category: 'Educação',
        installmentAmount: 30000,
        totalInstallments: 10,
        remainingInstallments: 6,
        nextStatementKey: '2026-10',
      },
      TODAY,
    );
    const id = state.cardPurchases[0]!.id;
    const renamed = updateCardPurchase(
      state,
      id,
      {
        description: 'Notebook novo',
        category: 'Trabalho',
        totalAmount: 300000,
        installments: 10,
        date: state.cardPurchases[0]!.purchaseDate,
      },
      TODAY,
    );

    expect(renamed.cardPurchases[0]).toMatchObject({
      description: 'Notebook novo',
      category: 'Trabalho',
      settledInstallments: 4,
    });
    expect(() =>
      updateCardPurchase(
        state,
        id,
        {
          description: 'X',
          category: 'Outros',
          totalAmount: 1,
          installments: 10,
          date: state.cardPurchases[0]!.purchaseDate,
        },
        TODAY,
      ),
    ).toThrow('só a descrição e a categoria');
  });
});

describe('histórico e alterações de compras (BR-FIN-029)', () => {
  it('editar compra do ciclo recalcula fatura, ciclo e saldo', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const id = state.cardPurchases[0]!.id;
    const ctx = at(10, 22);
    const moved = updateCardPurchase(
      state,
      id,
      {
        description: 'Tênis',
        category: 'Pessoal',
        totalAmount: 60000,
        installments: 2,
        date: '2026-10-21',
      },
      ctx,
    );

    expect(moved.cardPurchases).toHaveLength(1);
    expect(moved.cardPurchases[0]).toMatchObject({
      id,
      firstStatementKey: '2026-11',
      firstCycleKey: '2026-11',
      installments: 2,
    });
    expect(initial(moved)).toBe(250000);
  });

  it('fechar o ciclo preserva o histórico: a compra contada não pode mais mudar', () => {
    const state = purchase(base(), '2026-10-16', 60000, 3);
    const closed = closeCycle(state, at(11, 5));
    const finalBalance = closed.cycles[0]!.finalBalance;

    expect(canModifyCardPurchase(closed, closed.cardPurchases[0]!)).toBe(false);
    expect(() => deleteCardPurchase(closed, closed.cardPurchases[0]!.id, at(11, 5))).toThrow(
      'ciclo fechado',
    );
    expect(closed.cycles[0]!.finalBalance).toBe(finalBalance);
  });

  it('compra paga em fatura não pode ser estornada pelo app', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const paid = payStatement(
      state,
      { cardId: cardId(state), statementKey: '2026-10' },
      at(10, 25),
    );

    expect(() => deleteCardPurchase(paid, paid.cardPurchases[0]!.id, at(10, 25))).toThrow(
      'fatura paga',
    );
  });

  it('cartão inativo some das compras novas, mas suas parcelas continuam valendo', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const inactive = saveCreditCard(
      state,
      {
        id: cardId(state),
        name: 'Nubank',
        closingDay: 20,
        dueDay: 27,
        creditLimit: 600000,
        active: false,
      },
      TODAY,
    );

    expect(() => purchase(inactive, '2026-10-16', 1000)).toThrow('inativo');
    expect(initial(inactive)).toBe(190000);
  });
});

describe('origem da compra (BR-FIN-029)', () => {
  it('fatura em aberto da situação inicial não vira compra do app mesmo com fechamento no ciclo', () => {
    const state = addExistingCardDebt(
      base(),
      {
        cardId: 'card-1',
        description: 'Fatura atual',
        category: 'Outros',
        installmentAmount: 135000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
      },
      TODAY,
    );
    const imported = state.cardPurchases[0]!;

    expect(imported).toMatchObject({
      origin: 'existing',
      settledInstallments: 0,
      purchaseDate: '2026-10-20',
    });
    expect(() =>
      updateCardPurchase(
        state,
        imported.id,
        {
          description: 'Fatura',
          category: 'Outros',
          totalAmount: 1000,
          installments: 1,
          date: imported.purchaseDate,
        },
        TODAY,
      ),
    ).toThrow('só a descrição e a categoria');
    expect(purchase(state, '2026-10-16', 1000).cardPurchases[1]!.origin).toBeUndefined();
  });
});

describe('regressões da revisão financeira', () => {
  it('A1: excluir a compra de uma fixa paga no crédito desfaz o pagamento e a fixa volta a ficar reservada', () => {
    const state = base();
    const paid = payFixedExpense(
      state,
      { fixedExpenseId: 'aluguel', method: 'credit', cardId: cardId(state) },
      TODAY,
    );
    const purchaseId = paid.cardPurchases[0]!.id;
    const deleted = deleteCardPurchase(paid, purchaseId, TODAY);

    expect(initial(deleted)).toBe(250000);
    expect(deleted.fixedPayments[0]!.deletedAt).not.toBeNull();
    expect(selectUpcomingCommitments(deleted, TODAY.now)).toEqual([
      expect.objectContaining({ kind: 'fixed', label: 'Aluguel' }),
    ]);
    expect(() =>
      updateCardPurchase(
        paid,
        purchaseId,
        {
          description: 'Aluguel',
          category: 'Moradia',
          totalAmount: 1000,
          installments: 1,
          date: '2026-10-16',
        },
        TODAY,
      ),
    ).toThrow('Desfaça o pagamento');
    expect(
      updateCardPurchase(
        paid,
        purchaseId,
        {
          description: 'Aluguel de outubro',
          category: 'Moradia',
          totalAmount: 150000,
          installments: 1,
          date: '2026-10-16',
        },
        TODAY,
      ).cardPurchases[0]!.description,
    ).toBe('Aluguel de outubro');
  });

  it('A2: o pagamento de fatura tem id único por cartão e fatura, e pagar de novo após desfazer reaproveita o registro', () => {
    const state = purchase(base(), '2026-10-16', 60000);
    const ctx = at(10, 25);
    const paid = payStatement(state, { cardId: cardId(state), statementKey: '2026-10' }, ctx);
    const id = `statement-${cardId(state)}-2026-10`;
    const repaid = payStatement(
      undoStatementPayment(paid, id, ctx),
      { cardId: cardId(state), statementKey: '2026-10' },
      ctx,
    );

    expect(paid.statementPayments.map((payment) => payment.id)).toEqual([id]);
    expect(repaid.statementPayments).toEqual([expect.objectContaining({ id, deletedAt: null })]);
  });

  it('M3: aumentar o fechamento depois de pagar a fatura não bloqueia compras novas', () => {
    const ctx = at(10, 12);
    const configured = saveCreditCard(
      saveConfig(createEmptyState(), config, ctx),
      { name: 'Itaú', closingDay: 5, dueDay: 15, creditLimit: 100000 },
      ctx,
    );
    let state = openCycle(configured, ctx);
    state = purchase(state, '2026-10-05', 10000, 1, ctx);
    state = payStatement(state, { cardId: cardId(state), statementKey: '2026-10' }, ctx);
    state = saveCreditCard(
      state,
      { id: cardId(state), name: 'Itaú', closingDay: 25, dueDay: 15 },
      at(10, 13),
    );
    const after = purchase(state, '2026-10-14', 5000, 1, at(10, 14));

    expect(after.cardPurchases[1]).toMatchObject({ firstStatementKey: '2026-11' });
  });

  it('M5: editar só a descrição não recalcula a compra e funciona com o cartão inativo', () => {
    const state = purchase(base(), '2026-10-16', 60000, 3);
    const id = state.cardPurchases[0]!.id;
    const inactive = saveCreditCard(
      state,
      {
        id: cardId(state),
        name: 'Nubank',
        closingDay: 20,
        dueDay: 27,
        creditLimit: 600000,
        active: false,
      },
      TODAY,
    );
    const renamed = updateCardPurchase(
      inactive,
      id,
      {
        description: 'Tênis',
        category: 'Pessoal',
        totalAmount: 60000,
        installments: 3,
        date: '2026-10-16',
      },
      TODAY,
    );

    expect(renamed.cardPurchases[0]).toMatchObject({
      description: 'Tênis',
      firstStatementKey: '2026-10',
    });
  });
});

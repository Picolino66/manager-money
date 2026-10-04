import { saveCreditCard } from './card.use-cases';
import { closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import {
  addExtraIncome,
  deleteExtraIncome,
  payFixedExpense,
  undoFixedPayment,
} from './payment.use-cases';
import {
  selectActiveCycle,
  selectActiveMonth,
  selectCardStatements,
  selectCycleAdjustments,
  selectCyclePayments,
  selectPendingFixedExpenses,
  selectUpcomingCommitments,
} from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (year: number, month: number, day: number): UseCaseContext => ({
  now: new Date(year, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

const config: FinancialConfigInput = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
  savingGoal: 50000,
  customCategories: [],
  fixedExpenses: [
    { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 150000 },
    {
      id: 'quitado',
      type: 'installment',
      name: 'Parcela quitada',
      category: 'Outros',
      installmentAmount: 10000,
      totalInstallments: 1,
      remainingInstallments: 0,
    },
  ],
};

/**
 * Ciclo ativo 07/10–06/11 (chave 2026-10): renda 500.000 − meta 50.000 − aluguel pendente reservado
 * 150.000 = 300.000 (BR-FIN-004). A parcela quitada vale 0 e não reserva nada.
 */
function opened(): LocalState {
  const ctx = at(2026, 10, 10);

  return openCycle(saveConfig(createEmptyState(), config, ctx), ctx);
}

function withCard(closingDay = 25): LocalState {
  return saveCreditCard(opened(), { name: 'Nubank', closingDay, dueDay: 5 }, at(2026, 10, 10));
}

const cardOf = (state: LocalState) => state.creditCards[0]!.id;
const initialOf = (state: LocalState) => selectActiveCycle(state)?.initialAvailableAmount;

beforeEach(() => {
  sequence = 0;
});

describe('payFixedExpense à vista (BR-FIN-021)', () => {
  it('fixa pendente fica reservada; pagar à vista não muda o saldo (BR-FIN-004)', () => {
    const state = opened();
    expect(initialOf(state)).toBe(300000);
    expect(selectCycleAdjustments(state, selectActiveCycle(state)!)).toMatchObject({
      pendingFixedExpenses: 150000,
      paidFixedExpenses: 0,
    });

    for (const method of ['pix', 'cash', 'debit'] as const) {
      const paid = payFixedExpense(state, { fixedExpenseId: 'aluguel', method }, at(2026, 10, 11));
      // A reserva vira pagamento à vista: o saldo do ciclo fica igual.
      expect(initialOf(paid)).toBe(300000);
      expect(selectCycleAdjustments(paid, selectActiveCycle(paid)!)).toMatchObject({
        pendingFixedExpenses: 0,
        paidFixedExpenses: 150000,
      });
      expect(paid.fixedPayments[0]).toMatchObject({
        fixedExpenseId: 'aluguel',
        name: 'Aluguel',
        category: 'Moradia',
        method,
        amount: 150000,
        interest: 0,
        paidAt: '2026-10-11',
        dirty: true,
        deletedAt: null,
      });
      expect(paid.fixedPayments[0]?.cardPurchaseId).toBeUndefined();
      expect(selectActiveCycle(paid)?.dirty).toBe(true);
    }
  });

  it('um pagamento por fixa por ciclo; valida despesa, forma de pagamento e ciclo', () => {
    const state = payFixedExpense(
      opened(),
      { fixedExpenseId: 'aluguel', method: 'pix' },
      at(2026, 10, 11),
    );
    const ctx = at(2026, 10, 12);
    expect(() =>
      payFixedExpense(state, { fixedExpenseId: 'aluguel', method: 'cash' }, ctx),
    ).toThrow('já foi paga');
    expect(() => payFixedExpense(state, { fixedExpenseId: 'x', method: 'pix' }, ctx)).toThrow(
      'não encontrada',
    );
    expect(() => payFixedExpense(state, { fixedExpenseId: 'quitado', method: 'pix' }, ctx)).toThrow(
      'não tem valor a pagar',
    );
    expect(() =>
      payFixedExpense(state, { fixedExpenseId: 'aluguel', method: 'ted' as never }, ctx),
    ).toThrow('forma de pagamento');
    expect(() =>
      payFixedExpense(createEmptyState(), { fixedExpenseId: 'aluguel', method: 'pix' }, ctx),
    ).toThrow('Nenhum ciclo ativo');
    expect(() =>
      payFixedExpense(
        { ...state, settings: null },
        { fixedExpenseId: 'aluguel', method: 'pix' },
        ctx,
      ),
    ).toThrow('Configure');
  });

  it('a data do pagamento fica dentro do ciclo mesmo depois do fim do período', () => {
    const late = payFixedExpense(
      opened(),
      { fixedExpenseId: 'aluguel', method: 'pix' },
      at(2026, 11, 10),
    );
    expect(late.fixedPayments[0]?.paidAt).toBe('2026-11-06');
  });

  it('desfazer volta a fixa para pendente (reservada); só vale no ciclo ativo', () => {
    const paid = payFixedExpense(
      opened(),
      { fixedExpenseId: 'aluguel', method: 'pix' },
      at(2026, 10, 11),
    );
    const undone = undoFixedPayment(paid, paid.fixedPayments[0]!.id, at(2026, 10, 12));
    expect(initialOf(undone)).toBe(300000);
    expect(selectCycleAdjustments(undone, selectActiveCycle(undone)!).pendingFixedExpenses).toBe(
      150000,
    );
    expect(undone.fixedPayments[0]?.deletedAt).not.toBeNull();
    expect(selectCyclePayments(undone, selectActiveCycle(undone)!.id)).toHaveLength(0);
    // Depois de desfeito, pode pagar de novo.
    const again = payFixedExpense(
      undone,
      { fixedExpenseId: 'aluguel', method: 'debit' },
      at(2026, 10, 13),
    );
    expect(initialOf(again)).toBe(300000);

    expect(() => undoFixedPayment(paid, 'nada', at(2026, 10, 12))).toThrow('ciclo ativo');
    const closed = closeCycle(paid, at(2026, 11, 7));
    expect(() => undoFixedPayment(closed, paid.fixedPayments[0]!.id, at(2026, 11, 8))).toThrow(
      'Nenhum ciclo ativo',
    );
    const reopened = openCycle(closed, at(2026, 11, 7));
    expect(() => undoFixedPayment(reopened, paid.fixedPayments[0]!.id, at(2026, 11, 8))).toThrow(
      'ciclo ativo',
    );
  });

  it('no ciclo seguinte a fixa volta a ficar pendente e o pago anterior fica no histórico', () => {
    const paid = payFixedExpense(
      opened(),
      { fixedExpenseId: 'aluguel', method: 'pix' },
      at(2026, 10, 11),
    );
    const next = openCycle(closeCycle(paid, at(2026, 11, 7)), at(2026, 11, 7));
    const nextCycle = selectActiveCycle(next)!;

    expect(selectCyclePayments(next, nextCycle.id)).toHaveLength(0);
    // Pendente de novo: volta a ficar reservada no novo ciclo.
    expect(initialOf(next)).toBe(300000);
    expect(selectCycleAdjustments(next, nextCycle)).toMatchObject({
      paidFixedExpenses: 0,
      pendingFixedExpenses: 150000,
    });
    // O ciclo fechado manteve o desconto do aluguel pago.
    expect(next.cycles.find((cycle) => cycle.status === 'closed')?.finalBalance).toBe(300000);
    expect(
      initialOf(
        payFixedExpense(next, { fixedExpenseId: 'aluguel', method: 'pix' }, at(2026, 11, 8)),
      ),
    ).toBe(300000);
  });

  it('salvar a configuração preserva o desconto dos pagamentos', () => {
    const paid = payFixedExpense(
      opened(),
      { fixedExpenseId: 'aluguel', method: 'pix' },
      at(2026, 10, 11),
    );
    const resaved = saveConfig(
      paid,
      { ...config, incomeSources: [{ id: 'renda', name: 'Salário', amount: 600000, payday: 7 }] },
      at(2026, 10, 12),
    );
    expect(initialOf(resaved)).toBe(600000 - 50000 - 150000);
  });
});

describe('payFixedExpense no crédito (BR-FIN-022)', () => {
  it('soma os juros ao valor, vira compra no cartão e só a fatura desconta', () => {
    const card = withCard();
    const state = payFixedExpense(
      card,
      {
        fixedExpenseId: 'aluguel',
        method: 'credit',
        cardId: cardOf(card),
        installments: 3,
        interest: 5000,
      },
      at(2026, 10, 11),
    );
    const purchase = state.cardPurchases[0]!;
    const payment = state.fixedPayments[0]!;

    expect(purchase).toMatchObject({
      description: 'Aluguel',
      category: 'Moradia',
      totalAmount: 155000,
      installments: 3,
      firstCycleKey: '2026-10',
    });
    expect(payment).toMatchObject({
      method: 'credit',
      amount: 150000,
      interest: 5000,
      cardPurchaseId: purchase.id,
    });
    // 1ª parcela (51.667) cai neste ciclo; o crédito não desconta o valor cheio à vista.
    // A reserva do aluguel sai do ciclo (pesa só pela fatura): sem dupla contagem.
    expect(initialOf(state)).toBe(450000 - 51667);
    expect(selectCycleAdjustments(state, selectActiveCycle(state)!)).toMatchObject({
      pendingFixedExpenses: 0,
      paidFixedExpenses: 0,
      cardCharges: 51667,
    });
  });

  it('fechamento já passado joga a 1ª parcela para o ciclo seguinte', () => {
    const card = withCard(8);
    const state = payFixedExpense(
      card,
      {
        fixedExpenseId: 'aluguel',
        method: 'credit',
        cardId: cardOf(card),
        installments: 2,
        interest: 0,
      },
      at(2026, 10, 11),
    );
    // Compra em 11/10 → fatura que fecha em 08/11 e vence em 05/12 → ciclo 2026-11 (BR-FIN-025).
    expect(state.cardPurchases[0]?.firstCycleKey).toBe('2026-11');
    // Reserva liberada e nenhuma parcela neste ciclo.
    expect(initialOf(state)).toBe(450000);

    // Próximo ciclo: aluguel volta a ficar reservado (150.000) + 1ª parcela (75.000).
    const next = openCycle(closeCycle(state, at(2026, 11, 7)), at(2026, 11, 7));
    expect(initialOf(next)).toBe(450000 - 150000 - 75000);
  });

  it('desfazer remove o pagamento e a compra no cartão', () => {
    const card = withCard();
    const state = payFixedExpense(
      card,
      {
        fixedExpenseId: 'aluguel',
        method: 'credit',
        cardId: cardOf(card),
        installments: 3,
        interest: 5000,
      },
      at(2026, 10, 11),
    );
    const undone = undoFixedPayment(state, state.fixedPayments[0]!.id, at(2026, 10, 12));
    expect(undone.cardPurchases[0]?.deletedAt).not.toBeNull();
    expect(undone.fixedPayments[0]?.deletedAt).not.toBeNull();
    // Sem a compra, a fixa volta a ficar pendente e reservada.
    expect(initialOf(undone)).toBe(300000);
  });

  it('valida cartão, juros e parcelas', () => {
    const state = withCard();
    const ctx = at(2026, 10, 11);
    const base = { fixedExpenseId: 'aluguel', method: 'credit' as const, cardId: cardOf(state) };
    expect(() => payFixedExpense(state, { ...base, cardId: undefined }, ctx)).toThrow(
      'Escolha o cartão',
    );
    expect(() => payFixedExpense(state, { ...base, cardId: 'x' }, ctx)).toThrow(
      'Cartão não encontrado',
    );
    expect(() => payFixedExpense(state, { ...base, interest: -1 }, ctx)).toThrow('juros');
    expect(() => payFixedExpense(state, { ...base, interest: 1.5 }, ctx)).toThrow('juros');
    expect(() => payFixedExpense(state, { ...base, installments: 0 }, ctx)).toThrow('parcelas');
    // Sem informar parcelas nem juros: 1x sem juros.
    const simple = payFixedExpense(state, base, ctx);
    expect(simple.cardPurchases[0]).toMatchObject({ totalAmount: 150000, installments: 1 });
    expect(simple.fixedPayments[0]?.interest).toBe(0);
  });
});

describe('reserva de fixas e ativo/inativo (BR-FIN-004, BR-FIN-030)', () => {
  const withInactive: FinancialConfigInput = {
    ...config,
    fixedExpenses: [
      ...config.fixedExpenses,
      {
        id: 'academia',
        type: 'permanent',
        name: 'Academia',
        category: 'Saúde',
        amount: 12000,
        active: false,
      },
    ],
  };

  it('fixa inativa não reserva, não fica pendente e não pode ser paga', () => {
    const ctx = at(2026, 10, 10);
    const state = openCycle(saveConfig(createEmptyState(), withInactive, ctx), ctx);
    const cycle = selectActiveCycle(state)!;

    // Mesmo saldo do cenário sem a academia: 500.000 − 50.000 − 150.000.
    expect(initialOf(state)).toBe(300000);
    expect(selectCycleAdjustments(state, cycle).pendingFixedExpenses).toBe(150000);
    expect(selectPendingFixedExpenses(state, cycle.id).map((expense) => expense.id)).not.toContain(
      'academia',
    );
    expect(selectUpcomingCommitments(state, ctx.now).map((item) => item.id)).toEqual(['aluguel']);
    expect(() =>
      payFixedExpense(state, { fixedExpenseId: 'academia', method: 'cash' }, at(2026, 10, 11)),
    ).toThrow('inativa');

    // Reativada: passa a ficar reservada no ciclo ativo.
    const reactivated = saveConfig(
      state,
      {
        ...withInactive,
        fixedExpenses: withInactive.fixedExpenses.map((expense) =>
          expense.id === 'academia' ? { ...expense, active: true } : expense,
        ),
      },
      at(2026, 10, 12),
    );
    expect(initialOf(reactivated)).toBe(300000 - 12000);
  });

  it('desativar uma fixa pendente devolve a reserva ao ciclo ativo', () => {
    const state = opened();
    const deactivated = saveConfig(
      state,
      {
        ...config,
        fixedExpenses: config.fixedExpenses.map((expense) =>
          expense.id === 'aluguel' ? { ...expense, active: false } : expense,
        ),
      },
      at(2026, 10, 12),
    );
    expect(initialOf(deactivated)).toBe(450000);
    expect(selectActiveCycle(deactivated)?.dirty).toBe(true);
  });

  it('fixa paga no crédito libera a reserva do ciclo e passa a pesar só pela fatura (sem dupla contagem)', () => {
    const card = withCard();
    const cardId = cardOf(card);
    expect(initialOf(card)).toBe(300000);

    const paid = payFixedExpense(
      card,
      { fixedExpenseId: 'aluguel', method: 'credit', cardId, installments: 1 },
      at(2026, 10, 11),
    );
    const cycle = selectActiveCycle(paid)!;

    // Compra em 11/10 → fatura 2026-10 (fecha 25/10, vence 05/11) → ciclo 07/10–06/11 (BR-FIN-025).
    // O aluguel sai da reserva (−150.000) e entra pela fatura (+150.000): o saldo fica igual.
    expect(initialOf(paid)).toBe(300000);
    expect(selectCycleAdjustments(paid, cycle)).toMatchObject({
      pendingFixedExpenses: 0,
      paidFixedExpenses: 0,
      cardCharges: 150000,
    });
    expect(selectPendingFixedExpenses(paid, cycle.id).map((expense) => expense.id)).not.toContain(
      'aluguel',
    );
    expect(selectCardStatements(paid, cardId, at(2026, 10, 11).now)).toEqual([
      expect.objectContaining({ key: '2026-10', dueDate: '2026-11-05', amount: 150000 }),
    ]);
    // Nos compromissos aparece uma vez só: como fatura, não como fixa pendente.
    expect(selectUpcomingCommitments(paid, at(2026, 10, 11).now)).toEqual([
      expect.objectContaining({ kind: 'statement', amount: 150000, dueDate: '2026-11-05' }),
    ]);
  });
});

describe('rendas avulsas (BR-FIN-023)', () => {
  const input = { name: ' Freela ', amount: 50000, date: '2026-10-15' };

  it('somam ao saldo do ciclo e podem ser excluídas', () => {
    const state = addExtraIncome(opened(), input, at(2026, 10, 15));
    expect(state.extraIncomes[0]).toMatchObject({
      name: 'Freela',
      amount: 50000,
      dirty: true,
      deletedAt: null,
    });
    expect(initialOf(state)).toBe(350000);
    expect(selectActiveMonth(state)?.initialAvailableAmount).toBe(350000);

    const removed = deleteExtraIncome(state, state.extraIncomes[0]!.id, at(2026, 10, 16));
    expect(initialOf(removed)).toBe(300000);
    expect(removed.extraIncomes[0]?.deletedAt).not.toBeNull();
  });

  it('valida nome, valor, data e ciclo', () => {
    const ctx = at(2026, 10, 15);
    const state = opened();
    expect(() => addExtraIncome(state, { ...input, name: ' ' }, ctx)).toThrow('nome da renda');
    expect(() => addExtraIncome(state, { ...input, amount: 0 }, ctx)).toThrow('maior que zero');
    expect(() => addExtraIncome(state, { ...input, date: '2026-12-01' }, ctx)).toThrow(
      'data do recebimento',
    );
    expect(() => addExtraIncome(createEmptyState(), input, ctx)).toThrow('Nenhum ciclo ativo');
    expect(() => deleteExtraIncome(state, 'nada', ctx)).toThrow('não encontrada');
  });

  it('renda avulsa de um ciclo fechado não afeta o ciclo seguinte nem pode ser excluída', () => {
    const state = addExtraIncome(opened(), input, at(2026, 10, 15));
    const closed = closeCycle(state, at(2026, 11, 7));
    expect(closed.cycles[0]?.finalBalance).toBe(350000);
    const next = openCycle(closed, at(2026, 11, 7));
    expect(initialOf(next)).toBe(300000);
    expect(() => deleteExtraIncome(next, state.extraIncomes[0]!.id, at(2026, 11, 8))).toThrow(
      'não encontrada',
    );
  });
});

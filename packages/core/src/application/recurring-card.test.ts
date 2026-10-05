import { saveCreditCard, setCreditCardActive } from './card.use-cases';
import { closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import {
  launchRecurringFixedExpenses,
  payFixedExpense,
  undoFixedPayment,
} from './payment.use-cases';
import {
  selectActiveCycle,
  selectCardLimitUsage,
  selectCardStatements,
  selectCreditCards,
  selectCycleProjections,
  selectCyclePayments,
  selectRecurringIssues,
  selectPendingFixedExpenses,
} from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (day: number, month = 10): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

const config = (recurringCardId?: string): FinancialConfigInput => ({
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
  savingGoal: 0,
  customCategories: [],
  fixedExpenses: [
    {
      id: 'netflix',
      type: 'permanent',
      name: 'Netflix',
      category: 'Lazer',
      amount: 5000,
      ...(recurringCardId ? { recurringCardId } : {}),
    },
    { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 100000 },
  ],
});

/** Config + cartão (fecha dia 5, vence dia 15) prontos para abrir o ciclo. */
function ready(recurring = true): LocalState {
  let state = saveConfig(createEmptyState(), config(), at(1));
  state = saveCreditCard(
    state,
    { name: 'Nubank', closingDay: 5, dueDay: 15, creditLimit: 200000 },
    at(2),
  );
  return recurring ? saveConfig(state, config(state.creditCards[0]!.id), at(3)) : state;
}

describe('fixa recorrente no cartão (BR-FIN-035)', () => {
  it('ao abrir o ciclo lança a compra e o pagamento no crédito, sem juros e fora da reserva', () => {
    const state = openCycle(ready(), at(7));
    const cycle = selectActiveCycle(state)!;
    const payments = selectCyclePayments(state, cycle.id);

    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      id: 'auto-pay-2026-10-netflix',
      method: 'credit',
      amount: 5000,
      interest: 0,
      paidAt: cycle.startDate,
      cardPurchaseId: 'auto-buy-2026-10-netflix',
    });
    expect(state.cardPurchases[0]).toMatchObject({
      id: 'auto-buy-2026-10-netflix',
      totalAmount: 5000,
      installments: 1,
      purchaseDate: cycle.startDate,
      dirty: true,
    });
    expect(selectPendingFixedExpenses(state, cycle.id).map((fixed) => fixed.id)).toEqual([
      'aluguel',
    ]);
  });

  it('dá o mesmo saldo, fatura e limite que pagar a fixa no crédito (1x, sem juros) manualmente', () => {
    const auto = openCycle(ready(), at(7));
    let manual = openCycle(ready(false), at(7));
    const cardId = manual.creditCards[0]!.id;
    manual = payFixedExpense(
      manual,
      { fixedExpenseId: 'netflix', method: 'credit', cardId },
      at(7),
    );

    expect(selectActiveCycle(auto)!.initialAvailableAmount).toBe(
      selectActiveCycle(manual)!.initialAvailableAmount,
    );
    expect(selectCardLimitUsage(auto, auto.creditCards[0]!.id)).toEqual(
      selectCardLimitUsage(manual, manual.creditCards[0]!.id),
    );
    const amounts = (state: LocalState) =>
      selectCardStatements(state, state.creditCards[0]!.id, new Date(2026, 9, 8)).map((s) => [
        s.key,
        s.amount,
      ]);
    expect(amounts(auto)).toEqual(amounts(manual));
  });

  it('cartão inativo: não lança e a fixa continua pendente e reservada', () => {
    let state = ready();
    state = setCreditCardActive(state, state.creditCards[0]!.id, false, at(4));
    const opened = openCycle(state, at(7));
    const reserved = openCycle(ready(false), at(7));

    expect(selectCyclePayments(opened, selectActiveCycle(opened)!.id)).toHaveLength(0);
    expect(opened.cardPurchases).toHaveLength(0);
    expect(selectPendingFixedExpenses(opened, selectActiveCycle(opened)!.id)).toHaveLength(2);
    expect(selectActiveCycle(opened)!.initialAvailableAmount).toBe(
      selectActiveCycle(reserved)!.initialAvailableAmount,
    );
  });

  it('fixa inativa ou sem valor não é lançada', () => {
    let state = ready();
    state = saveConfig(
      state,
      {
        ...config(state.creditCards[0]!.id),
        fixedExpenses: config(state.creditCards[0]!.id).fixedExpenses.map((fixed) =>
          fixed.id === 'netflix' ? { ...fixed, active: false } : fixed,
        ),
      },
      at(4),
    );
    const opened = openCycle(state, at(7));

    expect(opened.fixedPayments).toHaveLength(0);
  });

  it('é idempotente e respeita o desfazer: não relança no mesmo ciclo', () => {
    const opened = openCycle(ready(), at(7));

    expect(launchRecurringFixedExpenses(opened, at(7)).fixedPayments).toHaveLength(1);

    const undone = undoFixedPayment(opened, 'auto-pay-2026-10-netflix', at(8));

    expect(selectCyclePayments(undone, selectActiveCycle(undone)!.id)).toHaveLength(0);
    expect(
      launchRecurringFixedExpenses(undone, at(8)).fixedPayments.filter((p) => !p.deletedAt),
    ).toHaveLength(0);
    expect(
      selectPendingFixedExpenses(undone, selectActiveCycle(undone)!.id).map((fixed) => fixed.id),
    ).toEqual(['netflix', 'aluguel']);
  });

  it('o ciclo seguinte lança de novo, com ids do novo ciclo', () => {
    let state = openCycle(ready(), at(7));
    state = closeCycle(state, at(7, 11));
    state = openCycle(state, at(7, 11));

    expect(state.fixedPayments.map((payment) => payment.id)).toEqual([
      'auto-pay-2026-10-netflix',
      'auto-pay-2026-11-netflix',
    ]);
    expect(state.cardPurchases.map((purchase) => purchase.id)).toEqual([
      'auto-buy-2026-10-netflix',
      'auto-buy-2026-11-netflix',
    ]);
  });

  it('saveConfig exige cartão existente e ativo ao marcar; marca antiga com cartão inativo passa', () => {
    const state = ready(false);
    const cardId = state.creditCards[0]!.id;

    expect(() => saveConfig(state, config('inexistente'), at(4))).toThrow(
      /precisa existir e estar ativo/,
    );

    const inactive = setCreditCardActive(
      saveConfig(state, config(cardId), at(4)),
      cardId,
      false,
      at(5),
    );
    // Salvar de novo com a mesma marca (o cartão ficou inativo depois) não é bloqueado.
    expect(() => saveConfig(inactive, config(cardId), at(6))).not.toThrow();
    expect(selectCreditCards(inactive)[0]!.active).toBe(false);
    // Marcar um cartão inativo agora é recusado.
    expect(() => saveConfig(state, config(cardId), at(4))).not.toThrow();
    expect(() =>
      saveConfig(setCreditCardActive(state, cardId, false, at(4)), config(cardId), at(5)),
    ).toThrow();
  });

  it('desmarcar remove a recorrência e marca a fixa como alterada', () => {
    const marked = ready();
    const cleared = saveConfig(marked, config(), at(4));
    const fixed = cleared.fixedExpenses.find((record) => record.id === 'netflix')!;

    expect(fixed).not.toHaveProperty('recurringCardId');
    expect(fixed.dirty).toBe(true);
  });
});

describe('fixa recorrente: aviso e projeção', () => {
  it('explica por que a fixa ficou pendente', () => {
    let state = ready();
    state = setCreditCardActive(state, state.creditCards[0]!.id, false, at(4));
    const opened = openCycle(state, at(7));
    const cycleId = selectActiveCycle(opened)!.id;

    expect(selectRecurringIssues(opened, cycleId)).toEqual({
      netflix: 'O cartão Nubank está inativo: a despesa não foi lançada.',
    });

    const launched = openCycle(ready(), at(7));
    expect(selectRecurringIssues(launched, selectActiveCycle(launched)!.id)).toEqual({});
    const undone = undoFixedPayment(launched, 'auto-pay-2026-10-netflix', at(8));
    expect(selectRecurringIssues(undone, selectActiveCycle(undone)!.id).netflix).toMatch(
      /desfeito/,
    );
  });

  it('a projeção conta a fixa recorrente como fatura, sem duplicar como fixa', () => {
    const recurring = selectCycleProjections(openCycle(ready(), at(7)), at(8).now, 3);
    const manual = selectCycleProjections(openCycle(ready(false), at(7)), at(8).now, 3);

    expect(recurring.map((item) => item.cyclesAhead)).toEqual([1, 2, 3]);
    // Netflix (R$ 50) sai de "fixas" e entra em "cartão" (no ciclo da fatura).
    expect(manual[1]!.fixedExpenses - recurring[1]!.fixedExpenses).toBe(5000);
    expect(recurring[1]!.cardCharges - manual[1]!.cardCharges).toBe(5000);
  });

  it('cartão inativo: a projeção volta a contar a fixa como fixa', () => {
    let state = ready();
    state = setCreditCardActive(state, state.creditCards[0]!.id, false, at(4));
    const opened = openCycle(state, at(7));
    const reference = selectCycleProjections(openCycle(ready(false), at(7)), at(8).now, 2);
    const projected = selectCycleProjections(opened, at(8).now, 2);

    expect(projected.map((item) => item.fixedExpenses)).toEqual(
      reference.map((item) => item.fixedExpenses),
    );
  });
});

import { statementKeysStartingBetween, statementStartDate } from '../domain/financial/credit-card';
import { FinancialConfigInput } from '../domain/financial/financial.types';
import { saveCreditCard, setCreditCardActive } from './card.use-cases';
import { closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import { launchRecurringCharges, payFixedExpense, undoFixedPayment } from './payment.use-cases';
import {
  selectActiveCycle,
  selectCardLimitUsage,
  selectCardStatements,
  selectCreditCards,
  selectCycleProjections,
  selectCyclePayments,
  selectPendingFixedExpenses,
  selectRecurringIssues,
} from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';

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

/**
 * Cartão com vencimento dia 15. `closingDay` 6 faz a fatura virar no dia 7 (início do ciclo, payday 7);
 * `closingDay` 5 faz virar no dia 6 (último dia do ciclo).
 */
function ready(closingDay: number, recurring = true): LocalState {
  let state = saveConfig(createEmptyState(), config(), at(1));
  state = saveCreditCard(
    state,
    { name: 'Nubank', closingDay, dueDay: 15, creditLimit: 200000 },
    at(2),
  );
  return recurring ? saveConfig(state, config(state.creditCards[0]!.id), at(3)) : state;
}

describe('virada de fatura (datas)', () => {
  it('a fatura começa no dia seguinte ao fechamento da anterior', () => {
    expect(statementStartDate('2026-11', 6).toISOString().slice(0, 10)).toBe('2026-10-07');
    expect(statementKeysStartingBetween(6, '2026-10-07', '2026-11-06')).toEqual(['2026-11']);
    expect(statementKeysStartingBetween(5, '2026-10-07', '2026-11-06')).toEqual(['2026-12']);
    // Entre duas viradas não há nenhuma.
    expect(statementKeysStartingBetween(5, '2026-10-07', '2026-11-05')).toEqual([]);
  });
});

describe('fixa recorrente no cartão: cobra a cada virada de fatura (BR-FIN-035)', () => {
  it('virada no início do ciclo: lança ao abrir, no crédito, sem juros e fora da reserva', () => {
    const state = openCycle(ready(6), at(7));
    const cycle = selectActiveCycle(state)!;
    const payments = selectCyclePayments(state, cycle.id);

    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      id: 'auto-pay-2026-11-netflix',
      method: 'credit',
      amount: 5000,
      interest: 0,
      paidAt: '2026-10-07',
      cardPurchaseId: 'auto-buy-2026-11-netflix',
    });
    expect(state.cardPurchases[0]).toMatchObject({
      id: 'auto-buy-2026-11-netflix',
      totalAmount: 5000,
      installments: 1,
      purchaseDate: '2026-10-07',
      firstStatementKey: '2026-11',
      dirty: true,
    });
    expect(selectPendingFixedExpenses(state, cycle.id).map((fixed) => fixed.id)).toEqual([
      'aluguel',
    ]);
  });

  it('dá o mesmo saldo, fatura e limite que pagar a fixa no crédito (1x, sem juros) manualmente', () => {
    const auto = openCycle(ready(6), at(7));
    let manual = openCycle(ready(6, false), at(7));
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

  it('virada no meio do ciclo: fica pendente (reservada) até a virada e então é lançada', () => {
    const opened = openCycle(ready(5), at(7));
    const cycleId = selectActiveCycle(opened)!.id;

    expect(opened.cardPurchases).toHaveLength(0);
    expect(selectPendingFixedExpenses(opened, cycleId)).toHaveLength(2);
    expect(selectRecurringIssues(opened, cycleId, at(8).now)).toEqual({
      netflix: 'Será lançada na virada da fatura Nubank, em 06/11.',
    });
    // Antes da virada nada é lançado e o estado é o mesmo (nenhuma escrita).
    expect(launchRecurringCharges(opened, at(5, 11))).toBe(opened);

    const launched = launchRecurringCharges(opened, at(6, 11));

    expect(launched.cardPurchases[0]).toMatchObject({
      id: 'auto-buy-2026-12-netflix',
      purchaseDate: '2026-11-06',
      firstStatementKey: '2026-12',
    });
    expect(launched.fixedPayments[0]).toMatchObject({
      id: 'auto-pay-2026-12-netflix',
      method: 'credit',
    });
    expect(selectPendingFixedExpenses(launched, cycleId).map((fixed) => fixed.id)).toEqual([
      'aluguel',
    ]);
    // Idempotente: rodar de novo não escreve nada.
    expect(launchRecurringCharges(launched, at(6, 11))).toBe(launched);
    expect(launchRecurringCharges(launched, at(6, 11)).cardPurchases).toHaveLength(1);
  });

  it('cartão inativo: não lança e a fixa continua pendente e reservada', () => {
    let state = ready(6);
    state = setCreditCardActive(state, state.creditCards[0]!.id, false, at(4));
    const opened = openCycle(state, at(7));
    const reserved = openCycle(ready(6, false), at(7));
    const cycleId = selectActiveCycle(opened)!.id;

    expect(opened.cardPurchases).toHaveLength(0);
    expect(selectPendingFixedExpenses(opened, cycleId)).toHaveLength(2);
    expect(selectActiveCycle(opened)!.initialAvailableAmount).toBe(
      selectActiveCycle(reserved)!.initialAvailableAmount,
    );
    expect(selectRecurringIssues(opened, cycleId, at(8).now)).toEqual({
      netflix: 'O cartão Nubank está inativo: a despesa não foi lançada.',
    });
  });

  it('fixa inativa não é lançada', () => {
    let state = ready(6);
    const cardId = state.creditCards[0]!.id;
    state = saveConfig(
      state,
      {
        ...config(cardId),
        fixedExpenses: config(cardId).fixedExpenses.map((fixed) =>
          fixed.id === 'netflix' ? { ...fixed, active: false } : fixed,
        ),
      },
      at(4),
    );

    expect(openCycle(state, at(7)).fixedPayments).toHaveLength(0);
  });

  it('respeita o desfazer: não relança no mesmo ciclo e explica', () => {
    const opened = openCycle(ready(6), at(7));
    const undone = undoFixedPayment(opened, 'auto-pay-2026-11-netflix', at(8));
    const cycleId = selectActiveCycle(undone)!.id;

    expect(selectCyclePayments(undone, cycleId)).toHaveLength(0);
    expect(launchRecurringCharges(undone, at(8))).toBe(undone);
    expect(selectPendingFixedExpenses(undone, cycleId).map((fixed) => fixed.id)).toEqual([
      'netflix',
      'aluguel',
    ]);
    expect(selectRecurringIssues(undone, cycleId, at(8).now).netflix).toMatch(/desfeito/);
  });

  it('fixa já paga à mão no ciclo não é cobrada de novo na virada', () => {
    let state = openCycle(ready(5), at(7));
    const cardId = state.creditCards[0]!.id;
    state = payFixedExpense(state, { fixedExpenseId: 'netflix', method: 'credit', cardId }, at(8));

    expect(launchRecurringCharges(state, at(6, 11))).toBe(state);
  });

  it('o ciclo seguinte lança na virada seguinte, com ids da nova fatura', () => {
    let state = openCycle(ready(6), at(7));
    state = closeCycle(state, at(7, 11));
    state = openCycle(state, at(7, 11));

    expect(state.fixedPayments.map((payment) => payment.id)).toEqual([
      'auto-pay-2026-11-netflix',
      'auto-pay-2026-12-netflix',
    ]);
    expect(state.cardPurchases.map((purchase) => purchase.id)).toEqual([
      'auto-buy-2026-11-netflix',
      'auto-buy-2026-12-netflix',
    ]);
  });

  it('dois aparelhos que lançam a mesma virada geram os mesmos ids (sem duplicar)', () => {
    const a = openCycle(ready(6), at(7));
    const b = openCycle(ready(6), at(7));

    expect(a.cardPurchases.map((purchase) => purchase.id)).toEqual(
      b.cardPurchases.map((purchase) => purchase.id),
    );
    expect(a.fixedPayments.map((payment) => payment.id)).toEqual(
      b.fixedPayments.map((payment) => payment.id),
    );
  });
});

describe('fixa recorrente: configuração', () => {
  it('saveConfig exige cartão existente e ativo ao marcar; marca antiga com cartão inativo passa', () => {
    const state = ready(6, false);
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
    expect(() => saveConfig(inactive, config(cardId), at(6))).not.toThrow();
    expect(selectCreditCards(inactive)[0]!.active).toBe(false);
    expect(() =>
      saveConfig(setCreditCardActive(state, cardId, false, at(4)), config(cardId), at(5)),
    ).toThrow();
  });

  it('desmarcar remove a recorrência e marca a fixa como alterada', () => {
    const cleared = saveConfig(ready(6), config(), at(4));
    const fixed = cleared.fixedExpenses.find((record) => record.id === 'netflix')!;

    expect(fixed).not.toHaveProperty('recurringCardId');
    expect(fixed.dirty).toBe(true);
  });
});

describe('fixa recorrente: projeção', () => {
  it('conta a fixa como fatura no ciclo da fatura, sem duplicar como fixa', () => {
    const recurring = selectCycleProjections(openCycle(ready(6), at(7)), at(8).now, 3);
    const manual = selectCycleProjections(openCycle(ready(6, false), at(7)), at(8).now, 3);

    expect(recurring.map((item) => item.cyclesAhead)).toEqual([1, 2, 3]);
    for (let index = 0; index < 3; index += 1) {
      // Netflix (R$ 50) sai de "fixas" e entra em "cartão" (no ciclo em que vence a fatura).
      expect(manual[index]!.fixedExpenses - recurring[index]!.fixedExpenses).toBe(5000);
      expect(recurring[index]!.cardCharges).toBeGreaterThanOrEqual(manual[index]!.cardCharges);
    }
    expect(recurring[1]!.cardCharges - manual[1]!.cardCharges).toBe(5000);
  });

  it('cartão inativo: a projeção volta a contar a fixa como fixa', () => {
    let state = ready(6);
    state = setCreditCardActive(state, state.creditCards[0]!.id, false, at(4));
    const reference = selectCycleProjections(openCycle(ready(6, false), at(7)), at(8).now, 2);
    const projected = selectCycleProjections(openCycle(state, at(7)), at(8).now, 2);

    expect(projected.map((item) => item.fixedExpenses)).toEqual(
      reference.map((item) => item.fixedExpenses),
    );
  });
});

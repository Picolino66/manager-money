import { payStatement, saveCreditCard, addExistingCardDebt } from './card.use-cases';
import {
  existingDebtCommitted,
  existingDebtCycleRange,
  findStatementBalance,
  isValidInstallmentCount,
  resolveChosenStatement,
  selectStatementChoices,
} from './card-debt';
import { openCycle, saveConfig } from './cycle.use-cases';
import { selectCreditCards } from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';

let sequence = 0;
const at = (day: number, month = 10): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});
const TODAY = new Date(2026, 9, 10, 12);

function fixture(): LocalState {
  let state = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [],
    },
    at(7),
  );
  state = openCycle(state, at(7));
  return saveCreditCard(state, { name: 'Nubank', closingDay: 5, dueDay: 15 }, at(8));
}

describe('situação inicial do cartão (núcleo)', () => {
  it('oferece a fatura fechada aguardando vencimento e a aberta', () => {
    const state = fixture();
    const card = selectCreditCards(state)[0]!;
    const choices = selectStatementChoices(state, card, TODAY);

    expect(choices.map((choice) => [choice.key, choice.status, choice.dueDate])).toEqual([
      ['2026-10', 'closed', '2026-10-15'],
      ['2026-11', 'open', '2026-11-15'],
    ]);
    expect(resolveChosenStatement(choices, '2026-11', card, TODAY)).toBe('2026-11');
    expect(resolveChosenStatement(choices, 'inexistente', card, TODAY)).toBe('2026-10');
    expect(resolveChosenStatement([], '', card, TODAY)).toBe('2026-11');
  });

  it('depois do vencimento a fatura não é oferecida; com pagamento lançado também não', () => {
    let state = fixture();
    const card = selectCreditCards(state)[0]!;

    expect(
      selectStatementChoices(state, card, new Date(2026, 9, 20, 12)).map((c) => c.key),
    ).toEqual(['2026-11']);

    state = addExistingCardDebt(
      state,
      {
        cardId: card.id,
        description: 'Fatura de outubro',
        category: 'Outros',
        installmentAmount: 40000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-10',
        statementBalance: true,
      },
      at(10),
    );
    expect(findStatementBalance(state, card.id, '2026-10')?.totalAmount).toBe(40000);
    expect(findStatementBalance(state, card.id, '2026-11')).toBeUndefined();

    state = payStatement(state, { cardId: card.id, statementKey: '2026-10' }, at(11));
    expect(
      selectStatementChoices(state, card, new Date(2026, 9, 11, 12)).map((c) => c.key),
    ).toEqual(['2026-11']);
  });

  it('valida parcelas e calcula ciclos e comprometimento', () => {
    const state = fixture();
    const card = selectCreditCards(state)[0]!;

    expect(isValidInstallmentCount(10, 6)).toBe(true);
    expect(isValidInstallmentCount(0, 0)).toBe(false);
    expect(isValidInstallmentCount(10, 11)).toBe(false);
    expect(isValidInstallmentCount(49, 1)).toBe(false);

    const range = existingDebtCycleRange(card, 7, state.cycles[0]!.startDate, '2026-11', 3);
    expect(range.lastCycleKey > range.firstCycleKey).toBe(true);
    expect(existingDebtCycleRange(card, 7, null, '2026-11', 1).firstCycleKey).toBe(
      existingDebtCycleRange(card, 7, null, '2026-11', 1).lastCycleKey,
    );

    expect(existingDebtCommitted(10000, 4, false)).toBe(40000);
    expect(existingDebtCommitted(10000, 4, true)).toBe(30000);
  });
});

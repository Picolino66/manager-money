import {
  addExistingCardDebt,
  addExistingCardDebts,
  payStatement,
  saveCreditCard,
} from './card.use-cases';
import { DomainError } from './errors';
import {
  buildExistingDebtInput,
  existingDebtCommitted,
  existingDebtCycleRange,
  findStatementBalance,
  isValidInstallmentCount,
  resolveChosenStatement,
  selectStatementChoices,
  validateExistingDebtDraft,
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

describe('cadastro em lote da situação inicial', () => {
  const item = (description: string, extra: object = {}) => ({
    description,
    category: 'Outros',
    installmentAmount: 10000,
    totalInstallments: 10,
    remainingInstallments: 6,
    nextStatementKey: '2026-11',
    ...extra,
  });

  it('grava todos os itens de uma vez, cada um com seu id', () => {
    const state = fixture();
    const cardId = selectCreditCards(state)[0]!.id;
    const next = addExistingCardDebts(
      state,
      [item('Celular'), item('Geladeira', { remainingInstallments: 3 })].map((input) => ({
        ...input,
        cardId,
      })),
      at(10),
    );
    const purchases = next.cardPurchases.filter((purchase) => purchase.origin === 'existing');

    expect(purchases.map((purchase) => purchase.description)).toEqual(['Celular', 'Geladeira']);
    expect(new Set(purchases.map((purchase) => purchase.id)).size).toBe(2);
    expect(purchases.every((purchase) => purchase.dirty)).toBe(true);
  });

  it('tudo ou nada: item inválido desfaz o lote e o erro diz qual foi', () => {
    const state = fixture();
    const cardId = selectCreditCards(state)[0]!.id;
    const inputs = [
      item('Celular'),
      item('Geladeira', { remainingInstallments: 12 }),
      item('TV'),
    ].map((input) => ({ ...input, cardId }));

    expect(() => addExistingCardDebts(state, inputs, at(10))).toThrow(
      /^Item 2 \(Geladeira\): As parcelas restantes/,
    );
    expect(state.cardPurchases).toHaveLength(0);
    expect(() => addExistingCardDebts(state, [], at(10))).toThrow(DomainError);
  });

  it('as parcelas incluídas no total somam entre os itens do mesmo lote', () => {
    let state = fixture();
    const cardId = selectCreditCards(state)[0]!.id;
    state = addExistingCardDebt(
      state,
      {
        cardId,
        description: 'Fatura',
        category: 'Outros',
        installmentAmount: 10000,
        totalInstallments: 1,
        remainingInstallments: 1,
        nextStatementKey: '2026-11',
        statementBalance: true,
      },
      at(10),
    );
    const included = (description: string) => ({
      ...item(description, { installmentAmount: 6000, includedInStatementBalance: true }),
      cardId,
    });

    expect(() => addExistingCardDebts(state, [included('A'), included('B')], at(10))).toThrow(
      /^Item 2 \(B\): As parcelas incluídas somam mais/,
    );
    expect(addExistingCardDebts(state, [included('A')], at(10)).cardPurchases).toHaveLength(2);
  });
});

describe('formulário da situação inicial', () => {
  const draft = {
    mode: 'installments' as const,
    description: 'Celular',
    amount: 10000,
    total: 10,
    remaining: 6,
  };

  it('valida parcelamento e fatura em aberto', () => {
    expect(validateExistingDebtDraft(draft)).toEqual({});
    expect(
      validateExistingDebtDraft({ ...draft, description: ' ', amount: 0, remaining: 11 }),
    ).toEqual({
      description: 'Informe uma descrição.',
      amount: 'Informe um valor maior que zero.',
      remaining: 'As parcelas restantes devem ficar entre 1 e o total.',
    });
    expect(validateExistingDebtDraft({ ...draft, total: 49 }).total).toMatch(/1 a 48/);
    expect(
      validateExistingDebtDraft({ ...draft, purchaseDate: '2026-05-01' }, '2026-10-10'),
    ).toEqual({});
    expect(
      validateExistingDebtDraft({ ...draft, purchaseDate: '2026-11-01' }, '2026-10-10')
        .purchaseDate,
    ).toMatch(/futura/);
    expect(validateExistingDebtDraft({ ...draft, purchaseDate: '01/05' }).purchaseDate).toMatch(
      /válida/,
    );
    // Fatura em aberto: descrição opcional, parcelas ignoradas.
    expect(
      validateExistingDebtDraft({
        mode: 'statement',
        description: '',
        amount: 500,
        total: 0,
        remaining: 0,
      }),
    ).toEqual({});
    expect(
      validateExistingDebtDraft({
        mode: 'statement',
        description: '',
        amount: 0,
        total: 0,
        remaining: 0,
      }).amount,
    ).toBeDefined();
  });

  it('monta a entrada do caso de uso nos dois modos', () => {
    const base = {
      cardId: 'c1',
      category: 'Lazer',
      amount: 10000,
      total: 10,
      remaining: 6,
      statementKey: '2026-11',
      includedInBalance: true,
    };

    expect(
      buildExistingDebtInput({ ...base, mode: 'installments', description: ' Celular ' }),
    ).toEqual({
      cardId: 'c1',
      description: 'Celular',
      category: 'Lazer',
      installmentAmount: 10000,
      totalInstallments: 10,
      remainingInstallments: 6,
      nextStatementKey: '2026-11',
      includedInStatementBalance: true,
    });
    expect(buildExistingDebtInput({ ...base, mode: 'statement', description: '' })).toMatchObject({
      description: 'Fatura 11/2026',
      category: 'Outros',
      totalInstallments: 1,
      remainingInstallments: 1,
      statementBalance: true,
    });
  });
});

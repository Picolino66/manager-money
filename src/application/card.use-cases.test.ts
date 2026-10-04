import { addCardPurchase as addPurchase, canDeleteCardPurchase, deleteCardPurchase, deleteCreditCard, saveCreditCard } from './card.use-cases';
import { closeCycle, openCycle, saveConfig } from './cycle.use-cases';
import { selectActiveCycle, selectCardCharges, selectCardInstallments } from './selectors';
import { createEmptyState, LocalState, UseCaseContext } from './state';
import { FinancialConfigInput } from '../domain/financial/financial.types';

let sequence = 0;
const at = (year: number, month: number, day: number): UseCaseContext => ({
  now: new Date(year, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

const config: FinancialConfigInput = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
  savingGoal: 0,
  customCategories: [],
  fixedExpenses: [],
};

const purchaseInput = {
  cardId: 'card-1', // substituído por `cardIdOf` quando há estado
  description: 'Notebook',
  category: 'Educação',
  totalAmount: 30000,
  installments: 3,
  date: '2026-10-20',
};

/** Ciclo ativo 07/10–06/11 (chave 2026-10) e um cartão que fecha dia 25 e vence dia 5. */
function withCard(): LocalState {
  const ctx = at(2026, 10, 10);
  const opened = openCycle(saveConfig(createEmptyState(), config, ctx), ctx);

  return saveCreditCard(opened, { name: 'Nubank', closingDay: 25, dueDay: 5 }, ctx);
}

const cardIdOf = (state: LocalState) => state.creditCards[0]!.id;
const initialOf = (state: LocalState) => selectActiveCycle(state)?.initialAvailableAmount;

beforeEach(() => {
  sequence = 0;
});

/** Usa o primeiro cartão do estado quando o `cardId` não é informado de propósito. */
function addCardPurchase(state: LocalState, input: typeof purchaseInput, ctx: UseCaseContext) {
  const known = state.creditCards.some((card) => card.id === input.cardId);

  return addPurchase(state, known || input.cardId !== 'card-1' ? input : { ...input, cardId: state.creditCards[0]?.id ?? 'card-1' }, ctx);
}

describe('saveCreditCard (BR-FIN-019)', () => {
  it('cria o cartão sujo e normaliza o nome', () => {
    const state = saveCreditCard(createEmptyState(), { name: '  Nubank ', closingDay: 25, dueDay: 5 }, at(2026, 10, 10));
    expect(state.creditCards).toEqual([
      expect.objectContaining({ id: 'card-1', name: 'Nubank', closingDay: 25, dueDay: 5, dirty: true, deletedAt: null }),
    ]);
  });

  it('valida nome, dias de 1 a 28 e nome duplicado', () => {
    const state = withCard();
    const ctx = at(2026, 10, 11);
    expect(() => saveCreditCard(state, { name: ' ', closingDay: 1, dueDay: 1 }, ctx)).toThrow('nome do cartão');
    expect(() => saveCreditCard(state, { name: 'X', closingDay: 29, dueDay: 1 }, ctx)).toThrow('fechamento');
    expect(() => saveCreditCard(state, { name: 'X', closingDay: 1, dueDay: 0 }, ctx)).toThrow('vencimento');
    expect(() => saveCreditCard(state, { name: 'nubank', closingDay: 1, dueDay: 1 }, ctx)).toThrow('Já existe');
  });

  it('edita o cartão e não suja quando nada muda', () => {
    const state = withCard();
    const clean: LocalState = { ...state, creditCards: state.creditCards.map((card) => ({ ...card, dirty: false })) };
    expect(saveCreditCard(clean, { id: cardIdOf(clean), name: 'Nubank', closingDay: 25, dueDay: 5 }, at(2026, 10, 11))).toBe(clean);
    const edited = saveCreditCard(clean, { id: cardIdOf(clean), name: 'Nubank', closingDay: 20, dueDay: 5 }, at(2026, 10, 11));
    expect(edited.creditCards[0]).toMatchObject({ closingDay: 20, dirty: true });
    expect(() => saveCreditCard(clean, { id: 'x', name: 'Y', closingDay: 1, dueDay: 1 }, at(2026, 10, 11))).toThrow('não encontrado');
  });
});

describe('addCardPurchase (BR-FIN-019/020)', () => {
  it('antes do fechamento a 1ª parcela entra no ciclo atual e reduz o saldo inicial', () => {
    const state = addCardPurchase(withCard(), purchaseInput, at(2026, 10, 20));
    expect(state.cardPurchases[0]).toMatchObject({ firstCycleKey: '2026-10', totalAmount: 30000, dirty: true });
    expect(selectCardCharges(state, '2026-10')).toBe(10000);
    expect(initialOf(state)).toBe(490000);
    expect(selectActiveCycle(state)?.dirty).toBe(true);
  });

  it('depois do fechamento a compra vai para o próximo ciclo e não mexe no saldo atual', () => {
    const state = addCardPurchase(withCard(), { ...purchaseInput, date: '2026-10-28' }, at(2026, 10, 28));
    expect(state.cardPurchases[0]?.firstCycleKey).toBe('2026-11');
    expect(initialOf(state)).toBe(500000);
  });

  it('o ciclo seguinte já abre com as parcelas que caem nele', () => {
    let state = addCardPurchase(withCard(), purchaseInput, at(2026, 10, 20));
    state = addCardPurchase(state, { ...purchaseInput, description: 'Tênis', totalAmount: 9000, installments: 1, date: '2026-10-28' }, at(2026, 10, 28));
    state = closeCycle(state, at(2026, 11, 7));
    state = openCycle(state, at(2026, 11, 7));

    const cycle = selectActiveCycle(state);
    expect(cycle?.startDate).toBe('2026-11-07');
    // 2ª parcela do notebook (10000) + tênis à vista na fatura de novembro (9000).
    expect(selectCardInstallments(state, '2026-11').map((item) => [item.purchase.description, item.number, item.amount])).toEqual([
      ['Notebook', 2, 10000],
      ['Tênis', 1, 9000],
    ]);
    expect(cycle?.initialAvailableAmount).toBe(500000 - 19000);
  });

  it('salvar a configuração mantém o desconto das parcelas', () => {
    const state = addCardPurchase(withCard(), purchaseInput, at(2026, 10, 20));
    const resaved = saveConfig(
      state,
      { ...config, incomeSources: [{ id: 'renda', name: 'Salário', amount: 600000, payday: 7 }] },
      at(2026, 10, 21),
    );
    expect(initialOf(resaved)).toBe(600000 - 10000);
  });

  it('valida ciclo, configuração, cartão, valores, parcelas e data', () => {
    const state = withCard();
    const ctx = at(2026, 10, 20);
    const noCycle = saveCreditCard(saveConfig(createEmptyState(), config, ctx), { name: 'A', closingDay: 1, dueDay: 2 }, ctx);
    expect(() => addCardPurchase(noCycle, purchaseInput, ctx)).toThrow('Nenhum ciclo ativo');
    expect(() => addCardPurchase(state, { ...purchaseInput, cardId: 'x' }, ctx)).toThrow('Cartão não encontrado');
    expect(() => addCardPurchase(state, { ...purchaseInput, description: ' ' }, ctx)).toThrow('descrição');
    expect(() => addCardPurchase(state, { ...purchaseInput, totalAmount: 0 }, ctx)).toThrow('maior que zero');
    expect(() => addCardPurchase(state, { ...purchaseInput, installments: 0 }, ctx)).toThrow('parcelas');
    expect(() => addCardPurchase(state, { ...purchaseInput, installments: 49 }, ctx)).toThrow('parcelas');
    expect(() => addCardPurchase(state, { ...purchaseInput, date: '2026-12-01' }, ctx)).toThrow('dentro do ciclo');
    expect(() => addCardPurchase({ ...state, settings: null }, purchaseInput, ctx)).toThrow('Configure');
  });
});

describe('exclusões', () => {
  it('excluir a compra devolve o saldo; cartão com compras não pode ser excluído', () => {
    const state = addCardPurchase(withCard(), purchaseInput, at(2026, 10, 20));
    expect(() => deleteCreditCard(state, cardIdOf(state), at(2026, 10, 21))).toThrow('Desative-o');

    const without = deleteCardPurchase(state, state.cardPurchases[0]!.id, at(2026, 10, 21));
    expect(initialOf(without)).toBe(500000);
    expect(without.cardPurchases[0]?.deletedAt).not.toBeNull();

    const removed = deleteCreditCard(without, cardIdOf(without), at(2026, 10, 22));
    expect(removed.creditCards[0]?.deletedAt).not.toBeNull();
    expect(() => deleteCreditCard(removed, cardIdOf(removed), at(2026, 10, 22))).toThrow('não encontrado');
  });

  it('compra com parcelas em ciclo fechado não pode ser excluída', () => {
    let state = addCardPurchase(withCard(), purchaseInput, at(2026, 10, 20));
    state = closeCycle(state, at(2026, 11, 7));
    const purchase = state.cardPurchases[0]!;

    expect(canDeleteCardPurchase(state, purchase)).toBe(false);
    expect(() => deleteCardPurchase(state, purchase.id, at(2026, 11, 8))).toThrow('ciclo fechado');
    expect(() => deleteCardPurchase(state, 'nada', at(2026, 11, 8))).toThrow('não encontrada');
  });
});

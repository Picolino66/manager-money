import { parseISO } from 'date-fns';

import {
  calculateFirstCycleKey,
  CardPurchase,
  cycleKeyFromStartDate,
  lastInstallmentCycleKey,
  MAX_CARD_DAY,
  MAX_CARD_INSTALLMENTS,
  MIN_CARD_DAY,
} from '../domain/financial/credit-card';
import { normalizeCategory } from '../domain/financial/financial.calculations';
import { assertDateWithinCycle, recalculateActiveCycleBalance, requireActiveCycle } from './cycle.use-cases';
import { DomainError } from './errors';
import { selectConfig } from './selectors';
import { CardPurchaseRecord, CreditCardRecord, isLive, LocalState, touch, UseCaseContext } from './state';

export type CreditCardInput = {
  id?: string;
  name: string;
  closingDay: number;
  dueDay: number;
};

export type CardPurchaseInput = {
  cardId: string;
  description: string;
  category: string;
  /** Valor total, já com juros (BR-FIN-020). */
  totalAmount: number;
  installments: number;
  /** Data da compra (yyyy-MM-dd), dentro do ciclo ativo. */
  date: string;
};

function assertCardDay(day: number, label: string) {
  if (!Number.isInteger(day) || day < MIN_CARD_DAY || day > MAX_CARD_DAY) {
    throw new DomainError(`${label} deve ser um dia entre ${MIN_CARD_DAY} e ${MAX_CARD_DAY}.`);
  }
}

function findLiveCard(state: LocalState, cardId: string): CreditCardRecord {
  const card = state.creditCards.find((record) => record.id === cardId && isLive(record));

  if (!card) {
    throw new DomainError('Cartão não encontrado.');
  }

  return card;
}

/** BR-FIN-019: cria ou atualiza um cartão (nome único, fechamento e vencimento de 1 a 28). */
export function saveCreditCard(
  state: LocalState,
  input: CreditCardInput,
  ctx: UseCaseContext,
): LocalState {
  const name = input.name.trim();

  if (!name) {
    throw new DomainError('Informe o nome do cartão.');
  }

  assertCardDay(input.closingDay, 'O dia de fechamento');
  assertCardDay(input.dueDay, 'O dia de vencimento');

  const duplicated = state.creditCards.some(
    (card) =>
      isLive(card) && card.id !== input.id && card.name.toLowerCase() === name.toLowerCase(),
  );

  if (duplicated) {
    throw new DomainError('Já existe um cartão com esse nome.');
  }

  const fields = { name, closingDay: input.closingDay, dueDay: input.dueDay };

  if (input.id) {
    const current = findLiveCard(state, input.id);
    const unchanged =
      current.name === fields.name &&
      current.closingDay === fields.closingDay &&
      current.dueDay === fields.dueDay;

    return unchanged
      ? state
      : {
          ...state,
          creditCards: state.creditCards.map((card) =>
            card.id === current.id ? touch({ ...card, ...fields }, ctx.now) : card,
          ),
        };
  }

  const card: CreditCardRecord = {
    id: ctx.newId('card'),
    ...fields,
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  return { ...state, creditCards: [...state.creditCards, card] };
}

/** Exclusão lógica; só é permitida sem compras vigentes no cartão. */
export function deleteCreditCard(state: LocalState, cardId: string, ctx: UseCaseContext): LocalState {
  const card = findLiveCard(state, cardId);

  if (state.cardPurchases.some((purchase) => isLive(purchase) && purchase.cardId === card.id)) {
    throw new DomainError('Exclua as compras deste cartão antes de removê-lo.');
  }

  return {
    ...state,
    creditCards: state.creditCards.map((record) =>
      record.id === card.id ? touch({ ...record, deletedAt: ctx.now.toISOString() }, ctx.now) : record,
    ),
  };
}

/**
 * BR-FIN-019/020: registra a compra no crédito. A 1ª parcela cai no ciclo que contém o
 * fechamento da fatura; as demais, nos ciclos seguintes. O saldo do ciclo ativo é recalculado.
 */
export function addCardPurchase(
  state: LocalState,
  input: CardPurchaseInput,
  ctx: UseCaseContext,
): LocalState {
  const config = selectConfig(state);
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para registrar compras no cartão.');

  if (!config) {
    throw new DomainError('Configure a base financeira antes de registrar compras no cartão.');
  }

  const card = findLiveCard(state, input.cardId);
  const description = input.description.trim();

  if (!description) {
    throw new DomainError('Informe uma descrição.');
  }

  if (!Number.isInteger(input.totalAmount) || input.totalAmount <= 0) {
    throw new DomainError('Informe um valor maior que zero.');
  }

  if (
    !Number.isInteger(input.installments) ||
    input.installments < 1 ||
    input.installments > MAX_CARD_INSTALLMENTS
  ) {
    throw new DomainError(`As parcelas devem ficar entre 1 e ${MAX_CARD_INSTALLMENTS}.`);
  }

  assertDateWithinCycle(cycle, input.date);

  const purchase: CardPurchaseRecord = {
    id: ctx.newId('purchase'),
    cardId: card.id,
    description,
    category: normalizeCategory(input.category),
    totalAmount: input.totalAmount,
    installments: input.installments,
    purchaseDate: input.date,
    firstCycleKey: calculateFirstCycleKey(
      parseISO(input.date),
      card.closingDay,
      config.payday,
      cycleKeyFromStartDate(cycle.startDate),
    ),
    createdAt: ctx.now.toISOString(),
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  return recalculateActiveCycleBalance(
    { ...state, cardPurchases: [...state.cardPurchases, purchase] },
    ctx,
  );
}

/** Parcelas em ciclos fechados não podem mudar (histórico imutável). */
export function canDeleteCardPurchase(state: LocalState, purchase: CardPurchase): boolean {
  const lastKey = lastInstallmentCycleKey(purchase);

  return !state.cycles.some((cycle) => {
    if (!isLive(cycle) || cycle.status !== 'closed') {
      return false;
    }

    const key = cycleKeyFromStartDate(cycle.startDate);

    return key >= purchase.firstCycleKey && key <= lastKey;
  });
}

export function deleteCardPurchase(
  state: LocalState,
  purchaseId: string,
  ctx: UseCaseContext,
): LocalState {
  const purchase = state.cardPurchases.find((record) => record.id === purchaseId && isLive(record));

  if (!purchase) {
    throw new DomainError('Compra não encontrada.');
  }

  if (!canDeleteCardPurchase(state, purchase)) {
    throw new DomainError('Esta compra já tem parcelas em ciclos fechados e não pode ser excluída.');
  }

  return recalculateActiveCycleBalance(
    {
      ...state,
      cardPurchases: state.cardPurchases.map((record) =>
        record.id === purchase.id ? touch({ ...record, deletedAt: ctx.now.toISOString() }, ctx.now) : record,
      ),
    },
    ctx,
  );
}

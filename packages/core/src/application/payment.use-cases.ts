import { calculateFixedExpenseAmount } from '../domain/financial/financial.calculations';
import { isActive } from '../domain/financial/financial.types';
import { PAYMENT_METHODS, PaymentMethod } from '../domain/financial/payments';
import { clampIsoDate, toISODate } from '../utils/date';
import { buildCardPurchase, canModifyCardPurchase } from './card.use-cases';
import {
  assertDateWithinCycle,
  recalculateActiveCycleBalance,
  requireActiveCycle,
} from './cycle.use-cases';
import { DomainError } from './errors';
import { selectConfig, selectCyclePayments } from './selectors';
import {
  CardPurchaseRecord,
  CycleRecord,
  ExtraIncomeRecord,
  FixedPaymentRecord,
  isLive,
  LocalState,
  touch,
  UseCaseContext,
} from './state';

export type PayFixedExpenseInput = {
  fixedExpenseId: string;
  method: PaymentMethod;
  /** Crédito: cartão que recebe a compra. */
  cardId?: string;
  /** Crédito: número de parcelas (padrão 1). */
  installments?: number;
  /** Crédito: juros cobrados, em centavos, somados ao valor (BR-FIN-022). */
  interest?: number;
};

export type ExtraIncomeInput = {
  name: string;
  amount: number;
  /** Data do recebimento (yyyy-MM-dd), dentro do ciclo ativo. */
  date: string;
};

/** Limita a data de hoje ao período do ciclo (o ciclo pode ter terminado sem ser fechado). */
function clampToCycle(cycle: CycleRecord, now: Date): string {
  return clampIsoDate(toISODate(now), cycle.startDate, cycle.endDate);
}

/**
 * BR-FIN-021/022: confirma o pagamento de uma despesa fixa no ciclo ativo. À vista (Pix,
 * dinheiro, débito) desconta da renda do ciclo agora; no crédito, vira uma compra no cartão com
 * `valor + juros`, parcelada, que desconta nos ciclos das faturas (BR-FIN-019).
 */
export function payFixedExpense(
  state: LocalState,
  input: PayFixedExpenseInput,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para registrar pagamentos.');

  if (!selectConfig(state)) {
    throw new DomainError('Configure a base financeira antes de registrar pagamentos.');
  }

  if (!PAYMENT_METHODS.includes(input.method)) {
    throw new DomainError('Escolha a forma de pagamento.');
  }

  const fixed = state.fixedExpenses.find(
    (record) => record.id === input.fixedExpenseId && isLive(record),
  );

  if (!fixed) {
    throw new DomainError('Despesa fixa não encontrada.');
  }

  if (!isActive(fixed)) {
    throw new DomainError('Esta despesa fixa está inativa.');
  }

  const amount = calculateFixedExpenseAmount(fixed);

  if (amount <= 0) {
    throw new DomainError('Esta despesa não tem valor a pagar neste ciclo.');
  }

  if (selectCyclePayments(state, cycle.id).some((payment) => payment.fixedExpenseId === fixed.id)) {
    throw new DomainError('Esta despesa já foi paga neste ciclo.');
  }

  const paidAt = clampToCycle(cycle, ctx.now);
  const payment: FixedPaymentRecord = {
    id: ctx.newId('payment'),
    cycleId: cycle.id,
    fixedExpenseId: fixed.id,
    name: fixed.name,
    category: fixed.category,
    method: input.method,
    amount,
    interest: 0,
    paidAt,
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  if (input.method !== 'credit') {
    return recalculateActiveCycleBalance(
      { ...state, fixedPayments: [...state.fixedPayments, payment] },
      ctx,
    );
  }

  const interest = input.interest ?? 0;

  if (!Number.isInteger(interest) || interest < 0) {
    throw new DomainError('Os juros não podem ser negativos.');
  }

  if (!input.cardId) {
    throw new DomainError('Escolha o cartão do pagamento no crédito.');
  }

  const purchase: CardPurchaseRecord = buildCardPurchase(
    state,
    {
      cardId: input.cardId,
      description: fixed.name,
      category: fixed.category,
      totalAmount: amount + interest,
      installments: input.installments ?? 1,
      date: paidAt,
    },
    ctx,
  );

  return recalculateActiveCycleBalance(
    {
      ...state,
      cardPurchases: [...state.cardPurchases, purchase],
      fixedPayments: [
        ...state.fixedPayments,
        { ...payment, interest, cardPurchaseId: purchase.id },
      ],
    },
    ctx,
  );
}

/** Desfaz um pagamento do ciclo ativo; no crédito, remove também a compra no cartão. */
export function undoFixedPayment(
  state: LocalState,
  paymentId: string,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para desfazer pagamentos.');
  const payment = state.fixedPayments.find((record) => record.id === paymentId && isLive(record));

  if (!payment || payment.cycleId !== cycle.id) {
    throw new DomainError('Só é possível desfazer pagamentos do ciclo ativo.');
  }

  const purchase = payment.cardPurchaseId
    ? state.cardPurchases.find((record) => record.id === payment.cardPurchaseId && isLive(record))
    : undefined;

  if (purchase && !canModifyCardPurchase(state, purchase)) {
    throw new DomainError(
      'A compra no cartão deste pagamento já pesou em um ciclo fechado ou em uma fatura paga.',
    );
  }

  const deletedAt = ctx.now.toISOString();

  return recalculateActiveCycleBalance(
    {
      ...state,
      fixedPayments: state.fixedPayments.map((record) =>
        record.id === payment.id ? touch({ ...record, deletedAt }, ctx.now) : record,
      ),
      cardPurchases: state.cardPurchases.map((record) =>
        purchase && record.id === purchase.id ? touch({ ...record, deletedAt }, ctx.now) : record,
      ),
    },
    ctx,
  );
}

/** BR-FIN-023: lança uma renda avulsa no ciclo ativo; soma ao saldo disponível. */
export function addExtraIncome(
  state: LocalState,
  input: ExtraIncomeInput,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para receber rendas.');
  const name = input.name.trim();

  if (!name) {
    throw new DomainError('Informe o nome da renda.');
  }

  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new DomainError('Informe um valor maior que zero.');
  }

  assertDateWithinCycle(cycle, input.date, 'recebimento');

  const income: ExtraIncomeRecord = {
    id: ctx.newId('income'),
    cycleId: cycle.id,
    name,
    amount: input.amount,
    date: input.date,
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  return recalculateActiveCycleBalance(
    { ...state, extraIncomes: [...state.extraIncomes, income] },
    ctx,
  );
}

export function deleteExtraIncome(
  state: LocalState,
  incomeId: string,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para excluir rendas.');
  const income = state.extraIncomes.find((record) => record.id === incomeId && isLive(record));

  if (!income || income.cycleId !== cycle.id) {
    throw new DomainError('Renda não encontrada no ciclo ativo.');
  }

  return recalculateActiveCycleBalance(
    {
      ...state,
      extraIncomes: state.extraIncomes.map((record) =>
        record.id === income.id
          ? touch({ ...record, deletedAt: ctx.now.toISOString() }, ctx.now)
          : record,
      ),
    },
    ctx,
  );
}

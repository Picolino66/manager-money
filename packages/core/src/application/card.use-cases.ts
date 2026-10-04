import { addDays, isAfter, parseISO, startOfDay } from 'date-fns';

import {
  addCycleKeys,
  CardPurchase,
  currentStatementKey,
  cycleKeyFromStartDate,
  cycleKeyOffset,
  firstCountedCycleKey,
  isMonthKey,
  listEffectiveInstallments,
  lastInstallmentCycleKey,
  listOpenInstallments,
  MAX_CARD_DAY,
  MAX_CARD_INSTALLMENTS,
  MIN_CARD_DAY,
  statementClosingDate,
  statementCycleKey,
  statementDueDate,
  statementKeyForDate,
} from '../domain/financial/credit-card';
import { normalizeCategory } from '../domain/financial/financial.calculations';
import { FinancialConfig, isActive } from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';
import {
  assertDateWithinCycle,
  calculateNextCycleStartDate,
  recalculateActiveCycleBalance,
  requireActiveCycle,
} from './cycle.use-cases';
import { DomainError } from './errors';
import {
  selectActiveCycle,
  selectCardStatements,
  selectConfig,
  selectStatementPayments,
} from './selectors';
import {
  CardPurchaseRecord,
  CreditCardRecord,
  isLive,
  LocalState,
  StatementPaymentRecord,
  touch,
  UseCaseContext,
} from './state';

export type CreditCardInput = {
  id?: string;
  name: string;
  closingDay: number;
  dueDay: number;
  /** Limite total em centavos; `null` ou ausente = não informado (BR-FIN-026). */
  creditLimit?: number | null;
  /** Ausente: novo cartão nasce ativo; edição mantém o valor atual. */
  active?: boolean;
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

/**
 * Situação inicial (BR-FIN-027/032): total da fatura em aberto ou parcelamento que já existia
 * antes do app. O total da fatura é `statementBalance: true` com `totalInstallments =
 * remainingInstallments = 1`.
 */
export type ExistingCardDebtInput = {
  cardId: string;
  description: string;
  category: string;
  installmentAmount: number;
  totalInstallments: number;
  /** Parcelas ainda não pagas, incluindo a da fatura `nextStatementKey`. */
  remainingInstallments: number;
  /** Fatura (`yyyy-MM` do fechamento) da próxima parcela a pagar; ainda não vencida. */
  nextStatementKey: string;
  /** Total da fatura como o banco mostra: fonte de verdade daquela fatura (BR-FIN-032). */
  statementBalance?: boolean;
  /** Parcelamento: a parcela atual já está dentro do total informado da fatura (BR-FIN-032). */
  includedInStatementBalance?: boolean;
};

export type CardPurchaseUpdate = Omit<CardPurchaseInput, 'cardId'>;

export type PayStatementInput = {
  cardId: string;
  statementKey: string;
  /**
   * Valor pago. Ausente = quita o que falta (só até o vencimento). Menor que o restante = pagamento
   * parcial; maior = a diferença são encargos (BR-FIN-033).
   */
  paidAmount?: number;
};

export type StatementChargesInput = {
  cardId: string;
  statementKey: string;
  /** Juros/multa informados pelo banco, em centavos. */
  amount: number;
};

/** Quantas faturas à frente a situação inicial aceita para a próxima parcela. */
const MAX_STATEMENTS_AHEAD = 12;

function assertCardDay(day: number, label: string) {
  if (!Number.isInteger(day) || day < MIN_CARD_DAY || day > MAX_CARD_DAY) {
    throw new DomainError(`${label} deve ser um dia entre ${MIN_CARD_DAY} e ${MAX_CARD_DAY}.`);
  }
}

function assertPositiveCents(value: number, message = 'Informe um valor maior que zero.') {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainError(message);
  }
}

function assertInstallments(installments: number) {
  if (!Number.isInteger(installments) || installments < 1 || installments > MAX_CARD_INSTALLMENTS) {
    throw new DomainError(`As parcelas devem ficar entre 1 e ${MAX_CARD_INSTALLMENTS}.`);
  }
}

function requireDescription(value: string): string {
  const description = value.trim();

  if (!description) {
    throw new DomainError('Informe uma descrição.');
  }

  return description;
}

function requireConfig(state: LocalState, message: string): FinancialConfig {
  const config = selectConfig(state);

  if (!config) {
    throw new DomainError(message);
  }

  return config;
}

function findLiveCard(state: LocalState, cardId: string): CreditCardRecord {
  const card = state.creditCards.find((record) => record.id === cardId && isLive(record));

  if (!card) {
    throw new DomainError('Cartão não encontrado.');
  }

  return card;
}

/** Cartão que aceita compras novas: vivo e ativo (BR-FIN-028). */
function findUsableCard(state: LocalState, cardId: string): CreditCardRecord {
  const card = findLiveCard(state, cardId);

  if (!isActive(card)) {
    throw new DomainError('Este cartão está inativo. Ative-o para registrar compras.');
  }

  return card;
}

function findLivePurchase(state: LocalState, purchaseId: string): CardPurchaseRecord {
  const purchase = state.cardPurchases.find((record) => record.id === purchaseId && isLive(record));

  if (!purchase) {
    throw new DomainError('Compra não encontrada.');
  }

  return purchase;
}

/** Fatura com algum lançamento (pagamento ou encargo): não recebe compras retroativas. */
function isStatementPaid(state: LocalState, cardId: string, statementKey: string): boolean {
  return selectStatementPayments(state).some(
    (payment) => payment.cardId === cardId && payment.statementKey === statementKey,
  );
}

const maxKey = (left: string, right: string) => (left > right ? left : right);

/** Pagamento de fixa vivo que gerou a compra no cartão (BR-FIN-022). */
function findLinkedFixedPayment(state: LocalState, purchaseId: string) {
  return state.fixedPayments.find(
    (payment) => isLive(payment) && payment.cardPurchaseId === purchaseId,
  );
}

function formatMonthKey(key: string): string {
  return `${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

/** BR-FIN-019/026/028: cria ou atualiza um cartão (nome único, dias de 1 a 28, limite opcional). */
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

  const creditLimit = input.creditLimit ?? null;

  if (creditLimit !== null && (!Number.isInteger(creditLimit) || creditLimit < 0)) {
    throw new DomainError('O limite do cartão não pode ser negativo.');
  }

  const duplicated = state.creditCards.some(
    (card) =>
      isLive(card) && card.id !== input.id && card.name.toLowerCase() === name.toLowerCase(),
  );

  if (duplicated) {
    throw new DomainError('Já existe um cartão com esse nome.');
  }

  if (input.id) {
    const current = findLiveCard(state, input.id);
    const fields = {
      name,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      creditLimit,
      active: input.active ?? current.active,
    };
    const unchanged = (Object.keys(fields) as (keyof typeof fields)[]).every(
      (key) => current[key] === fields[key],
    );

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
    name,
    closingDay: input.closingDay,
    dueDay: input.dueDay,
    creditLimit,
    active: input.active ?? true,
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  return { ...state, creditCards: [...state.creditCards, card] };
}

/** BR-FIN-028: ativa ou desativa o cartão; as parcelas continuam valendo. */
export function setCreditCardActive(
  state: LocalState,
  cardId: string,
  active: boolean,
  ctx: UseCaseContext,
): LocalState {
  const card = findLiveCard(state, cardId);

  return card.active === active
    ? state
    : {
        ...state,
        creditCards: state.creditCards.map((record) =>
          record.id === card.id ? touch({ ...record, active }, ctx.now) : record,
        ),
      };
}

/** Exclusão lógica; só é permitida sem compras vigentes no cartão (BR-FIN-028). */
export function deleteCreditCard(
  state: LocalState,
  cardId: string,
  ctx: UseCaseContext,
): LocalState {
  const card = findLiveCard(state, cardId);

  if (state.cardPurchases.some((purchase) => isLive(purchase) && purchase.cardId === card.id)) {
    throw new DomainError('Este cartão tem compras registradas. Desative-o em vez de excluir.');
  }

  return {
    ...state,
    creditCards: state.creditCards.map((record) =>
      record.id === card.id
        ? touch({ ...record, deletedAt: ctx.now.toISOString() }, ctx.now)
        : record,
    ),
  };
}

// ---------------------------------------------------------------------------
// Compras
// ---------------------------------------------------------------------------

/**
 * Valida e monta a compra no cartão (sem gravar). A compra entra na fatura do 1º fechamento em ou
 * depois da data; a fatura pesa no ciclo do seu vencimento (BR-FIN-025). O valor já inclui os
 * juros (BR-FIN-020).
 */
export function buildCardPurchase(
  state: LocalState,
  input: CardPurchaseInput,
  ctx: UseCaseContext,
): CardPurchaseRecord {
  const config = requireConfig(
    state,
    'Configure a base financeira antes de registrar compras no cartão.',
  );
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para registrar compras no cartão.');
  const card = findUsableCard(state, input.cardId);
  const description = requireDescription(input.description);

  assertPositiveCents(input.totalAmount);
  assertInstallments(input.installments);
  assertDateWithinCycle(cycle, input.date, 'compra');

  const purchaseDate = parseISO(input.date);
  let firstStatementKey = statementKeyForDate(purchaseDate, card.closingDay);

  // Fechamento aumentado depois de pagar a fatura: a fatura paga já fechou, a compra vai para a
  // seguinte (BR-FIN-028).
  while (
    isStatementPaid(state, card.id, firstStatementKey) &&
    !isAfter(startOfDay(ctx.now), statementClosingDate(firstStatementKey, card.closingDay))
  ) {
    firstStatementKey = addCycleKeys(firstStatementKey, 1);
  }

  if (isStatementPaid(state, card.id, firstStatementKey)) {
    throw new DomainError(
      `A fatura ${formatMonthKey(firstStatementKey)} deste cartão já foi paga. Confira a data da compra.`,
    );
  }

  return {
    id: ctx.newId('purchase'),
    cardId: card.id,
    description,
    category: normalizeCategory(input.category),
    totalAmount: input.totalAmount,
    installments: input.installments,
    purchaseDate: input.date,
    firstStatementKey,
    firstCycleKey: maxKey(
      statementCycleKey(firstStatementKey, card, config.payday),
      cycleKeyFromStartDate(cycle.startDate),
    ),
    settledInstallments: 0,
    createdAt: ctx.now.toISOString(),
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };
}

/** BR-FIN-019/020/025: registra a compra no crédito e recalcula o saldo do ciclo ativo. */
export function addCardPurchase(
  state: LocalState,
  input: CardPurchaseInput,
  ctx: UseCaseContext,
): LocalState {
  const purchase = buildCardPurchase(state, input, ctx);

  return recalculateActiveCycleBalance(
    { ...state, cardPurchases: [...state.cardPurchases, purchase] },
    ctx,
  );
}

/** Ciclo de referência: o ativo, ou o próximo a abrir quando ainda não há ciclo. */
function referenceCycleKey(state: LocalState, now: Date): string {
  const cycle = selectActiveCycle(state);

  return cycle
    ? cycleKeyFromStartDate(cycle.startDate)
    : cycleKeyFromStartDate(toISODate(calculateNextCycleStartDate(state, now)));
}

/**
 * BR-FIN-027: cadastra uma fatura em aberto ou um parcelamento que já existia no cartão. Gera a
 * agenda das parcelas restantes a partir da fatura da próxima parcela; as já pagas não pesam no
 * orçamento nem no limite.
 */
export function addExistingCardDebt(
  state: LocalState,
  input: ExistingCardDebtInput,
  ctx: UseCaseContext,
): LocalState {
  const config = requireConfig(
    state,
    'Configure a base financeira antes de cadastrar compras anteriores.',
  );
  const card = findLiveCard(state, input.cardId);
  const description = requireDescription(input.description);

  assertPositiveCents(input.installmentAmount, 'Informe o valor da parcela.');
  assertInstallments(input.totalInstallments);

  if (
    !Number.isInteger(input.remainingInstallments) ||
    input.remainingInstallments < 1 ||
    input.remainingInstallments > input.totalInstallments
  ) {
    throw new DomainError('As parcelas restantes devem ficar entre 1 e o total de parcelas.');
  }

  if (!isMonthKey(input.nextStatementKey)) {
    throw new DomainError('Escolha a fatura da próxima parcela.');
  }

  const today = startOfDay(ctx.now);
  const openKey = currentStatementKey(card, today);
  const ahead = cycleKeyOffset(openKey, input.nextStatementKey);

  if (
    isAfter(today, statementDueDate(input.nextStatementKey, card)) ||
    ahead > MAX_STATEMENTS_AHEAD
  ) {
    throw new DomainError('A próxima parcela precisa estar em uma fatura que ainda não venceu.');
  }

  if (isStatementPaid(state, card.id, input.nextStatementKey)) {
    throw new DomainError(
      `A fatura ${formatMonthKey(input.nextStatementKey)} deste cartão já foi paga.`,
    );
  }

  const balances = state.cardPurchases.filter(
    (purchase) =>
      isLive(purchase) &&
      purchase.cardId === card.id &&
      purchase.kind === 'statement-balance' &&
      purchase.firstStatementKey === input.nextStatementKey,
  );

  if (input.statementBalance) {
    if (input.totalInstallments !== 1 || input.remainingInstallments !== 1) {
      throw new DomainError('O total da fatura é um valor único.');
    }

    if (balances.length > 0) {
      throw new DomainError(
        `Já existe um total informado para a fatura ${formatMonthKey(input.nextStatementKey)}.`,
      );
    }

    // Parcelas já marcadas como incluídas voltam a compor este total: ele precisa cobri-las.
    const pendingIncluded = state.cardPurchases
      .filter(
        (purchase) =>
          isLive(purchase) &&
          purchase.cardId === card.id &&
          purchase.includedInStatementBalance === true,
      )
      .flatMap((purchase) => listOpenInstallments(purchase).slice(0, 1))
      .filter((installment) => installment.statementKey === input.nextStatementKey)
      .reduce((total, installment) => total + installment.nominalAmount, 0);

    if (pendingIncluded > input.installmentAmount) {
      throw new DomainError(
        'As parcelas incluídas nesta fatura somam mais que o total informado. Confira os valores.',
      );
    }
  }

  // BR-FIN-032: a parcela incluída só compõe o total; os itens incluídos não podem passar dele.
  const included = !input.statementBalance && input.includedInStatementBalance === true;
  const balance = balances[0];

  if (included && !balance) {
    throw new DomainError('Informe antes o total desta fatura para incluir a parcela nele.');
  }

  if (included && balance) {
    const alreadyIncluded = listEffectiveInstallments(
      state.cardPurchases.filter((purchase) => isLive(purchase) && purchase.cardId === card.id),
    )
      .filter(
        (installment) =>
          installment.includedInBalance && installment.statementKey === input.nextStatementKey,
      )
      .reduce((total, installment) => total + installment.nominalAmount, 0);

    if (alreadyIncluded + input.installmentAmount > balance.totalAmount) {
      throw new DomainError(
        'As parcelas incluídas somam mais que o total informado da fatura. Confira os valores.',
      );
    }
  }

  const settled = input.totalInstallments - input.remainingInstallments;
  const nextCycleKey = statementCycleKey(input.nextStatementKey, card, config.payday);
  const activeKey = referenceCycleKey(state, ctx.now);
  const firstStatementKey = addCycleKeys(input.nextStatementKey, -settled);
  const purchase: CardPurchaseRecord = {
    id: ctx.newId('purchase'),
    cardId: card.id,
    description,
    category: normalizeCategory(input.category),
    totalAmount: input.installmentAmount * input.totalInstallments,
    installments: input.totalInstallments,
    purchaseDate: toISODate(statementClosingDate(firstStatementKey, card.closingDay)),
    firstStatementKey,
    firstCycleKey: addCycleKeys(nextCycleKey > activeKey ? nextCycleKey : activeKey, -settled),
    settledInstallments: settled,
    origin: 'existing',
    ...(input.statementBalance ? { kind: 'statement-balance' as const } : {}),
    ...(included ? { includedInStatementBalance: true } : {}),
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

/**
 * Cadastro em lote da situação inicial (BR-FIN-027/032): aplica `addExistingCardDebt` a cada item, em
 * ordem, sobre o mesmo estado — então as validações acumuladas valem entre os itens (ex.: as parcelas
 * "já no total" não passam do total da fatura). Tudo ou nada: o primeiro item recusado desfaz o lote
 * e o erro diz qual foi.
 */
export function addExistingCardDebts(
  state: LocalState,
  inputs: ExistingCardDebtInput[],
  ctx: UseCaseContext,
): LocalState {
  if (inputs.length === 0) {
    throw new DomainError('Adicione ao menos um item para salvar.');
  }

  return inputs.reduce((current, input, index) => {
    try {
      return addExistingCardDebt(current, input, ctx);
    } catch (error) {
      if (error instanceof DomainError) {
        throw new DomainError(`Item ${index + 1} (${input.description.trim()}): ${error.message}`);
      }

      throw error;
    }
  }, state);
}

/**
 * BR-FIN-029: a compra só muda (editar, excluir, estornar) enquanto nenhum ciclo fechado contou uma
 * parcela dela e nenhuma fatura paga contém parcela dela. Ciclos fechados antes do cadastro da
 * compra nunca a contaram.
 */
export function canModifyCardPurchase(state: LocalState, purchase: CardPurchase): boolean {
  const firstKey = firstCountedCycleKey(purchase);
  const lastKey = lastInstallmentCycleKey(purchase);
  const countedInClosedCycle = state.cycles.some((cycle) => {
    if (!isLive(cycle) || cycle.status !== 'closed') {
      return false;
    }

    const key = cycleKeyFromStartDate(cycle.startDate);
    const closedAfterPurchase = !cycle.closedAt || cycle.closedAt >= purchase.createdAt;

    return closedAfterPurchase && key >= firstKey && key <= lastKey;
  });

  return (
    !countedInClosedCycle &&
    !listOpenInstallments(purchase).some((installment) =>
      isStatementPaid(state, purchase.cardId, installment.statementKey),
    )
  );
}

/** @deprecated use `canModifyCardPurchase`. */
export const canDeleteCardPurchase = canModifyCardPurchase;

function assertModifiable(state: LocalState, purchase: CardPurchase) {
  if (!canModifyCardPurchase(state, purchase)) {
    throw new DomainError(
      'Esta compra já pesou em um ciclo fechado ou em uma fatura paga e não pode mais ser alterada.',
    );
  }
}

/**
 * BR-FIN-029: edita uma compra feita no app. A fatura e o ciclo são recalculados pela nova data
 * (dentro do ciclo ativo). Compras da situação inicial só mudam descrição e categoria.
 */
export function updateCardPurchase(
  state: LocalState,
  purchaseId: string,
  input: CardPurchaseUpdate,
  ctx: UseCaseContext,
): LocalState {
  const current = findLivePurchase(state, purchaseId);
  assertModifiable(state, current);

  const description = requireDescription(input.description);
  const category = normalizeCategory(input.category);
  const valuesChanged =
    input.totalAmount !== current.totalAmount ||
    input.installments !== current.installments ||
    input.date !== current.purchaseDate;

  if (!valuesChanged) {
    return replacePurchase(state, { ...current, description, category }, ctx);
  }

  if (current.origin === 'existing') {
    throw new DomainError(
      'Em compras anteriores ao app, só a descrição e a categoria podem mudar.',
    );
  }

  if (findLinkedFixedPayment(state, current.id)) {
    throw new DomainError(
      'Esta compra veio do pagamento de uma despesa fixa. Desfaça o pagamento para mudar os valores.',
    );
  }

  const rebuilt = buildCardPurchase(
    { ...state, cardPurchases: state.cardPurchases.filter((record) => record.id !== current.id) },
    { ...input, cardId: current.cardId },
    ctx,
  );

  return replacePurchase(state, { ...rebuilt, id: current.id, createdAt: current.createdAt }, ctx);
}

function replacePurchase(
  state: LocalState,
  next: CardPurchaseRecord,
  ctx: UseCaseContext,
): LocalState {
  return recalculateActiveCycleBalance(
    {
      ...state,
      cardPurchases: state.cardPurchases.map((record) =>
        record.id === next.id ? touch(next, ctx.now) : record,
      ),
    },
    ctx,
  );
}

/** BR-FIN-029: exclui (ou estorna) a compra inteira. */
export function deleteCardPurchase(
  state: LocalState,
  purchaseId: string,
  ctx: UseCaseContext,
): LocalState {
  const purchase = findLivePurchase(state, purchaseId);
  assertModifiable(state, purchase);

  // BR-FIN-030: a compra de uma fixa paga no crédito leva junto o pagamento; a fixa volta a ficar
  // pendente (reservada), para o compromisso nunca sumir do orçamento.
  const linked = findLinkedFixedPayment(state, purchase.id);

  if (linked && linked.cycleId !== selectActiveCycle(state)?.id) {
    throw new DomainError(
      'Esta compra pagou uma despesa fixa de um ciclo encerrado e não pode ser excluída.',
    );
  }

  const deletedAt = ctx.now.toISOString();
  const withoutPayment = linked
    ? {
        ...state,
        fixedPayments: state.fixedPayments.map((payment) =>
          payment.id === linked.id ? touch({ ...payment, deletedAt }, ctx.now) : payment,
        ),
      }
    : state;

  return replacePurchase(withoutPayment, { ...purchase, deletedAt }, ctx);
}

// ---------------------------------------------------------------------------
// Faturas (BR-FIN-026)
// ---------------------------------------------------------------------------

function findPayableStatement(state: LocalState, cardId: string, statementKey: string, now: Date) {
  const card = findLiveCard(state, cardId);
  const statement = selectCardStatements(state, card.id, now).find(
    (item) => item.key === statementKey,
  );

  if (!statement || statement.amount <= 0) {
    throw new DomainError('Fatura não encontrada.');
  }

  if (statement.status === 'open') {
    throw new DomainError('A fatura ainda está aberta. Ela pode ser paga depois do fechamento.');
  }

  return { card, statement };
}

function addStatementEntry(
  state: LocalState,
  entry: Pick<
    StatementPaymentRecord,
    'cardId' | 'statementKey' | 'statementAmount' | 'paidAmount' | 'charges'
  >,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(
    state,
    'Nenhum ciclo ativo para registrar o pagamento da fatura.',
  );
  const record: StatementPaymentRecord = {
    id: ctx.newId('statement-payment'),
    ...entry,
    cycleId: cycle.id,
    paidAt: toISODate(ctx.now),
    updatedAt: ctx.now.toISOString(),
    deletedAt: null,
    dirty: true,
  };

  return recalculateActiveCycleBalance(
    { ...state, statementPayments: [...state.statementPayments, record] },
    ctx,
  );
}

/**
 * BR-FIN-026/033: registra um pagamento da fatura (depois do fechamento). O principal já estava
 * reservado no ciclo do vencimento, então pagar não desconta de novo: só libera o limite do que
 * amortizou. Pagamento menor que o restante é parcial (o resto segue devido e é transportado ao
 * fechar o ciclo, BR-FIN-034); maior que o restante reconhece a diferença como encargos, que pesam
 * no ciclo ativo. Depois do vencimento o valor pago precisa ser informado.
 */
export function payStatement(
  state: LocalState,
  input: PayStatementInput,
  ctx: UseCaseContext,
): LocalState {
  requireActiveCycle(state, 'Nenhum ciclo ativo para registrar o pagamento da fatura.');
  const { card, statement } = findPayableStatement(
    state,
    input.cardId,
    input.statementKey,
    ctx.now,
  );

  if (statement.status === 'paid') {
    throw new DomainError('Esta fatura já foi paga.');
  }

  const overdue = isAfter(startOfDay(ctx.now), startOfDay(parseISO(statement.dueDate)));

  if (input.paidAmount === undefined && overdue) {
    throw new DomainError('A fatura venceu. Informe o valor pago, com juros se houver.');
  }

  const paidAmount = input.paidAmount ?? statement.remaining;

  if (!Number.isInteger(paidAmount) || paidAmount <= 0) {
    throw new DomainError('Informe um valor pago maior que zero.');
  }

  return addStatementEntry(
    state,
    {
      cardId: card.id,
      statementKey: statement.key,
      statementAmount: statement.amount,
      paidAmount,
      charges: Math.max(0, paidAmount - statement.remaining),
    },
    ctx,
  );
}

/**
 * BR-FIN-033: registra juros/multa informados pelo banco numa fatura já fechada. Aumentam o que
 * falta pagar e pesam no orçamento do ciclo ativo (o ciclo em que foram reconhecidos).
 */
export function addStatementCharges(
  state: LocalState,
  input: StatementChargesInput,
  ctx: UseCaseContext,
): LocalState {
  requireActiveCycle(state, 'Nenhum ciclo ativo para registrar encargos da fatura.');
  const { card, statement } = findPayableStatement(
    state,
    input.cardId,
    input.statementKey,
    ctx.now,
  );

  assertPositiveCents(input.amount, 'Informe o valor dos juros ou da multa.');

  return addStatementEntry(
    state,
    {
      cardId: card.id,
      statementKey: statement.key,
      statementAmount: statement.amount,
      paidAmount: 0,
      charges: input.amount,
    },
    ctx,
  );
}

/**
 * Desfaz um lançamento de fatura (pagamento ou encargo) feito no ciclo ativo: o limite volta a ficar
 * comprometido pelo que ele havia amortizado e os encargos saem do orçamento.
 */
export function undoStatementPayment(
  state: LocalState,
  paymentId: string,
  ctx: UseCaseContext,
): LocalState {
  const cycle = requireActiveCycle(state, 'Nenhum ciclo ativo para desfazer o pagamento.');
  const payment = state.statementPayments.find(
    (record) => record.id === paymentId && isLive(record),
  );

  if (!payment || payment.cycleId !== cycle.id) {
    throw new DomainError('Só é possível desfazer lançamentos de fatura feitos no ciclo ativo.');
  }

  return recalculateActiveCycleBalance(
    {
      ...state,
      statementPayments: state.statementPayments.map((record) =>
        record.id === payment.id
          ? touch({ ...record, deletedAt: ctx.now.toISOString() }, ctx.now)
          : record,
      ),
    },
    ctx,
  );
}

/** Data a partir da qual a fatura pode ser paga (dia seguinte ao fechamento). */
export function statementPayableFrom(key: string, closingDay: number): string {
  return toISODate(addDays(statementClosingDate(key, closingDay), 1));
}

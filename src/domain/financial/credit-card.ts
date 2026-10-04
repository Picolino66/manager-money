import { addMonths, format, isAfter, parseISO, setDate, startOfDay, startOfMonth } from 'date-fns';

import { ExpenseCategory, MoneyCents } from './financial.types';

/** Cartão de crédito. Fechamento e vencimento ficam entre 1 e 28 (evita meses curtos). */
export type CreditCard = {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
  /** Limite total (BR-FIN-026). `null` = não informado (cartões antigos). */
  creditLimit: MoneyCents | null;
  /** Inativo some do formulário de compra, mas as parcelas continuam valendo (BR-FIN-028). */
  active: boolean;
};

/**
 * Compra no crédito. `totalAmount` já inclui juros. `firstStatementKey` e `firstCycleKey` guardam
 * a fatura e o ciclo da 1ª parcela no momento da compra: mudar fechamento, vencimento ou dia de
 * pagamento não reescreve compras já registradas (BR-FIN-028).
 */
export type CardPurchase = {
  id: string;
  cardId: string;
  description: string;
  category: ExpenseCategory;
  totalAmount: MoneyCents;
  installments: number;
  /** Data da compra (yyyy-MM-dd). */
  purchaseDate: string;
  /** Fatura da 1ª parcela: `yyyy-MM` do mês de fechamento (BR-FIN-025). */
  firstStatementKey: string;
  /** Ciclo da 1ª parcela, `yyyy-MM` do início do ciclo (BR-FIN-025). */
  firstCycleKey: string;
  /**
   * Parcelas já pagas fora do app antes do cadastro (situação inicial, BR-FIN-027). Não pesam no
   * orçamento nem no limite.
   */
  settledInstallments: number;
  /** `existing` = cadastrada na situação inicial (BR-FIN-027); ausente = compra feita no app. */
  origin?: 'existing';
  createdAt: string;
};

export type CardInstallment = {
  purchase: CardPurchase;
  /** 1-based. */
  number: number;
  amount: MoneyCents;
  statementKey: string;
  cycleKey: string;
};

/** Pagamento de uma fatura (BR-FIN-026). Libera o limite; juros por atraso pesam no ciclo ativo. */
export type StatementPayment = {
  id: string;
  cardId: string;
  /** Fatura paga: `yyyy-MM` do mês de fechamento. */
  statementKey: string;
  /** Ciclo ativo no momento do pagamento (recebe os juros). */
  cycleId: string;
  /** Valor da fatura no momento do pagamento. */
  statementAmount: MoneyCents;
  /** Valor efetivamente pago (≥ valor da fatura). */
  paidAmount: MoneyCents;
  /** Data do pagamento (yyyy-MM-dd). */
  paidAt: string;
};

export type StatementStatus = 'open' | 'closed' | 'overdue' | 'paid';

/** Fatura derivada das compras: nunca é gravada, só o pagamento é (BR-FIN-025). */
export type CardStatement = {
  cardId: string;
  key: string;
  closingDate: string;
  dueDate: string;
  amount: MoneyCents;
  installments: CardInstallment[];
  status: StatementStatus;
  payment: StatementPayment | null;
};

export type CardLimitUsage = {
  creditLimit: MoneyCents | null;
  /** Parcelas ainda não pagas (faturas não pagas), inclusive futuras. */
  committed: MoneyCents;
  /** `null` quando o cartão não tem limite informado. Pode ser negativo (estouro). */
  available: MoneyCents | null;
};

export const MIN_CARD_DAY = 1;
export const MAX_CARD_DAY = 28;
export const MAX_CARD_INSTALLMENTS = 48;

const KEY_PATTERN = /^\d{4}-\d{2}$/;

export function isMonthKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

/** Divide o total em parcelas inteiras; os centavos que sobram vão para as primeiras. */
export function splitInstallments(total: MoneyCents, installments: number): MoneyCents[] {
  const base = Math.floor(total / installments);
  const remainder = total - base * installments;

  return Array.from({ length: installments }, (_, index) => base + (index < remainder ? 1 : 0));
}

/** Chave do ciclo = mês (`yyyy-MM`) da data de início dele. */
export function cycleKeyFromStartDate(startDate: string): string {
  return startDate.slice(0, 7);
}

/** Chave do ciclo padrão que contém a data, dado o dia de pagamento. */
export function cycleKeyFromDate(date: Date, payday: number): string {
  const monthStart = startOfMonth(date);

  return format(date.getDate() >= payday ? monthStart : addMonths(monthStart, -1), 'yyyy-MM');
}

export function addCycleKeys(key: string, months: number): string {
  return format(addMonths(parseISO(`${key}-01`), months), 'yyyy-MM');
}

/** Quantos meses `toKey` está à frente de `fromKey` (negativo se estiver atrás). */
export function cycleKeyOffset(fromKey: string, toKey: string): number {
  const from = parseISO(`${fromKey}-01`);
  const to = parseISO(`${toKey}-01`);

  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

const maxKey = (left: string, right: string) => (left > right ? left : right);

// ---------------------------------------------------------------------------
// Fatura (BR-FIN-025)
// ---------------------------------------------------------------------------

/** Fechamento da fatura que recebe a compra: o próximo fechamento em ou depois da data. */
export function calculateInvoiceClosingDate(purchaseDate: Date, closingDay: number): Date {
  const sameMonth = setDate(startOfMonth(purchaseDate), closingDay);

  return purchaseDate.getDate() <= closingDay ? sameMonth : addMonths(sameMonth, 1);
}

/** Fatura (`yyyy-MM` do fechamento) que recebe uma compra feita na data. */
export function statementKeyForDate(purchaseDate: Date, closingDay: number): string {
  return format(calculateInvoiceClosingDate(purchaseDate, closingDay), 'yyyy-MM');
}

export function statementClosingDate(key: string, closingDay: number): Date {
  return setDate(parseISO(`${key}-01`), closingDay);
}

/** Vencimento: o próximo `dueDay` depois do fechamento (mesmo mês se vier depois; senão, o seguinte). */
export function statementDueDate(
  key: string,
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
): Date {
  const closing = statementClosingDate(key, card.closingDay);
  const sameMonth = setDate(startOfMonth(closing), card.dueDay);

  return card.dueDay > card.closingDay ? sameMonth : addMonths(sameMonth, 1);
}

/** BR-FIN-025: a fatura pertence ao ciclo financeiro que contém o seu vencimento. */
export function statementCycleKey(
  key: string,
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  payday: number,
): string {
  return cycleKeyFromDate(statementDueDate(key, card), payday);
}

/**
 * BR-FIN-025: ciclo da 1ª parcela de uma compra feita no ciclo ativo = ciclo do vencimento da
 * fatura; nunca antes do ciclo ativo (o ciclo antecipado pode começar antes do dia de pagamento).
 */
export function calculateFirstCycleKey(
  purchaseDate: Date,
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  payday: number,
  activeCycleKey: string,
): string {
  return maxKey(
    statementCycleKey(statementKeyForDate(purchaseDate, card.closingDay), card, payday),
    activeCycleKey,
  );
}

// ---------------------------------------------------------------------------
// Parcelas
// ---------------------------------------------------------------------------

/** Todas as parcelas da compra, com fatura e ciclo de cada uma. */
export function listInstallments(purchase: CardPurchase): CardInstallment[] {
  return splitInstallments(purchase.totalAmount, purchase.installments).map((amount, index) => ({
    purchase,
    number: index + 1,
    amount,
    statementKey: addCycleKeys(purchase.firstStatementKey, index),
    cycleKey: addCycleKeys(purchase.firstCycleKey, index),
  }));
}

/** Parcelas que ainda não foram pagas fora do app (BR-FIN-027). */
export function listOpenInstallments(purchase: CardPurchase): CardInstallment[] {
  return listInstallments(purchase).slice(purchase.settledInstallments);
}

/** Parcela da compra que pesa no ciclo, se houver (parcelas quitadas antes do cadastro não pesam). */
export function calculateInstallmentForCycle(
  purchase: CardPurchase,
  cycleKey: string,
): CardInstallment | null {
  const index = cycleKeyOffset(purchase.firstCycleKey, cycleKey);

  if (index < purchase.settledInstallments || index >= purchase.installments) {
    return null;
  }

  return listInstallments(purchase)[index] ?? null;
}

export function calculateCardInstallmentsForCycle(
  purchases: CardPurchase[],
  cycleKey: string,
): CardInstallment[] {
  return purchases.flatMap((purchase) => {
    const installment = calculateInstallmentForCycle(purchase, cycleKey);

    return installment ? [installment] : [];
  });
}

export function calculateCardChargesForCycle(
  purchases: CardPurchase[],
  cycleKey: string,
): MoneyCents {
  return calculateCardInstallmentsForCycle(purchases, cycleKey).reduce(
    (total, installment) => total + installment.amount,
    0,
  );
}

/** Ciclo (chave) da primeira parcela que pesa no orçamento. */
export function firstCountedCycleKey(purchase: CardPurchase): string {
  return addCycleKeys(purchase.firstCycleKey, purchase.settledInstallments);
}

/** Ciclo (chave) da última parcela da compra. */
export function lastInstallmentCycleKey(purchase: CardPurchase): string {
  return addCycleKeys(purchase.firstCycleKey, purchase.installments - 1);
}

// ---------------------------------------------------------------------------
// Faturas e limite (BR-FIN-025, BR-FIN-026)
// ---------------------------------------------------------------------------

function statementStatus(
  key: string,
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  payment: StatementPayment | null,
  today: Date,
): StatementStatus {
  if (payment) {
    return 'paid';
  }

  const day = startOfDay(today);

  if (!isAfter(day, statementClosingDate(key, card.closingDay))) {
    return 'open';
  }

  return isAfter(day, statementDueDate(key, card)) ? 'overdue' : 'closed';
}

/** Faturas do cartão com parcelas em aberto, em ordem de fechamento. */
export function buildCardStatements(
  card: CreditCard,
  purchases: CardPurchase[],
  payments: StatementPayment[],
  today: Date,
): CardStatement[] {
  const byKey = new Map<string, CardInstallment[]>();

  for (const purchase of purchases) {
    if (purchase.cardId !== card.id) continue;

    for (const installment of listOpenInstallments(purchase)) {
      byKey.set(installment.statementKey, [
        ...(byKey.get(installment.statementKey) ?? []),
        installment,
      ]);
    }
  }

  return [...byKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, installments]) => {
      const payment =
        payments.find((item) => item.cardId === card.id && item.statementKey === key) ?? null;

      return {
        cardId: card.id,
        key,
        closingDate: format(statementClosingDate(key, card.closingDay), 'yyyy-MM-dd'),
        dueDate: format(statementDueDate(key, card), 'yyyy-MM-dd'),
        amount: installments.reduce((total, installment) => total + installment.amount, 0),
        installments,
        status: statementStatus(key, card, payment, today),
        payment,
      };
    });
}

/** Fatura aberta hoje (a que recebe compras feitas hoje). */
export function currentStatementKey(card: Pick<CreditCard, 'closingDay'>, today: Date): string {
  return statementKeyForDate(startOfDay(today), card.closingDay);
}

/**
 * BR-FIN-026: o limite comprometido é a soma das parcelas em faturas ainda não pagas (inclusive
 * futuras). A compra compromete o valor total na hora; a fatura paga libera o limite.
 */
export function calculateCardLimitUsage(
  card: CreditCard,
  purchases: CardPurchase[],
  payments: StatementPayment[],
): CardLimitUsage {
  const paid = new Set(
    payments.filter((payment) => payment.cardId === card.id).map((payment) => payment.statementKey),
  );
  const committed = purchases
    .filter((purchase) => purchase.cardId === card.id)
    .flatMap(listOpenInstallments)
    .filter((installment) => !paid.has(installment.statementKey))
    .reduce((total, installment) => total + installment.amount, 0);

  return {
    creditLimit: card.creditLimit,
    committed,
    available: card.creditLimit === null ? null : card.creditLimit - committed,
  };
}

/** Id do pagamento de uma fatura: um por cartão e fatura, igual em todos os aparelhos (BR-FIN-026). */
export function statementPaymentId(cardId: string, statementKey: string): string {
  return `statement-${cardId}-${statementKey}`;
}

/** Juros por atraso de uma fatura paga (BR-FIN-026). */
export function calculateStatementInterest(
  payment: Pick<StatementPayment, 'paidAmount' | 'statementAmount'>,
): MoneyCents {
  return Math.max(0, payment.paidAmount - payment.statementAmount);
}

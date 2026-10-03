import { addMonths, format, parseISO, setDate, startOfMonth } from 'date-fns';

import { ExpenseCategory, MoneyCents } from './financial.types';

/** Cartão de crédito. Fechamento e vencimento ficam entre 1 e 28 (evita meses curtos). */
export type CreditCard = {
  id: string;
  name: string;
  closingDay: number;
  dueDay: number;
};

/**
 * Compra no crédito. `totalAmount` já inclui juros. `firstCycleKey` guarda o ciclo da 1ª parcela
 * no momento da compra, para que mudar o fechamento do cartão não reescreva o passado.
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
  /** Ciclo da 1ª parcela, `yyyy-MM` do início do ciclo (BR-FIN-019). */
  firstCycleKey: string;
  createdAt: string;
};

export type CardInstallment = {
  purchase: CardPurchase;
  /** 1-based. */
  number: number;
  amount: MoneyCents;
};

export const MIN_CARD_DAY = 1;
export const MAX_CARD_DAY = 28;
export const MAX_CARD_INSTALLMENTS = 48;

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

/** Fechamento da fatura que recebe a compra: o próximo fechamento em ou depois da data. */
export function calculateInvoiceClosingDate(purchaseDate: Date, closingDay: number): Date {
  const sameMonth = setDate(startOfMonth(purchaseDate), closingDay);

  return purchaseDate.getDate() <= closingDay ? sameMonth : addMonths(sameMonth, 1);
}

/**
 * BR-FIN-019: a compra cai no ciclo que contém o fechamento da sua fatura; nunca antes do ciclo
 * ativo em que foi feita.
 */
export function calculateFirstCycleKey(
  purchaseDate: Date,
  closingDay: number,
  payday: number,
  activeCycleKey: string,
): string {
  const closingKey = cycleKeyFromDate(calculateInvoiceClosingDate(purchaseDate, closingDay), payday);

  return closingKey > activeCycleKey ? closingKey : activeCycleKey;
}

/** Quantos ciclos `toKey` está à frente de `fromKey` (negativo se estiver atrás). */
export function cycleKeyOffset(fromKey: string, toKey: string): number {
  const from = parseISO(`${fromKey}-01`);
  const to = parseISO(`${toKey}-01`);

  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Parcela da compra que cai no ciclo, se houver. */
export function calculateInstallmentForCycle(
  purchase: CardPurchase,
  cycleKey: string,
): CardInstallment | null {
  const index = cycleKeyOffset(purchase.firstCycleKey, cycleKey);

  if (index < 0 || index >= purchase.installments) {
    return null;
  }

  return {
    purchase,
    number: index + 1,
    amount: splitInstallments(purchase.totalAmount, purchase.installments)[index] ?? 0,
  };
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

/** Ciclo (chave) da última parcela da compra. */
export function lastInstallmentCycleKey(purchase: CardPurchase): string {
  return addCycleKeys(purchase.firstCycleKey, purchase.installments - 1);
}

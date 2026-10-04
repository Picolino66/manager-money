import {
  CardStatement,
  StatementPayment,
  StatementStatus,
} from '@manager-money/core/domain/financial/credit-card';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

/** Texto de em qual ciclo cai a 1ª parcela de uma compra no crédito (BR-FIN-019). */
export function describeFirstInstallment(cyclesAhead: number): string {
  if (cyclesAhead <= 0) return 'a 1ª parcela entra neste ciclo';
  if (cyclesAhead === 1) return 'a 1ª parcela entra no próximo ciclo';

  return `a 1ª parcela entra daqui a ${cyclesAhead} ciclos`;
}

/** `yyyy-MM` → `MM/AAAA` (fatura ou ciclo). */
export function formatMonthKey(key: string): string {
  return `${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

export const STATEMENT_STATUS_LABEL: Record<StatementStatus, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  overdue: 'Vencida',
  partial: 'Parcial',
  paid: 'Paga',
};

/** BR-FIN-025: a fatura pesa no ciclo que contém o vencimento. */
export function describeCycleWeight(cycleKeys: string[]): string {
  const unique = [...new Set(cycleKeys)].sort();

  if (unique.length === 0) return '';

  return `pesa no ciclo de ${unique.map(formatMonthKey).join(' e ')}`;
}

/** Prévia da agenda de parcelas da situação inicial (BR-FIN-027). */
export function describeInstallmentSchedule(
  count: number,
  amountLabel: string,
  firstKey: string,
  lastKey: string,
): string {
  if (count <= 1) return `1 parcela de ${amountLabel} na fatura de ${formatMonthKey(firstKey)}`;

  return `${count} parcelas de ${amountLabel} de ${formatMonthKey(firstKey)} a ${formatMonthKey(lastKey)}`;
}

/** BR-FIN-029: por que a compra não pode mais ser alterada. */
export const PURCHASE_LOCKED_REASON =
  'Não pode mais ser alterada: já pesou em um ciclo fechado ou em uma fatura paga.';

/** Distinção obrigatória: limite do cartão não é dinheiro para gastar. */
export const CARD_LIMIT_DISCLAIMER =
  'O limite do cartão não é dinheiro para gastar. O que você pode gastar está em "Hoje".';

/** Soma nominal das parcelas que já estão dentro do total informado da fatura (BR-FIN-032). */
export function knownItemsTotal(statement: Pick<CardStatement, 'installments'>): MoneyCents {
  return statement.installments
    .filter((installment) => installment.includedInBalance)
    .reduce((total, installment) => total + installment.nominalAmount, 0);
}

/**
 * Composição do total informado (BR-FIN-032). Sem itens conhecidos, mostra só o total: nunca
 * inventa composição.
 */
export function describeStatementComposition(
  knownTotal: MoneyCents,
  knownItems: MoneyCents,
): string {
  if (knownItems <= 0) return `Total informado ${formatCurrency(knownTotal)}`;

  return (
    `Total informado ${formatCurrency(knownTotal)} · itens conhecidos ${formatCurrency(knownItems)}` +
    ` · não detalhado ${formatCurrency(Math.max(0, knownTotal - knownItems))}`
  );
}

/** Lançamento de fatura em uma linha (BR-FIN-033): pagamento, encargos e data. */
export function describeStatementEntry(
  payment: Pick<StatementPayment, 'paidAmount' | 'charges'>,
  dayMonth: string,
): string {
  const parts: string[] = [];

  if (payment.paidAmount > 0) parts.push(`Pagamento ${formatCurrency(payment.paidAmount)}`);
  if (payment.charges > 0) {
    parts.push(
      `${payment.paidAmount > 0 ? 'encargos' : 'Juros/multa'} ${formatCurrency(payment.charges)}`,
    );
  }

  return [...parts, dayMonth].join(' · ');
}

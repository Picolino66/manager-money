import { StatementStatus } from '../domain/financial/credit-card';

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

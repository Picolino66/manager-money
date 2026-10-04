import { isAfter, startOfDay } from 'date-fns';

import {
  addCycleKeys,
  CreditCard,
  currentStatementKey,
  cycleKeyFromStartDate,
  MAX_CARD_INSTALLMENTS,
  statementCycleKey,
  statementDueDate,
} from '../domain/financial/credit-card';
import { MoneyCents } from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';
import { selectCardStatements } from './selectors';
import { CardPurchaseRecord, isLive, LocalState } from './state';

/**
 * Situação inicial do cartão (BR-FIN-027/032), compartilhada pelo app e pelo client web: quais faturas
 * aceitam cadastro, o total já informado, em quais ciclos a agenda pesa e a validade das parcelas.
 */
export type StatementChoice = {
  /** `yyyy-MM` do fechamento. */
  key: string;
  status: 'open' | 'closed';
  /** yyyy-MM-dd. */
  dueDate: string;
};

/**
 * Faturas ainda não vencidas — a fechada aguardando vencimento (se houver) e a aberta —, exceto as com
 * qualquer lançamento (pago ou parcial), que não recebem compras anteriores.
 */
export function selectStatementChoices(
  state: LocalState,
  card: CreditCard,
  today: Date,
): StatementChoice[] {
  const day = startOfDay(today);
  const openKey = currentStatementKey(card, day);
  const withPayments = new Set(
    selectCardStatements(state, card.id, day)
      .filter((statement) => statement.payments.length > 0)
      .map((statement) => statement.key),
  );

  return [addCycleKeys(openKey, -1), openKey]
    .filter((key) => !isAfter(day, statementDueDate(key, card)) && !withPayments.has(key))
    .map((key) => ({
      key,
      status: key === openKey ? ('open' as const) : ('closed' as const),
      dueDate: toISODate(statementDueDate(key, card)),
    }));
}

/** Fatura escolhida; sem escolha válida, a primeira disponível (ou a aberta se nenhuma). */
export function resolveChosenStatement(
  choices: StatementChoice[],
  chosenKey: string,
  card: CreditCard,
  today: Date,
): string {
  return (
    choices.find((choice) => choice.key === chosenKey)?.key ??
    choices[0]?.key ??
    currentStatementKey(card, startOfDay(today))
  );
}

/** BR-FIN-032: total da fatura já informado (um por cartão + fatura). */
export function findStatementBalance(
  state: LocalState,
  cardId: string,
  statementKey: string,
): CardPurchaseRecord | undefined {
  return state.cardPurchases.find(
    (purchase) =>
      isLive(purchase) &&
      purchase.cardId === cardId &&
      purchase.kind === 'statement-balance' &&
      purchase.firstStatementKey === statementKey,
  );
}

export function isValidInstallmentCount(total: number, remaining: number): boolean {
  return total >= 1 && total <= MAX_CARD_INSTALLMENTS && remaining >= 1 && remaining <= total;
}

/** Ciclos em que a agenda pesa: do 1º (nunca antes do ciclo ativo) até o da última parcela restante. */
export function existingDebtCycleRange(
  card: CreditCard,
  payday: number,
  activeCycleStartDate: string | null,
  statementKey: string,
  remaining: number,
): { firstCycleKey: string; lastCycleKey: string } {
  const activeCycleKey = activeCycleStartDate ? cycleKeyFromStartDate(activeCycleStartDate) : null;
  const dueCycleKey = statementCycleKey(statementKey, card, payday);
  const firstCycleKey =
    activeCycleKey && activeCycleKey > dueCycleKey ? activeCycleKey : dueCycleKey;

  return { firstCycleKey, lastCycleKey: addCycleKeys(firstCycleKey, remaining - 1) };
}

/** Quanto do limite do cartão a agenda compromete (a parcela já no total informado não soma). */
export function existingDebtCommitted(
  amount: MoneyCents,
  remaining: number,
  includedInBalance: boolean,
): MoneyCents {
  return amount * (includedInBalance ? remaining - 1 : remaining);
}

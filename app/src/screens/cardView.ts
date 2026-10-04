import { format, isAfter, parseISO, startOfDay } from 'date-fns';

import {
  addCycleKeys,
  CardStatement,
  CreditCard,
  currentStatementKey,
  statementClosingDate,
  statementCycleKey,
  statementDueDate,
  StatementStatus,
} from '@manager-money/core/domain/financial/credit-card';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { isLive, LocalState } from '@manager-money/core/application/state';

/** Faturas do cartão organizadas para a tela (BR-FIN-025/026). */
export type CardStatementsView = {
  /**
   * Fatura que pede atenção agora: a fechada/vencida/parcial mais antiga não quitada; senão, a
   * aberta.
   */
  current: CardStatement;
  next: CardStatement;
  /** Demais faturas não pagas (outras fechadas/vencidas e as futuras), em ordem. */
  future: CardStatement[];
  /** Outras faturas quitadas com lançamento no ciclo ativo (ainda podem ser desfeitos). */
  paidInActiveCycle: CardStatement[];
};

function statusFor(key: string, card: CreditCard, today: Date): StatementStatus {
  const day = startOfDay(today);

  if (!isAfter(day, statementClosingDate(key, card.closingDay))) return 'open';

  return isAfter(day, statementDueDate(key, card)) ? 'overdue' : 'closed';
}

function findOrEmpty(
  statements: CardStatement[],
  key: string,
  card: CreditCard,
  today: Date,
): CardStatement {
  return (
    statements.find((statement) => statement.key === key) ?? {
      cardId: card.id,
      key,
      closingDate: format(statementClosingDate(key, card.closingDay), 'yyyy-MM-dd'),
      dueDate: format(statementDueDate(key, card), 'yyyy-MM-dd'),
      amount: 0,
      installments: [],
      knownTotal: null,
      charges: 0,
      paid: 0,
      remaining: 0,
      status: statusFor(key, card, today),
      payments: [],
    }
  );
}

export function buildCardStatementsView(
  card: CreditCard,
  statements: CardStatement[],
  today: Date,
  activeCycleId: string | null,
): CardStatementsView {
  const pending = statements.find(
    (statement) =>
      statement.status === 'closed' ||
      statement.status === 'overdue' ||
      statement.status === 'partial',
  );
  const current = pending ?? findOrEmpty(statements, currentStatementKey(card, today), card, today);
  const next = findOrEmpty(statements, addCycleKeys(current.key, 1), card, today);

  return {
    current,
    next,
    future: statements.filter(
      (statement) =>
        statement.key !== current.key && statement.key !== next.key && statement.status !== 'paid',
    ),
    paidInActiveCycle: statements.filter(
      (statement) =>
        statement.key !== current.key &&
        statement.key !== next.key &&
        statement.status === 'paid' &&
        activeCycleId !== null &&
        statement.payments.some((payment) => payment.cycleId === activeCycleId),
    ),
  };
}

/**
 * Ciclos em que a fatura pesa (BR-FIN-025). Usa as parcelas (chaves congeladas); sem parcelas,
 * estima pelo vencimento, nunca antes do ciclo ativo.
 */
export function statementCycleKeys(
  statement: CardStatement,
  card: CreditCard,
  payday: number | null,
  activeCycleKey: string | null,
): string[] {
  if (statement.installments.length > 0) {
    return [...new Set(statement.installments.map((installment) => installment.cycleKey))].sort();
  }

  if (payday === null) return [];

  const key = statementCycleKey(statement.key, card, payday);

  return [activeCycleKey && activeCycleKey > key ? activeCycleKey : key];
}

/**
 * Quanto as parcelas do cartão pesam em cada ciclo, do ciclo ativo em diante (BR-FIN-025). Usa o
 * valor efetivo da parcela (`amount`): a parcela já incluída no total informado pesa 0 (BR-FIN-032).
 * Pagar a fatura libera o limite, mas não tira o peso do orçamento do ciclo.
 */
export function weightByCycle(
  statements: CardStatement[],
  activeCycleKey: string | null,
): { cycleKey: string; amount: MoneyCents }[] {
  const totals = new Map<string, MoneyCents>();

  for (const statement of statements) {
    for (const installment of statement.installments) {
      if (activeCycleKey !== null && installment.cycleKey < activeCycleKey) continue;

      totals.set(
        installment.cycleKey,
        (totals.get(installment.cycleKey) ?? 0) + installment.amount,
      );
    }
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([cycleKey, amount]) => ({ cycleKey, amount }));
}

export function formatDayMonth(isoDate: string): string {
  return format(parseISO(isoDate), 'dd/MM');
}

/** BR-FIN-028: cartão com compras vigentes não pode ser excluído (só desativado). */
export function hasCardPurchases(doc: LocalState, cardId: string): boolean {
  return doc.cardPurchases.some((purchase) => isLive(purchase) && purchase.cardId === cardId);
}

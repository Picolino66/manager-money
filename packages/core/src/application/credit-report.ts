import { StatementStatus } from '../domain/financial/credit-card';
import { MoneyCents } from '../domain/financial/financial.types';
import { CreditStatementRef, toStatementRef } from './credit-series';
import { selectCardStatements, selectCreditCards } from './selectors';
import { isLive, LocalState } from './state';

/** Fatura no relatório de crédito: período do cartão, ciclo em que pesa e situação. */
export type CreditReportStatement = CreditStatementRef & {
  /** Ciclo em que a fatura vence (e pesa, BR-FIN-025); nulo se esse ciclo não existe. */
  cycleId: string | null;
  /** Principal: soma das parcelas. */
  amount: MoneyCents;
  charges: MoneyCents;
  paid: MoneyCents;
  remaining: MoneyCents;
  status: StatementStatus;
};

/** Faturas somadas por mês de fechamento (todos os cartões filtrados). */
export type CreditReportMonth = {
  key: string;
  amount: MoneyCents;
  charges: MoneyCents;
  paid: MoneyCents;
};

export type CreditReport = {
  /** Da que vence por último para a mais antiga. */
  statements: CreditReportStatement[];
  /** Em ordem cronológica, para o gráfico. */
  months: CreditReportMonth[];
  totals: { amount: MoneyCents; charges: MoneyCents; paid: MoneyCents; remaining: MoneyCents };
};

export type CreditReportFilter = {
  /** `null` = todos os cartões (inclusive inativos, que ainda têm parcelas). */
  cardId: string | null;
  /** Ano do fechamento (`yyyy`); `null` = todos. */
  year: string | null;
};

function allStatements(state: LocalState, today: Date): CreditReportStatement[] {
  const cycles = state.cycles.filter(isLive);
  const cycleOf = (date: string) =>
    cycles.find((cycle) => cycle.startDate <= date && date <= cycle.endDate)?.id ?? null;

  return selectCreditCards(state).flatMap((card) =>
    selectCardStatements(state, card.id, today).map((statement) => {
      const ref = toStatementRef(card, statement.key);

      return {
        ...ref,
        cycleId: cycleOf(ref.dueDate),
        amount: statement.amount,
        charges: statement.charges,
        paid: statement.paid,
        remaining: statement.remaining,
        status: statement.status,
      };
    }),
  );
}

/** Anos (fechamento) com fatura, do mais recente para o mais antigo. */
export function selectCreditReportYears(state: LocalState, today: Date): string[] {
  return [...new Set(allStatements(state, today).map((item) => item.key.slice(0, 4)))].sort(
    (a, b) => b.localeCompare(a),
  );
}

/**
 * BR-FIN-039: relatório do crédito pelo ciclo do cartão — cada fatura com abertura, fechamento,
 * vencimento e o ciclo em que pesa; e o total por mês de fechamento. Inclui faturas futuras
 * (parcelas já comprometidas) e só as parcelas em aberto no app (BR-FIN-027).
 */
export function selectCreditReport(
  state: LocalState,
  today: Date,
  filter: CreditReportFilter,
): CreditReport {
  const statements = allStatements(state, today)
    .filter(
      (item) =>
        (!filter.cardId || item.cardId === filter.cardId) &&
        (!filter.year || item.key.startsWith(filter.year)),
    )
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate) || a.cardName.localeCompare(b.cardName));
  const byMonth = new Map<string, CreditReportMonth>();

  for (const item of statements) {
    const month = byMonth.get(item.key) ?? { key: item.key, amount: 0, charges: 0, paid: 0 };

    byMonth.set(item.key, {
      ...month,
      amount: month.amount + item.amount,
      charges: month.charges + item.charges,
      paid: month.paid + item.paid,
    });
  }

  const sum = (pick: (item: CreditReportStatement) => MoneyCents) =>
    statements.reduce((total, item) => total + pick(item), 0);

  return {
    statements,
    months: [...byMonth.values()].sort((a, b) => a.key.localeCompare(b.key)),
    totals: {
      amount: sum((item) => item.amount),
      charges: sum((item) => item.charges),
      paid: sum((item) => item.paid),
      remaining: sum((item) => item.remaining),
    },
  };
}

import {
  CreditReport,
  CreditReportFilter,
  CreditReportStatement,
  selectCreditReport,
  selectCreditReportYears,
} from '@manager-money/core/application/credit-report';
import { selectCreditCards } from '@manager-money/core/application/selectors';
import { isLive, LocalState } from '@manager-money/core/application/state';
import { formatCycleLabel } from '@manager-money/core/utils/date';

import { FUTURE_CYCLE_LABEL } from './expenses';

export type CreditReportRow = CreditReportStatement & {
  /** Ciclo do salário em que a fatura vence (e pesa); "Ciclo a abrir" quando ainda não existe. */
  cycleLabel: string;
};

export type CreditReportView = Omit<CreditReport, 'statements'> & {
  statements: CreditReportRow[];
  years: string[];
  cards: { id: string; name: string }[];
};

/** Relatório de crédito pelo ciclo do cartão (BR-FIN-039), com o rótulo do ciclo em que pesa. */
export function buildCreditReport(
  state: LocalState,
  now: Date,
  filter: CreditReportFilter,
): CreditReportView {
  const cycles = state.cycles.filter(isLive);
  const lastEnd = cycles.reduce((max, cycle) => (cycle.endDate > max ? cycle.endDate : max), '');
  const report = selectCreditReport(state, now, filter);

  return {
    ...report,
    statements: report.statements.map((statement) => {
      const cycle = cycles.find((item) => item.id === statement.cycleId);

      return {
        ...statement,
        cycleLabel: cycle
          ? formatCycleLabel(cycle.startDate, cycle.endDate)
          : statement.dueDate > lastEnd
            ? FUTURE_CYCLE_LABEL
            : '—',
      };
    }),
    years: selectCreditReportYears(state, now),
    cards: selectCreditCards(state).map((card) => ({ id: card.id, name: card.name })),
  };
}

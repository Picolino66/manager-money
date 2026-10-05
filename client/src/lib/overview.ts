import { isAfter, parseISO, startOfDay } from 'date-fns';

import {
  selectActiveCreditCards,
  selectActiveMonth,
  selectCardLimitUsage,
  selectConfig,
  selectCreditSnapshot,
  selectUpcomingCommitments,
  CreditSnapshot,
  UpcomingCommitment,
} from '@manager-money/core/application/selectors';
import {
  BalanceDailyPoint,
  CreditDailyPoint,
  CreditPeriod,
  CreditPeriodMode,
  CreditStatementRef,
  listSeriesDates,
  selectBalanceDailySeries,
  selectCreditDailySeries,
  selectCreditPeriod,
} from '@manager-money/core/application/credit-series';
import { CycleBalance, selectCycleBalance } from '@manager-money/core/application/cycle-balance';
import { isLive, LocalState } from '@manager-money/core/application/state';
import { CardLimitUsage } from '@manager-money/core/domain/financial/credit-card';
import { buildDashboardSummary } from '@manager-money/core/domain/financial/financial.calculations';
import { DashboardSummary, MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatShortDate, toISODate } from '@manager-money/core/utils/date';

export type CardLimitView = { id: string; name: string; usage: CardLimitUsage | null };

export type OverviewView =
  | { kind: 'no-config' }
  | { kind: 'no-cycle' }
  | {
      kind: 'active';
      cycleId: string;
      /** Período do ciclo ativo (padrão do gráfico de saldo). */
      cycleStart: string;
      cycleEnd: string;
      /** Ciclo começa depois de hoje (ciclo antecipado): ainda não há dias para mostrar. */
      notStarted: boolean;
      summary: DashboardSummary;
      savingGoal: MoneyCents;
      commitments: UpcomingCommitment[];
      commitmentsTotal: MoneyCents;
      cards: CardLimitView[];
      credit: CreditSnapshot;
      /** Saldo em conta, sem reservados nem meta (BR-FIN-041). */
      balance: CycleBalance;
    };

/**
 * Visão geral do ciclo ativo. Todos os números vêm do núcleo (mesmos cálculos do Hoje do app):
 * `buildDashboardSummary`, `selectUpcomingCommitments` e `selectCardLimitUsage`. O disponível no
 * ciclo já desconta fixas pendentes e faturas reservadas (ADR-017); por isso não há métrica nova
 * de "livre após compromissos": a lista de compromissos explica o que está reservado.
 */
export function buildOverview(state: LocalState, now: Date): OverviewView {
  if (!selectConfig(state)) return { kind: 'no-config' };

  const month = selectActiveMonth(state);
  if (!month) return { kind: 'no-cycle' };

  const commitments = selectUpcomingCommitments(state, now);

  return {
    kind: 'active',
    cycleId: month.id,
    cycleStart: month.startDate,
    cycleEnd: month.endDate,
    notStarted: isAfter(parseISO(month.startDate), startOfDay(now)),
    summary: buildDashboardSummary(month, now),
    savingGoal: selectConfig(state)!.savingGoal,
    commitments,
    commitmentsTotal: commitments.reduce((total, item) => total + item.amount, 0),
    credit: selectCreditSnapshot(state, now),
    balance: selectCycleBalance(state, now)!,
    cards: selectActiveCreditCards(state).map((card) => ({
      id: card.id,
      name: card.name,
      usage: selectCardLimitUsage(state, card.id),
    })),
  };
}

// ---------------------------------------------------------------------------
// Gráficos (BR-FIN-039): saldo pelo ciclo do salário; crédito pelo ciclo do cartão.
// ---------------------------------------------------------------------------

export type CycleOption = { id: string; startDate: string; endDate: string; active: boolean };

/** Ciclos vivos, do mais recente para o mais antigo (atalhos do gráfico de saldo). */
export function listCycleOptions(state: LocalState): CycleOption[] {
  return state.cycles
    .filter(isLive)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((cycle) => ({
      id: cycle.id,
      startDate: cycle.startDate,
      endDate: cycle.endDate,
      active: cycle.status === 'active',
    }));
}

/** Saldo dia a dia entre `from` e `to`; dias depois de hoje ficam vazios. */
export function buildBalanceChart(
  state: LocalState,
  from: string,
  to: string,
  now: Date,
): BalanceDailyPoint[] {
  return selectBalanceDailySeries(state, listSeriesDates(from, to), toISODate(now));
}

/** `custom` = De/Até livre: em cada dia, a fatura que recebe as compras daquele dia. */
export type CreditChartMode = CreditPeriodMode | 'custom';

export type CreditChart = {
  /** Faturas acompanhadas (nulo em `custom` ou sem cartão). */
  period: CreditPeriod | null;
  from: string;
  to: string;
  points: CreditDailyPoint[];
};

export function buildCreditChart(
  state: LocalState,
  options: { mode: CreditChartMode; cardId: string | null; from: string; to: string },
  now: Date,
): CreditChart {
  const period =
    options.mode === 'custom' ? null : selectCreditPeriod(state, options.mode, now, options.cardId);
  const from = period?.from ?? options.from;
  const to = period?.to ?? options.to;

  return {
    period,
    from,
    to,
    points:
      options.mode !== 'custom' && !period
        ? []
        : selectCreditDailySeries(state, listSeriesDates(from, to), {
            cardId: options.cardId,
            statements: period?.statements,
            today: toISODate(now),
          }),
  };
}

/** "Inter: 09/09 a 08/10, vence 15/10" (com cartão) ou "Fatura 09/09 a 08/10, vence 15/10". */
export function describeStatement(statement: CreditStatementRef, withCard: boolean): string {
  const period = `${formatShortDate(statement.openDate)} a ${formatShortDate(statement.closingDate)}, vence ${formatShortDate(statement.dueDate)}`;

  return withCard ? `${statement.cardName}: ${period}` : `Fatura ${period}`;
}

import { eachDayOfInterval, isAfter, parseISO, startOfDay } from 'date-fns';

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
import { LocalState } from '@manager-money/core/application/state';
import { CardLimitUsage } from '@manager-money/core/domain/financial/credit-card';
import {
  buildDashboardSummary,
  calculateDailyLimitForDate,
  calculateTodaySpent,
} from '@manager-money/core/domain/financial/financial.calculations';
import { DashboardSummary, MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { toISODate } from '@manager-money/core/utils/date';

export type DailyPoint = { date: string; spent: MoneyCents; limit: MoneyCents };

export type CardLimitView = { id: string; name: string; usage: CardLimitUsage | null };

export type OverviewView =
  | { kind: 'no-config' }
  | { kind: 'no-cycle' }
  | {
      kind: 'active';
      cycleId: string;
      summary: DashboardSummary;
      savingGoal: MoneyCents;
      commitments: UpcomingCommitment[];
      commitmentsTotal: MoneyCents;
      cards: CardLimitView[];
      credit: CreditSnapshot;
      daily: DailyPoint[];
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
  const lastDay = [parseISO(month.endDate), startOfDay(now)].reduce((a, b) =>
    isAfter(a, b) ? b : a,
  );
  const days = isAfter(parseISO(month.startDate), lastDay)
    ? []
    : eachDayOfInterval({ start: parseISO(month.startDate), end: lastDay });

  return {
    kind: 'active',
    cycleId: month.id,
    summary: buildDashboardSummary(month, now),
    savingGoal: selectConfig(state)!.savingGoal,
    commitments,
    commitmentsTotal: commitments.reduce((total, item) => total + item.amount, 0),
    credit: selectCreditSnapshot(state, now),
    cards: selectActiveCreditCards(state).map((card) => ({
      id: card.id,
      name: card.name,
      usage: selectCardLimitUsage(state, card.id),
    })),
    // Gasto do dia vs. limite previsto para o dia (mesmas funções do histórico do app).
    daily: days.map((day) => ({
      date: toISODate(day),
      spent: calculateTodaySpent(month.expenses, day),
      limit: calculateDailyLimitForDate(month, day),
    })),
  };
}

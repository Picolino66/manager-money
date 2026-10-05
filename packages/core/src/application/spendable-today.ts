import { DashboardSummary, MoneyCents } from '../domain/financial/financial.types';
import { formatCurrency } from '../utils/currency';
import { formatShortDate } from '../utils/date';

export type SpendableToday = {
  /** Valor exibido em "Ainda pode gastar hoje". */
  amount: MoneyCents;
  /** Quanto falta para cobrir o ciclo quando ele está no negativo; nulo caso contrário. */
  cycleDeficit: MoneyCents | null;
};

/**
 * BR-FIN-040: com o ciclo no negativo (o limite do dia, BR-FIN-007, já nasce abaixo de zero), não há
 * o que gastar: o card mostra R$ 0,00 e o déficit do ciclo, em vez de um limite negativo que só
 * piora com os dias (a mesma dívida dividida por menos dias). Com o ciclo positivo, é o saldo do dia
 * de sempre (pode ficar negativo se o gasto de hoje passou do limite).
 */
export function describeSpendableToday(
  summary: Pick<
    DashboardSummary,
    'currentDailyLimit' | 'todayBalance' | 'remainingAvailableAmount'
  >,
): SpendableToday {
  if (summary.currentDailyLimit < 0) {
    return { amount: 0, cycleDeficit: Math.max(0, -summary.remainingAvailableAmount) };
  }

  return { amount: summary.todayBalance, cycleDeficit: null };
}

/** "Ciclo no negativo: faltam R$ 1.309,43 para cobrir até 24/10." */
export function describeCycleDeficit(deficit: MoneyCents, cycleEndDate: string): string {
  return `Ciclo no negativo: faltam ${formatCurrency(deficit)} para cobrir até ${formatShortDate(cycleEndDate)}.`;
}

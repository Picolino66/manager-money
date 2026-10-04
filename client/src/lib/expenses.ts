import {
  EMPTY_PAID_HISTORY_FILTER,
  filterPaidHistory,
  PaidHistoryFilter,
  PaidHistoryItem,
  selectPaidHistory,
} from '@manager-money/core/application/paid-history';
import { isLive, LocalState } from '@manager-money/core/application/state';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCycleLabel } from '@manager-money/core/utils/date';

/** Linha do histórico: tudo que foi pago (gasto, cartão, fixa, parcelado, fatura). */
export type HistoryRow = PaidHistoryItem & {
  cycleLabel: string;
};

export type HistoryFilter = PaidHistoryFilter;

export const EMPTY_FILTER: HistoryFilter = EMPTY_PAID_HISTORY_FILTER;

/** Itens pagos de todos os ciclos vivos, do mais recente para o mais antigo. */
export function buildHistoryRows(state: LocalState): HistoryRow[] {
  const cycles = new Map(state.cycles.filter(isLive).map((cycle) => [cycle.id, cycle]));

  return selectPaidHistory(state).map((item) => {
    const cycle = item.cycleId ? cycles.get(item.cycleId) : undefined;

    return {
      ...item,
      cycleLabel: cycle ? formatCycleLabel(cycle.startDate, cycle.endDate) : '—',
    };
  });
}

export function filterHistoryRows(rows: HistoryRow[], filter: HistoryFilter): HistoryRow[] {
  return filterPaidHistory(rows, filter);
}

/** Soma em centavos inteiros (BR-FIN-001); a fatura paga é informativa e não entra. */
export function sumAmounts(rows: { amount: MoneyCents; countsInTotal?: boolean }[]): MoneyCents {
  return rows.reduce((total, row) => total + (row.countsInTotal === false ? 0 : row.amount), 0);
}

export function categoriesOf(rows: HistoryRow[]): string[] {
  return [...new Set(rows.map((row) => row.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

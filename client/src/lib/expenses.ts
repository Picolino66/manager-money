import { isLive, LocalState } from '@manager-money/core/application/state';
import { normalizeCategory } from '@manager-money/core/domain/financial/financial.calculations';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCycleLabel } from '@manager-money/core/utils/date';

export type ExpenseRow = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: MoneyCents;
  cycleId: string;
  cycleLabel: string;
  /** Só gastos do ciclo ativo podem ser editados ou excluídos (ciclo fechado é imutável). */
  editable: boolean;
};

export type ExpenseFilter = {
  search: string;
  cycleId: string | null;
  category: string | null;
  /** yyyy-MM-dd inclusivos; vazio = sem limite. */
  from: string;
  to: string;
};

export const EMPTY_FILTER: ExpenseFilter = {
  search: '',
  cycleId: null,
  category: null,
  from: '',
  to: '',
};

/** Gastos vivos de todos os ciclos vivos, do mais recente para o mais antigo. */
export function buildExpenseRows(state: LocalState): ExpenseRow[] {
  const cycles = new Map(state.cycles.filter(isLive).map((cycle) => [cycle.id, cycle]));

  return state.expenses
    .filter((expense) => isLive(expense) && cycles.has(expense.cycleId))
    .map((expense) => {
      const cycle = cycles.get(expense.cycleId)!;
      return {
        id: expense.id,
        date: expense.date,
        description: expense.description,
        category: normalizeCategory(expense.category),
        amount: expense.amount,
        cycleId: cycle.id,
        cycleLabel: formatCycleLabel(cycle.startDate, cycle.endDate),
        editable: cycle.status === 'active',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterExpenseRows(rows: ExpenseRow[], filter: ExpenseFilter): ExpenseRow[] {
  const search = normalizeText(filter.search);

  return rows.filter(
    (row) =>
      (!search ||
        normalizeText(row.description).includes(search) ||
        normalizeText(row.category).includes(search)) &&
      (!filter.cycleId || row.cycleId === filter.cycleId) &&
      (!filter.category || row.category === filter.category) &&
      (!filter.from || row.date >= filter.from) &&
      (!filter.to || row.date <= filter.to),
  );
}

/** Soma em centavos inteiros (BR-FIN-001). */
export function sumAmounts(rows: { amount: MoneyCents }[]): MoneyCents {
  return rows.reduce((total, row) => total + row.amount, 0);
}

export function categoriesOf(rows: ExpenseRow[]): string[] {
  return [...new Set(rows.map((row) => row.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

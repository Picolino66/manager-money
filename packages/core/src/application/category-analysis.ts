import { isAfter, isBefore, parseISO, startOfDay } from 'date-fns';

import { normalizeCategory } from '../domain/financial/financial.calculations';
import { MoneyCents } from '../domain/financial/financial.types';
import { selectActiveMonth, selectClosedMonths } from './selectors';
import { isLive, LocalState } from './state';

/**
 * Análise por categoria e período (RF-09), compartilhada pelo app e pelo client web.
 * - expense: gasto à vista do dia a dia;
 * - card: compra no cartão de crédito (data da compra, valor total);
 * - fixed / installment: pagamento efetivo de despesa fixa / parcelamento fora do cartão.
 * Fixa paga no crédito conta uma vez só, como fixa (valor + juros); a compra que ela gerou no
 * cartão não entra de novo como "Cartão".
 */
export type CategorizedItemType = 'expense' | 'card' | 'fixed' | 'installment';

export type CategorizedItem = {
  id: string;
  type: CategorizedItemType;
  name: string;
  category: string;
  amount: MoneyCents;
  date: string;
};

export type CategoryTotal = {
  category: string;
  total: MoneyCents;
};

export type CategorizedItemFilter = {
  /** Início e fim do período (inclusive); nulos ou invertidos = nenhum item. */
  start: Date | null;
  end: Date | null;
  /** `null` = todas as categorias. */
  category: string | null;
  types: Record<CategorizedItemType, boolean>;
};

export const CATEGORIZED_ITEM_LABELS: Record<CategorizedItemType, string> = {
  expense: 'Gasto',
  card: 'Cartão',
  fixed: 'Fixo',
  installment: 'Parcelamento',
};

/** Todos os itens categorizáveis do usuário: gastos (ativo + fechados), compras e fixas pagas. */
export function selectCategorizedItems(state: LocalState): CategorizedItem[] {
  const expenseItems = [
    ...(selectActiveMonth(state)?.expenses ?? []),
    ...selectClosedMonths(state).flatMap((month) => month.expenses),
  ].map((expense) => ({
    id: expense.id,
    type: 'expense' as const,
    name: expense.description,
    category: normalizeCategory(expense.category),
    amount: expense.amount,
    date: expense.date,
  }));

  // Pagamentos efetivos de fixas (não a configuração), pela data do pagamento.
  const fixedPayments = state.fixedPayments.filter(isLive);
  const paymentItems = fixedPayments.map((payment) => ({
    id: payment.id,
    type:
      state.fixedExpenses.find((expense) => expense.id === payment.fixedExpenseId)?.type ===
      'installment'
        ? ('installment' as const)
        : ('fixed' as const),
    name: payment.method === 'credit' ? `${payment.name} (no crédito)` : payment.name,
    category: normalizeCategory(payment.category),
    amount: payment.amount + payment.interest,
    date: payment.paidAt,
  }));
  const purchasesFromFixed = new Set(
    fixedPayments.flatMap((payment) => (payment.cardPurchaseId ? [payment.cardPurchaseId] : [])),
  );
  const cardItems = state.cardPurchases
    .filter((purchase) => isLive(purchase) && !purchasesFromFixed.has(purchase.id))
    .map((purchase) => ({
      id: purchase.id,
      type: 'card' as const,
      name:
        purchase.installments > 1
          ? `${purchase.description} (${purchase.installments}x)`
          : purchase.description,
      category: normalizeCategory(purchase.category),
      amount: purchase.totalAmount,
      date: purchase.purchaseDate,
    }));

  return [...expenseItems, ...cardItems, ...paymentItems];
}

export function filterCategorizedItems(
  items: CategorizedItem[],
  filter: CategorizedItemFilter,
): CategorizedItem[] {
  const { start, end } = filter;

  if (!start || !end || isAfter(start, end)) {
    return [];
  }

  return items.filter((item) => {
    const day = startOfDay(parseISO(item.date));
    const matchesCategory =
      filter.category === null || normalizeCategory(item.category) === filter.category;

    return (
      filter.types[item.type] &&
      !isBefore(day, startOfDay(start)) &&
      !isAfter(day, startOfDay(end)) &&
      matchesCategory
    );
  });
}

/** Totais por categoria, do maior para o menor. */
export function summarizeByCategory(items: CategorizedItem[]): CategoryTotal[] {
  const totals = items.reduce<Record<string, MoneyCents>>((result, item) => {
    result[item.category] = (result[item.category] ?? 0) + item.amount;

    return result;
  }, {});

  return Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((left, right) => right.total - left.total);
}

export function sumCategorizedItems(items: CategorizedItem[]): MoneyCents {
  return items.reduce((total, item) => total + item.amount, 0);
}

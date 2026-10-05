import { addMonths, parseISO } from 'date-fns';

import { listInstallments, statementDueDate } from '../domain/financial/credit-card';
import { normalizeCategory } from '../domain/financial/financial.calculations';
import { MoneyCents } from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';
import {
  CATEGORIZED_ITEM_LABELS,
  CategorizedItemType,
  selectCategorizedItems,
} from './category-analysis';
import { canModifyCardPurchase } from './card.use-cases';
import { isLive, LocalState } from './state';

/**
 * Histórico de tudo que foi pago (app e client web): gasto à vista, compra no cartão, fixa e
 * parcelamento pagos e pagamentos de fatura. Reaproveita `selectCategorizedItems` para não repetir
 * a regra (fixa paga no crédito conta uma vez só, como fixa).
 * - `statement`: pagamento de fatura ou encargos (juros/multa) lançados no ciclo.
 */
export type PaidHistoryType = CategorizedItemType | 'statement';

/** De onde saiu o valor: `credit` = cartão de crédito; `balance` = saldo (Pix, débito, dinheiro). */
export type PaidHistoryMeans = 'credit' | 'balance';

export const PAID_HISTORY_MEANS_LABELS: Record<PaidHistoryMeans, string> = {
  credit: 'Crédito',
  balance: 'Saldo',
};

export type PaidHistoryItem = {
  id: string;
  type: PaidHistoryType;
  name: string;
  category: string;
  amount: MoneyCents;
  date: string;
  /**
   * Ciclo em que o item pesa (BR-FIN-039): o que saiu do saldo fica no ciclo em que saiu; o que foi
   * no crédito (compra, parcela, fixa paga no crédito) fica no ciclo em que a **fatura vence**. Nulo
   * quando esse ciclo não existe (ex.: compra antiga no cartão ou fatura de um ciclo ainda não aberto).
   */
  cycleId: string | null;
  /**
   * `false` = informativo: o valor já pesou no ciclo pela compra no cartão (a fatura paga não
   * desconta de novo, ADR-018), então não entra na soma do histórico.
   */
  countsInTotal: boolean;
  /**
   * Meio de pagamento. Pix, débito e dinheiro não são distinguidos (o gasto à vista não guarda a
   * forma): todos são `balance`. Fixa paga no crédito e compra no cartão são `credit`.
   */
  means: PaidHistoryMeans;
  /** Id do registro de origem (o lançamento de fatura gera até dois itens com o mesmo registro). */
  sourceId: string;
  /** Gasto à vista do ciclo ativo e compra no cartão ainda não contada em ciclo/fatura fechados. */
  editable: boolean;
  /**
   * Pode ser removido: gasto (excluir), compra (excluir), fixa/parcelado e lançamento de fatura do
   * ciclo ativo (desfazer). Fixa e fatura não têm edição, só desfazer.
   */
  deletable: boolean;
  /** Parcela (n/N) de compra parcelada no cartão; nulo nos demais itens (BR-FIN-038). */
  installment: { number: number; total: number } | null;
  /** Parcela ainda por vir (data depois de hoje): aparece, mas não entra na soma. */
  upcoming: boolean;
  /** Cartão de origem (compra, parcela, fixa paga no crédito, fatura); nulo no que saiu do saldo. */
  cardId: string | null;
  /** Fatura (`yyyy-MM` do fechamento) da parcela, da fixa no crédito ou do lançamento de fatura. */
  statementKey: string | null;
  /** Vencimento dessa fatura (yyyy-MM-dd). */
  dueDate: string | null;
};

export const PAID_HISTORY_LABELS: Record<PaidHistoryType, string> = {
  ...CATEGORIZED_ITEM_LABELS,
  statement: 'Fatura',
};

export const STATEMENT_CATEGORY = 'Cartão de crédito';

/**
 * Todos os itens pagos de ciclos vivos, do mais recente para o mais antigo. Compra parcelada no
 * cartão gera uma linha por parcela (1/3, 2/3, 3/3), na data da compra somada mês a mês (a 1ª, na
 * própria data da compra); nada é ocultado nem somado em uma linha só (BR-FIN-038).
 */
export function selectPaidHistory(
  state: LocalState,
  today: string = toISODate(new Date()),
): PaidHistoryItem[] {
  const cycles = state.cycles.filter(isLive);
  const activeIds = new Set(cycles.filter((cycle) => cycle.status === 'active').map((c) => c.id));
  const purchases = new Map(state.cardPurchases.filter(isLive).map((p) => [p.id, p] as const));
  const payments = new Map(state.fixedPayments.filter(isLive).map((p) => [p.id, p] as const));
  const cycleByItem = new Map<string, string>([
    ...state.expenses.filter(isLive).map((expense) => [expense.id, expense.cycleId] as const),
    ...state.fixedPayments.filter(isLive).map((payment) => [payment.id, payment.cycleId] as const),
  ]);
  const cycleOfDate = (date: string) =>
    cycles.find((cycle) => cycle.startDate <= date && date <= cycle.endDate)?.id ?? null;

  const cardsById = new Map(state.creditCards.map((record) => [record.id, record] as const));
  const dueOf = (key: string, card: (typeof state.creditCards)[number]) =>
    toISODate(statementDueDate(key, card));

  const items: PaidHistoryItem[] = selectCategorizedItems(state)
    .filter((item) => item.type !== 'card')
    .map((item) => {
      const paidCycleId = cycleByItem.get(item.id) ?? cycleOfDate(item.date);
      const inActiveCycle = paidCycleId !== null && activeIds.has(paidCycleId);
      let editable = false;
      let deletable = false;

      if (item.type === 'expense') {
        editable = deletable = inActiveCycle;
      } else {
        // Fixa/parcelado: desfazer o pagamento (no crédito remove também a compra no cartão).
        const payment = payments.get(item.id);
        const purchase = payment?.cardPurchaseId
          ? purchases.get(payment.cardPurchaseId)
          : undefined;
        deletable =
          inActiveCycle && (purchase === undefined || canModifyCardPurchase(state, purchase));
      }

      const payment = payments.get(item.id);
      const means: PaidHistoryMeans = payment?.method === 'credit' ? 'credit' : 'balance';
      // Fixa paga no crédito: pesa pela fatura da compra que ela gerou (BR-FIN-022/039).
      const purchase =
        means === 'credit' ? purchases.get(payment?.cardPurchaseId ?? '') : undefined;
      const card = purchase ? cardsById.get(purchase.cardId) : undefined;
      const dueDate = purchase && card ? dueOf(purchase.firstStatementKey, card) : null;

      return {
        ...item,
        cycleId: dueDate ? cycleOfDate(dueDate) : paidCycleId,
        means,
        sourceId: item.id,
        countsInTotal: true,
        editable,
        deletable,
        installment: null,
        upcoming: false,
        cardId: purchase?.cardId ?? null,
        statementKey: purchase && card ? purchase.firstStatementKey : null,
        dueDate,
      };
    });

  const fromFixed = new Set(
    state.fixedPayments.filter(isLive).flatMap((p) => (p.cardPurchaseId ? [p.cardPurchaseId] : [])),
  );

  for (const purchase of purchases.values()) {
    if (fromFixed.has(purchase.id)) continue;

    const modifiable = canModifyCardPurchase(state, purchase);
    const card = cardsById.get(purchase.cardId);
    const category = normalizeCategory(purchase.category);
    const single = purchase.installments === 1 || purchase.kind === 'statement-balance';

    for (const installment of listInstallments(purchase)) {
      const first = installment.number === 1;
      const date = toISODate(addMonths(parseISO(purchase.purchaseDate), installment.number - 1));

      if (single && !first) continue;

      const upcoming = date > today;
      const prior = installment.number <= purchase.settledInstallments;
      const dueDate = card ? dueOf(installment.statementKey, card) : null;

      items.push({
        id: single ? purchase.id : `${purchase.id}#${installment.number}`,
        type: 'card',
        name: single
          ? purchase.installments > 1
            ? `${purchase.description} (${purchase.installments}x)`
            : purchase.description
          : `${purchase.description} (${installment.number}/${purchase.installments})`,
        category,
        amount: single ? purchase.totalAmount : installment.nominalAmount,
        date,
        cycleId: dueDate ? cycleOfDate(dueDate) : cycleOfDate(date),
        cardId: purchase.cardId,
        statementKey: card ? installment.statementKey : null,
        dueDate,
        countsInTotal: single ? true : !upcoming && !prior,
        means: 'credit',
        sourceId: purchase.id,
        editable: modifiable,
        deletable: modifiable,
        installment: single ? null : { number: installment.number, total: purchase.installments },
        upcoming: single ? false : upcoming,
      });
    }
  }

  for (const payment of state.statementPayments.filter(isLive)) {
    const cardRecord = cardsById.get(payment.cardId);
    const card = cardRecord?.name ?? 'Cartão';
    const base = {
      type: 'statement' as const,
      category: STATEMENT_CATEGORY,
      date: payment.paidAt,
      cycleId: cycles.some((cycle) => cycle.id === payment.cycleId) ? payment.cycleId : null,
      means: 'balance' as const,
      sourceId: payment.id,
      editable: false,
      deletable: activeIds.has(payment.cycleId),
      installment: null,
      upcoming: false,
      cardId: payment.cardId,
      statementKey: payment.statementKey,
      dueDate: cardRecord ? dueOf(payment.statementKey, cardRecord) : null,
    };

    // `paidAmount` já inclui os encargos; o principal é o que a compra no cartão já tinha pesado.
    const principal = Math.max(0, payment.paidAmount - payment.charges);

    if (principal > 0) {
      items.push({
        ...base,
        id: payment.id,
        name: `Pagamento de fatura — ${card}`,
        amount: principal,
        countsInTotal: false,
      });
    }

    if (payment.charges > 0) {
      items.push({
        ...base,
        id: `${payment.id}:charges`,
        name: `Encargos da fatura — ${card}`,
        amount: payment.charges,
        countsInTotal: true,
      });
    }
  }

  return items
    .map((item) => ({ ...item, category: normalizeCategory(item.category) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Soma em centavos inteiros só dos itens que pesam no total (BR-FIN-001). */
export function sumPaidHistory(items: PaidHistoryItem[]): MoneyCents {
  return items.reduce((total, item) => total + (item.countsInTotal ? item.amount : 0), 0);
}

/** Filtros do histórico (iguais no app e no client web). */
export type PaidHistoryFilter = {
  search: string;
  /** `null` = todos os ciclos (o app só mostra o ciclo ativo e ignora este campo). */
  cycleId: string | null;
  category: string | null;
  /** `null` = todos os cartões; com cartão, só as linhas ligadas a ele (o saldo some). */
  cardId: string | null;
  /** Fatura (`yyyy-MM` do fechamento); `null` = todas. Só ficam as linhas ligadas a uma fatura. */
  statementKey: string | null;
  /** `null` = todos os tipos. */
  type: PaidHistoryType | null;
  /** yyyy-MM-dd inclusivos; vazio = sem limite. */
  from: string;
  to: string;
};

export const EMPTY_PAID_HISTORY_FILTER: PaidHistoryFilter = {
  search: '',
  cycleId: null,
  category: null,
  cardId: null,
  statementKey: null,
  type: null,
  from: '',
  to: '',
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/** Busca sem acento em descrição e categoria; demais filtros por igualdade e período. */
export function filterPaidHistory<T extends PaidHistoryItem>(
  items: T[],
  filter: PaidHistoryFilter,
): T[] {
  const search = normalizeText(filter.search);

  return items.filter(
    (item) =>
      (!search ||
        normalizeText(item.name).includes(search) ||
        normalizeText(item.category).includes(search)) &&
      (!filter.cycleId || item.cycleId === filter.cycleId) &&
      (!filter.category || item.category === filter.category) &&
      (!filter.cardId || item.cardId === filter.cardId) &&
      (!filter.statementKey || item.statementKey === filter.statementKey) &&
      (!filter.type || item.type === filter.type) &&
      (!filter.from || item.date >= filter.from) &&
      (!filter.to || item.date <= filter.to),
  );
}

/** Faturas presentes nos itens (para o filtro), da mais recente para a mais antiga. */
export function listHistoryStatementKeys(items: Pick<PaidHistoryItem, 'statementKey'>[]): string[] {
  return [...new Set(items.flatMap((item) => (item.statementKey ? [item.statementKey] : [])))].sort(
    (a, b) => b.localeCompare(a),
  );
}

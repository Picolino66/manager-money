import { addDays, eachDayOfInterval, parseISO } from 'date-fns';

import {
  addCycleKeys,
  calculateCardLimitUsage,
  CardInstallment,
  CreditCard,
  currentStatementKey,
  listEffectiveInstallments,
  statementClosingDate,
  statementDueDate,
  statementKeyForDate,
  statementStartDate,
} from '../domain/financial/credit-card';
import {
  calculateDailyLimitForDate,
  calculateSpentBeforeDate,
  calculateTodaySpent,
} from '../domain/financial/financial.calculations';
import { MoneyCents } from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';
import {
  selectActiveCreditCards,
  selectActiveCycle,
  selectStatementPayments,
  toFinancialMonth,
} from './selectors';
import { isLive, LocalState } from './state';

/** Maior intervalo aceito pelos gráficos (dias), para não travar a tela com um período enorme. */
export const MAX_SERIES_DAYS = 400;

/** Dias yyyy-MM-dd de `from` a `to` (inclusive); vazio se o intervalo for inválido ou grande demais. */
export function listSeriesDates(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];

  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) });

  return days.length > MAX_SERIES_DAYS ? [] : days.map(toISODate);
}

// ---------------------------------------------------------------------------
// Período do cartão (BR-FIN-039): a fatura vai da abertura ao fechamento.
// ---------------------------------------------------------------------------

/** Fatura de um cartão com o seu período (abertura → fechamento) e vencimento. */
export type CreditStatementRef = {
  cardId: string;
  cardName: string;
  /** `yyyy-MM` do mês de fechamento. */
  key: string;
  openDate: string;
  closingDate: string;
  dueDate: string;
};

/**
 * - `due-in-cycle`: as faturas que vencem no ciclo ativo (as que pesam nele, BR-FIN-004/025) — é o
 *   mesmo conjunto do card "Gasto no crédito" (BR-FIN-037);
 * - `open`: a fatura aberta hoje, que recebe as compras feitas hoje.
 */
export type CreditPeriodMode = 'due-in-cycle' | 'open';

export type CreditPeriod = {
  mode: CreditPeriodMode;
  /** Primeira abertura e último fechamento entre as faturas (cada cartão tem o seu período). */
  from: string;
  to: string;
  statements: CreditStatementRef[];
};

export function toStatementRef(
  card: Pick<CreditCard, 'id' | 'name' | 'closingDay' | 'dueDay'>,
  key: string,
): CreditStatementRef {
  return {
    cardId: card.id,
    cardName: card.name,
    key,
    openDate: toISODate(statementStartDate(key, card.closingDay)),
    closingDate: toISODate(statementClosingDate(key, card.closingDay)),
    dueDate: toISODate(statementDueDate(key, card)),
  };
}

/** Faturas do cartão cujo vencimento cai entre `from` e `to` (yyyy-MM-dd, inclusive). */
export function statementKeysDueBetween(
  card: Pick<CreditCard, 'closingDay' | 'dueDay'>,
  from: string,
  to: string,
): string[] {
  if (from > to) return [];

  // O vencimento fica no mês do fechamento ou no seguinte: basta olhar a partir de 2 meses antes.
  const last = statementKeyForDate(parseISO(to), card.closingDay);
  const keys: string[] = [];

  for (
    let key = addCycleKeys(statementKeyForDate(parseISO(from), card.closingDay), -2);
    key <= last;
    key = addCycleKeys(key, 1)
  ) {
    const due = toISODate(statementDueDate(key, card));

    if (due >= from && due <= to) keys.push(key);
  }

  return keys;
}

/**
 * BR-FIN-039: período do gráfico de crédito pelo ciclo do cartão. `cardId` nulo = todos os cartões
 * ativos (o período cobre da primeira abertura ao último fechamento). Nulo quando não há cartão
 * ativo ou, em `due-in-cycle`, quando não há ciclo ativo.
 */
export function selectCreditPeriod(
  state: LocalState,
  mode: CreditPeriodMode,
  today: Date,
  cardId: string | null = null,
): CreditPeriod | null {
  const cards = selectActiveCreditCards(state).filter((card) => !cardId || card.id === cardId);
  const cycle = selectActiveCycle(state);

  if (cards.length === 0 || (mode === 'due-in-cycle' && !cycle)) return null;

  const statements = cards
    .flatMap((card) =>
      (mode === 'open'
        ? [currentStatementKey(card, today)]
        : statementKeysDueBetween(card, cycle!.startDate, cycle!.endDate)
      ).map((key) => toStatementRef(card, key)),
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.cardId.localeCompare(b.cardId));

  if (statements.length === 0) return null;

  return {
    mode,
    from: statements.reduce((min, item) => (item.openDate < min ? item.openDate : min), '9999'),
    to: statements.reduce((max, item) => (item.closingDate > max ? item.closingDate : max), ''),
    statements,
  };
}

// ---------------------------------------------------------------------------
// Série diária do crédito
// ---------------------------------------------------------------------------

export type CreditDailyPoint = {
  /** yyyy-MM-dd. */
  date: string;
  /**
   * Compras feitas no dia (inclusive as anteriores ao app, pela data salva), pelo valor que entra na
   * fatura (a parcela). `null` depois de hoje.
   */
  creditSpent: MoneyCents | null;
  /**
   * Fatura acumulada até o fim do dia: parcelas de compras datadas até o dia (as de antes do período
   * já entram no 1º dia). No último dia é o total da fatura. `null` depois de hoje.
   */
  statementTotal: MoneyCents | null;
  /**
   * Limite disponível dos cartões com limite informado ao fim do dia (limite − comprometido por
   * compras datadas até o dia, inclusive as anteriores ao app, e pagamentos de fatura até a data); `null` se nenhum cartão tem limite ou depois de hoje.
   */
  creditAvailable: MoneyCents | null;
};

export type CreditSeriesOptions = {
  /** Só um cartão; nulo/ausente = todos os cartões ativos. */
  cardId?: string | null;
  /**
   * Faturas acompanhadas (ex.: as de um `CreditPeriod`). Ausente = em cada dia, a fatura que
   * recebe as compras daquele dia (período livre).
   */
  statements?: CreditStatementRef[];
  /** Dias depois desta data (yyyy-MM-dd) ficam sem valor. */
  today?: string;
};

/**
 * BR-FIN-037/039: série diária do crédito pelo ciclo do cartão. O gasto do dia e a fatura acumulada
 * usam só as parcelas das faturas acompanhadas, pela data da compra (a compra anterior ao app, pela
 * data salva nela), então o último dia bate com o total das faturas (o card "Gasto no crédito"). O disponível reconstrói o limite "como estava" no dia:
 * compra datada até o dia (a anterior ao app pela data salva, como na fatura acumulada) e pagamento
 * lançado até o dia; assim as duas linhas se espelham.
 */
export function selectCreditDailySeries(
  state: LocalState,
  dates: string[],
  options: CreditSeriesOptions = {},
): CreditDailyPoint[] {
  const cards = selectActiveCreditCards(state).filter(
    (card) => !options.cardId || card.id === options.cardId,
  );
  const purchases = state.cardPurchases.filter(isLive);
  const payments = selectStatementPayments(state);
  const installmentsByCard = new Map<string, CardInstallment[]>(
    cards.map((card) => [
      card.id,
      listEffectiveInstallments(purchases.filter((purchase) => purchase.cardId === card.id)),
    ]),
  );
  const tracked = options.statements
    ? new Map(
        cards.map((card) => [
          card.id,
          new Set(
            options.statements!.filter((item) => item.cardId === card.id).map((item) => item.key),
          ),
        ]),
      )
    : null;

  return dates.map((date) => {
    if (options.today && date > options.today) {
      return { date, creditSpent: null, statementTotal: null, creditAvailable: null };
    }

    let creditSpent = 0;
    let statementTotal = 0;
    let available: MoneyCents | null = null;

    for (const card of cards) {
      const keys =
        tracked?.get(card.id) ?? new Set([statementKeyForDate(parseISO(date), card.closingDay)]);

      for (const installment of installmentsByCard.get(card.id) ?? []) {
        if (!keys.has(installment.statementKey)) continue;

        // Compra anterior ao app entra pela data salva nela (BR-FIN-036), como as demais.
        const { purchase } = installment;

        if (purchase.purchaseDate <= date) statementTotal += installment.amount;
        if (purchase.purchaseDate === date) creditSpent += installment.amount;
      }

      const usage = calculateCardLimitUsage(
        card,
        purchases.filter(
          (purchase) => purchase.cardId === card.id && purchase.purchaseDate <= date,
        ),
        payments.filter((payment) => payment.cardId === card.id && payment.paidAt <= date),
      );

      if (usage.available !== null) {
        available = (available ?? 0) + usage.available;
      }
    }

    return { date, creditSpent, statementTotal, creditAvailable: available };
  });
}

// ---------------------------------------------------------------------------
// Série diária do saldo (ciclo do salário)
// ---------------------------------------------------------------------------

export type BalanceDailyPoint = {
  date: string;
  /** Ciclo que contém o dia; nulo = nenhum ciclo registrado (os valores ficam nulos). */
  cycleId: string | null;
  /** Gasto à vista do dia. */
  spent: MoneyCents | null;
  /**
   * Fixas pagas pelo saldo no dia (BR-FIN-041). Já estavam reservadas: não mudam o limite nem o
   * disponível. A fixa paga no crédito fica no gráfico de crédito.
   */
  fixedPaid: MoneyCents | null;
  /** Limite previsto para o dia (mesma conta do histórico diário), nunca abaixo de zero (BR-FIN-040). */
  limit: MoneyCents | null;
  /** Disponível no ciclo ao fim do dia (saldo inicial − gasto acumulado). */
  available: MoneyCents | null;
};

/**
 * BR-FIN-039: série diária do saldo pelo ciclo do salário. Cada dia usa o ciclo que o contém (o
 * período pode atravessar ciclos); dia fora de qualquer ciclo ou depois de hoje fica sem valor.
 */
export function selectBalanceDailySeries(
  state: LocalState,
  dates: string[],
  today?: string,
): BalanceDailyPoint[] {
  const months = state.cycles
    .filter(isLive)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((cycle) => toFinancialMonth(state, cycle));
  const cashPayments = state.fixedPayments.filter(
    (payment) => isLive(payment) && payment.method !== 'credit',
  );

  return dates.map((date) => {
    const month = months.find((item) => item.startDate <= date && date <= item.endDate);

    if (!month || (today && date > today)) {
      return {
        date,
        cycleId: month?.id ?? null,
        spent: null,
        fixedPaid: null,
        limit: null,
        available: null,
      };
    }

    const day = parseISO(date);

    return {
      date,
      cycleId: month.id,
      spent: calculateTodaySpent(month.expenses, day),
      fixedPaid: cashPayments
        .filter((payment) => payment.cycleId === month.id && payment.paidAt === date)
        .reduce((total, payment) => total + payment.amount, 0),
      // BR-FIN-040: com o ciclo no negativo o limite previsto para em zero (não há o que gastar).
      limit: Math.max(0, calculateDailyLimitForDate(month, day)),
      available:
        month.initialAvailableAmount - calculateSpentBeforeDate(month.expenses, addDays(day, 1)),
    };
  });
}

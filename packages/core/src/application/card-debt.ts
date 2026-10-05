import { isAfter, startOfDay } from 'date-fns';

import {
  addCycleKeys,
  CreditCard,
  currentStatementKey,
  cycleKeyFromStartDate,
  MAX_CARD_INSTALLMENTS,
  statementCycleKey,
  statementDueDate,
} from '../domain/financial/credit-card';
import { DEFAULT_EXPENSE_CATEGORY, MoneyCents } from '../domain/financial/financial.types';
import { toISODate } from '../utils/date';
import { ExistingCardDebtInput } from './card.use-cases';
import { selectCardStatements } from './selectors';
import { CardPurchaseRecord, isLive, LocalState } from './state';

/**
 * Situação inicial do cartão (BR-FIN-027/032), compartilhada pelo app e pelo client web: quais faturas
 * aceitam cadastro, o total já informado, em quais ciclos a agenda pesa e a validade das parcelas.
 */
export type StatementChoice = {
  /** `yyyy-MM` do fechamento. */
  key: string;
  status: 'open' | 'closed';
  /** yyyy-MM-dd. */
  dueDate: string;
};

/**
 * Faturas ainda não vencidas — a fechada aguardando vencimento (se houver) e a aberta —, exceto as com
 * qualquer lançamento (pago ou parcial), que não recebem compras anteriores.
 */
export function selectStatementChoices(
  state: LocalState,
  card: CreditCard,
  today: Date,
): StatementChoice[] {
  const day = startOfDay(today);
  const openKey = currentStatementKey(card, day);
  const withPayments = new Set(
    selectCardStatements(state, card.id, day)
      .filter((statement) => statement.payments.length > 0)
      .map((statement) => statement.key),
  );

  return [addCycleKeys(openKey, -1), openKey]
    .filter((key) => !isAfter(day, statementDueDate(key, card)) && !withPayments.has(key))
    .map((key) => ({
      key,
      status: key === openKey ? ('open' as const) : ('closed' as const),
      dueDate: toISODate(statementDueDate(key, card)),
    }));
}

/** Fatura escolhida; sem escolha válida, a primeira disponível (ou a aberta se nenhuma). */
export function resolveChosenStatement(
  choices: StatementChoice[],
  chosenKey: string,
  card: CreditCard,
  today: Date,
): string {
  return (
    choices.find((choice) => choice.key === chosenKey)?.key ??
    choices[0]?.key ??
    currentStatementKey(card, startOfDay(today))
  );
}

/** BR-FIN-032: total da fatura já informado (um por cartão + fatura). */
export function findStatementBalance(
  state: LocalState,
  cardId: string,
  statementKey: string,
): CardPurchaseRecord | undefined {
  return state.cardPurchases.find(
    (purchase) =>
      isLive(purchase) &&
      purchase.cardId === cardId &&
      purchase.kind === 'statement-balance' &&
      purchase.firstStatementKey === statementKey,
  );
}

export function isValidInstallmentCount(total: number, remaining: number): boolean {
  return total >= 1 && total <= MAX_CARD_INSTALLMENTS && remaining >= 1 && remaining <= total;
}

/** Ciclos em que a agenda pesa: do 1º (nunca antes do ciclo ativo) até o da última parcela restante. */
export function existingDebtCycleRange(
  card: CreditCard,
  payday: number,
  activeCycleStartDate: string | null,
  statementKey: string,
  remaining: number,
): { firstCycleKey: string; lastCycleKey: string } {
  const activeCycleKey = activeCycleStartDate ? cycleKeyFromStartDate(activeCycleStartDate) : null;
  const dueCycleKey = statementCycleKey(statementKey, card, payday);
  const firstCycleKey =
    activeCycleKey && activeCycleKey > dueCycleKey ? activeCycleKey : dueCycleKey;

  return { firstCycleKey, lastCycleKey: addCycleKeys(firstCycleKey, remaining - 1) };
}

/** Quanto do limite do cartão a agenda compromete (a parcela já no total informado não soma). */
export function existingDebtCommitted(
  amount: MoneyCents,
  remaining: number,
  includedInBalance: boolean,
): MoneyCents {
  return amount * (includedInBalance ? remaining - 1 : remaining);
}

export type ExistingDebtMode = 'statement' | 'installments';

export type ExistingDebtDraft = {
  mode: ExistingDebtMode;
  description: string;
  amount: MoneyCents;
  total: number;
  remaining: number;
  /** Data real da compra (yyyy-MM-dd); vazia = não informar (BR-FIN-036). */
  purchaseDate?: string;
};

export type ExistingDebtErrors = Partial<
  Record<'description' | 'amount' | 'total' | 'remaining' | 'purchaseDate', string>
>;

/** Validação do formulário (a mesma no app e no web); o núcleo valida de novo ao gravar. */
export function validateExistingDebtDraft(
  draft: ExistingDebtDraft,
  today?: string,
): ExistingDebtErrors {
  const errors: ExistingDebtErrors = {};
  const installments = draft.mode === 'installments';

  if (installments && !draft.description.trim()) errors.description = 'Informe uma descrição.';
  if (draft.purchaseDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.purchaseDate)) {
      errors.purchaseDate = 'Informe uma data válida.';
    } else if (today && draft.purchaseDate > today) {
      errors.purchaseDate = 'A data da compra não pode ser futura.';
    }
  }
  if (draft.amount <= 0) errors.amount = 'Informe um valor maior que zero.';

  if (installments) {
    if (draft.total < 1 || draft.total > MAX_CARD_INSTALLMENTS) {
      errors.total = `Informe de 1 a ${MAX_CARD_INSTALLMENTS} parcelas.`;
    }

    if (draft.remaining < 1 || draft.remaining > draft.total) {
      errors.remaining = 'As parcelas restantes devem ficar entre 1 e o total.';
    }
  }

  return errors;
}

/** Formulário validado → entrada do caso de uso (fatura em aberto usa a categoria padrão). */
export function buildExistingDebtInput(args: {
  cardId: string;
  mode: ExistingDebtMode;
  description: string;
  category: string;
  amount: MoneyCents;
  total: number;
  remaining: number;
  statementKey: string;
  includedInBalance: boolean;
  purchaseDate?: string;
}): ExistingCardDebtInput {
  const installments = args.mode === 'installments';

  return {
    cardId: args.cardId,
    description:
      args.description.trim() ||
      `Fatura ${args.statementKey.slice(5, 7)}/${args.statementKey.slice(0, 4)}`,
    category: installments ? args.category : DEFAULT_EXPENSE_CATEGORY,
    installmentAmount: args.amount,
    totalInstallments: installments ? args.total : 1,
    remainingInstallments: installments ? args.remaining : 1,
    nextStatementKey: args.statementKey,
    ...(args.purchaseDate ? { purchaseDate: args.purchaseDate } : {}),
    ...(installments ? {} : { statementBalance: true }),
    ...(installments && args.includedInBalance ? { includedInStatementBalance: true } : {}),
  };
}

import { recalculateActiveCycleBalance } from '@manager-money/core/application/cycle.use-cases';
import {
  createEmptyState,
  createEmptySyncState,
  LocalState,
  SYNC_TABLES,
  UseCaseContext,
} from '@manager-money/core/application/state';
import { collectDirty, markAllClean } from '@manager-money/core/contract/dirty';
import {
  cardPurchaseFromRow,
  creditCardFromRow,
  cycleFromRow,
  expenseFromRow,
  extraIncomeFromRow,
  fixedExpenseFromRow,
  fixedPaymentFromRow,
  settingsFromRow,
  statementPaymentFromRow,
} from '@manager-money/core/contract/mappers';
import { SyncError, SyncErrorCode } from '@manager-money/core/contract/types';

import { logger } from './monitoring/logger';
import { RemoteGateway } from './remote';

/**
 * Lê todas as linhas vivas do usuário e monta o estado em memória (nada é salvo no navegador).
 * O saldo do ciclo ativo é derivado e recalculado aqui, como o app faz ao carregar (BR-FIN-005);
 * em seguida as marcações são zeradas para que ler nunca grave nada.
 */
export async function loadUserState(
  gateway: RemoteGateway,
  userId: string,
  ctx: UseCaseContext,
): Promise<LocalState> {
  const startedAt = Date.now();
  const [
    settings,
    fixedExpenses,
    creditCards,
    cycles,
    expenses,
    cardPurchases,
    fixedPayments,
    extraIncomes,
    statementPayments,
  ] = await Promise.all([
    gateway.selectLive('settings'),
    gateway.selectLive('fixed_expenses'),
    gateway.selectLive('credit_cards'),
    gateway.selectLive('cycles'),
    gateway.selectLive('expenses'),
    gateway.selectLive('card_purchases'),
    gateway.selectLive('fixed_payments'),
    gateway.selectLive('extra_incomes'),
    gateway.selectLive('statement_payments'),
  ]);
  const cards = creditCards.map(creditCardFromRow);
  const closingDayOf = (cardId: string) => cards.find((card) => card.id === cardId)?.closingDay;
  const settingsRow = settings[0];

  const state: LocalState = {
    ...createEmptyState(),
    settings: settingsRow ? settingsFromRow(settingsRow) : null,
    fixedExpenses: fixedExpenses.map(fixedExpenseFromRow),
    creditCards: cards,
    cycles: cycles.map(cycleFromRow),
    expenses: expenses.map(expenseFromRow),
    cardPurchases: cardPurchases.map((row) => cardPurchaseFromRow(row, closingDayOf)),
    fixedPayments: fixedPayments.map(fixedPaymentFromRow),
    extraIncomes: extraIncomes.map(extraIncomeFromRow),
    statementPayments: statementPayments.map(statementPaymentFromRow),
    sync: createEmptySyncState(userId),
  };

  logger.event('web.load', { ok: true, durationMs: Date.now() - startedAt });

  return markAllClean(recalculateActiveCycleBalance(state, ctx));
}

/** Falha ao gravar. `partial`: alguma tabela já tinha sido gravada (o estado do servidor mudou). */
export class SaveError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    public readonly partial: boolean,
    message: string = code,
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

/**
 * Grava na hora só os registros que o caso de uso marcou (`collectDirty`), tabela a tabela na ordem
 * de dependência do contrato (contracts.md §3; em `cycles`, fechados antes do ativo).
 * Devolve quantas tabelas foram gravadas.
 */
export async function saveChanges(
  gateway: RemoteGateway,
  state: LocalState,
  userId: string,
): Promise<number> {
  const startedAt = Date.now();
  let written = 0;

  for (const table of SYNC_TABLES) {
    const { rows } = collectDirty(state, table, userId);
    if (rows.length === 0) continue;

    try {
      await gateway.upsert(table, rows as never[]);
    } catch (error) {
      const code = error instanceof SyncError ? error.code : 'unknown';
      if (!(error instanceof SyncError)) logger.error(error);
      logger.event('web.save', { ok: false, code, table, count: written });
      throw new SaveError(code, written > 0, error instanceof Error ? error.message : code);
    }

    written += 1;
  }

  logger.event('web.save', { ok: true, count: written, durationMs: Date.now() - startedAt });

  return written;
}

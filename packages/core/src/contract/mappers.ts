import {
  CardPurchaseRecord,
  CreditCardRecord,
  CycleRecord,
  ExpenseRecord,
  ExtraIncomeRecord,
  FixedExpenseRecord,
  FixedPaymentRecord,
  SettingsRecord,
  StatementPaymentRecord,
} from '../application/state';
import { MAX_CARD_DAY, statementKeyForDate } from '../domain/financial/credit-card';
import { parseISO } from 'date-fns';
import { DEFAULT_PAYDAY, IncomeSource, isActive } from '../domain/financial/financial.types';
import {
  CardPurchaseRow,
  CreditCardRow,
  ExtraIncomeRow,
  FixedPaymentRow,
  CycleRow,
  ExpenseRow,
  FixedExpenseRow,
  SettingsRow,
  StatementPaymentRow,
} from './types';

/** Mapeamento registro local ↔ linha remota (contracts.md §2). */

/** Fonte única "Renda" para configurações anteriores às fontes de renda (ADR-013). */
export function legacyIncomeSources(
  monthlyIncome: number,
  payday: number = DEFAULT_PAYDAY,
): IncomeSource[] {
  return [{ id: 'income-legacy', name: 'Renda', amount: Math.max(0, monthlyIncome), payday }];
}

export function settingsToRow(record: SettingsRecord, userId: string): SettingsRow {
  return {
    user_id: userId,
    monthly_income: record.monthlyIncome,
    income_sources: record.incomeSources,
    saving_goal: record.savingGoal,
    payday: record.payday,
    custom_categories: record.customCategories,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

/** Linhas antigas (sem `income_sources`) viram uma única fonte com o `monthly_income`. */
function incomeSourcesFromRow(row: SettingsRow): IncomeSource[] {
  if (row.income_sources && row.income_sources.length > 0) {
    return row.income_sources.map((source) => ({
      id: source.id,
      name: source.name,
      amount: Number(source.amount),
      // Linhas gravadas antes do dia por fonte herdam o dia global da linha.
      payday: source.payday ?? row.payday,
      ...(source.active === false ? { active: false } : {}),
    }));
  }

  return legacyIncomeSources(Number(row.monthly_income), row.payday);
}

export function settingsFromRow(row: SettingsRow): SettingsRecord {
  return {
    monthlyIncome: Number(row.monthly_income),
    incomeSources: incomeSourcesFromRow(row),
    savingGoal: Number(row.saving_goal),
    payday: row.payday,
    customCategories: row.custom_categories ?? [],
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function fixedExpenseToRow(record: FixedExpenseRecord, userId: string): FixedExpenseRow {
  const base = {
    user_id: userId,
    id: record.id,
    kind: record.type,
    name: record.name,
    category: record.category,
    active: isActive(record),
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };

  if (record.type === 'installment') {
    return {
      ...base,
      amount: null,
      installment_amount: record.installmentAmount,
      total_installments: record.totalInstallments,
      remaining_installments: record.remainingInstallments,
      started_at_cycle_id: record.startedAtCycleId ?? null,
      recurring_card_id: null,
    };
  }

  return {
    ...base,
    amount: record.amount,
    installment_amount: null,
    total_installments: null,
    remaining_installments: null,
    started_at_cycle_id: null,
    recurring_card_id: record.recurringCardId ?? null,
  };
}

export function fixedExpenseFromRow(row: FixedExpenseRow): FixedExpenseRecord {
  const meta = {
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
    ...(row.active === false ? { active: false } : {}),
  };

  if (row.kind === 'installment') {
    return {
      ...meta,
      id: row.id,
      type: 'installment',
      name: row.name,
      category: row.category,
      installmentAmount: Number(row.installment_amount ?? 0),
      totalInstallments: row.total_installments ?? 1,
      remainingInstallments: row.remaining_installments ?? 0,
      ...(row.started_at_cycle_id ? { startedAtCycleId: row.started_at_cycle_id } : {}),
    };
  }

  return {
    ...meta,
    id: row.id,
    type: 'permanent',
    name: row.name,
    category: row.category,
    amount: Number(row.amount ?? 0),
    ...(row.recurring_card_id ? { recurringCardId: row.recurring_card_id } : {}),
  };
}

export function cycleToRow(record: CycleRecord, userId: string): CycleRow {
  return {
    user_id: userId,
    id: record.id,
    start_date: record.startDate,
    end_date: record.endDate,
    received_at: record.receivedAt,
    started_at: record.startedAt,
    closed_at: record.closedAt ?? null,
    status: record.status,
    initial_available_amount: record.initialAvailableAmount,
    previous_month_debt: record.previousMonthDebt,
    carried_statement_debt: record.carriedStatementDebt ?? 0,
    carried_statements: (record.carriedStatements ?? []).map((item) => ({
      card_id: item.cardId,
      statement_key: item.statementKey,
      amount: item.amount,
    })),
    final_balance: record.finalBalance ?? null,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function cycleFromRow(row: CycleRow): CycleRecord {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    receivedAt: row.received_at,
    startedAt: row.started_at,
    ...(row.closed_at ? { closedAt: row.closed_at } : {}),
    status: row.status,
    initialAvailableAmount: Number(row.initial_available_amount),
    previousMonthDebt: Number(row.previous_month_debt),
    ...(Number(row.carried_statement_debt ?? 0) > 0
      ? { carriedStatementDebt: Number(row.carried_statement_debt) }
      : {}),
    ...(row.carried_statements && row.carried_statements.length > 0
      ? {
          carriedStatements: row.carried_statements.map((item) => ({
            cardId: item.card_id,
            statementKey: item.statement_key,
            amount: Number(item.amount),
          })),
        }
      : {}),
    ...(row.final_balance !== null ? { finalBalance: Number(row.final_balance) } : {}),
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function expenseToRow(record: ExpenseRecord, userId: string): ExpenseRow {
  return {
    user_id: userId,
    id: record.id,
    cycle_id: record.cycleId,
    amount: record.amount,
    category: record.category,
    description: record.description,
    date: record.date,
    created_at: record.createdAt,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function expenseFromRow(row: ExpenseRow): ExpenseRecord {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    amount: Number(row.amount),
    category: row.category,
    description: row.description,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function creditCardToRow(record: CreditCardRecord, userId: string): CreditCardRow {
  return {
    user_id: userId,
    id: record.id,
    name: record.name,
    closing_day: record.closingDay,
    due_day: record.dueDay,
    credit_limit: record.creditLimit,
    active: record.active,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function creditCardFromRow(row: CreditCardRow): CreditCardRecord {
  return {
    id: row.id,
    name: row.name,
    closingDay: row.closing_day,
    dueDay: row.due_day,
    creditLimit:
      row.credit_limit === null || row.credit_limit === undefined ? null : Number(row.credit_limit),
    active: row.active ?? true,
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function cardPurchaseToRow(record: CardPurchaseRecord, userId: string): CardPurchaseRow {
  return {
    user_id: userId,
    id: record.id,
    card_id: record.cardId,
    description: record.description,
    category: record.category,
    total_amount: record.totalAmount,
    installments: record.installments,
    purchase_date: record.purchaseDate,
    first_cycle_key: record.firstCycleKey,
    first_statement_key: record.firstStatementKey,
    settled_installments: record.settledInstallments,
    origin: record.origin ?? null,
    kind: record.kind ?? null,
    included_in_balance: record.includedInStatementBalance === true,
    created_at: record.createdAt,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

/**
 * Linhas antigas (sem `first_statement_key`) derivam a fatura da data e do fechamento do cartão.
 * `closingDayOf` vem do estado local; sem o cartão, usa o maior fechamento possível.
 */
export function cardPurchaseFromRow(
  row: CardPurchaseRow,
  closingDayOf: (cardId: string) => number | undefined = () => undefined,
): CardPurchaseRecord {
  return {
    id: row.id,
    cardId: row.card_id,
    description: row.description,
    category: row.category,
    totalAmount: Number(row.total_amount),
    installments: row.installments,
    purchaseDate: row.purchase_date,
    firstCycleKey: row.first_cycle_key,
    firstStatementKey:
      row.first_statement_key ??
      statementKeyForDate(parseISO(row.purchase_date), closingDayOf(row.card_id) ?? MAX_CARD_DAY),
    settledInstallments: row.settled_installments ?? 0,
    ...(row.origin === 'existing' ? { origin: 'existing' as const } : {}),
    ...(row.kind === 'statement-balance' ? { kind: 'statement-balance' as const } : {}),
    ...(row.included_in_balance ? { includedInStatementBalance: true } : {}),
    createdAt: row.created_at,
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function fixedPaymentToRow(record: FixedPaymentRecord, userId: string): FixedPaymentRow {
  return {
    user_id: userId,
    id: record.id,
    cycle_id: record.cycleId,
    fixed_expense_id: record.fixedExpenseId,
    name: record.name,
    category: record.category,
    method: record.method,
    amount: record.amount,
    interest: record.interest,
    paid_at: record.paidAt,
    card_purchase_id: record.cardPurchaseId ?? null,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function fixedPaymentFromRow(row: FixedPaymentRow): FixedPaymentRecord {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    fixedExpenseId: row.fixed_expense_id,
    name: row.name,
    category: row.category,
    method: row.method,
    amount: Number(row.amount),
    interest: Number(row.interest),
    paidAt: row.paid_at,
    ...(row.card_purchase_id ? { cardPurchaseId: row.card_purchase_id } : {}),
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function extraIncomeToRow(record: ExtraIncomeRecord, userId: string): ExtraIncomeRow {
  return {
    user_id: userId,
    id: record.id,
    cycle_id: record.cycleId,
    name: record.name,
    amount: record.amount,
    date: record.date,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function extraIncomeFromRow(row: ExtraIncomeRow): ExtraIncomeRecord {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    name: row.name,
    amount: Number(row.amount),
    date: row.date,
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

export function statementPaymentToRow(
  record: StatementPaymentRecord,
  userId: string,
): StatementPaymentRow {
  return {
    user_id: userId,
    id: record.id,
    card_id: record.cardId,
    statement_key: record.statementKey,
    cycle_id: record.cycleId,
    statement_amount: record.statementAmount,
    paid_amount: record.paidAmount,
    charges: record.charges,
    paid_at: record.paidAt,
    client_updated_at: record.updatedAt,
    deleted_at: record.deletedAt,
  };
}

export function statementPaymentFromRow(row: StatementPaymentRow): StatementPaymentRecord {
  return {
    id: row.id,
    cardId: row.card_id,
    statementKey: row.statement_key,
    cycleId: row.cycle_id,
    statementAmount: Number(row.statement_amount),
    paidAmount: Number(row.paid_amount),
    charges:
      row.charges === undefined || row.charges === null
        ? Math.max(0, Number(row.paid_amount) - Number(row.statement_amount))
        : Number(row.charges),
    paidAt: row.paid_at,
    updatedAt: row.client_updated_at,
    deletedAt: row.deleted_at,
    dirty: false,
  };
}

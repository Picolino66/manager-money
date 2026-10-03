import {
  CycleRecord,
  ExpenseRecord,
  FixedExpenseRecord,
  SettingsRecord,
} from '../../application/state';
import { IncomeSource } from '../../domain/financial/financial.types';
import { legacyIncomeSources } from '../storage/migrations';
import { CycleRow, ExpenseRow, FixedExpenseRow, SettingsRow } from './types';

/** Mapeamento registro local ↔ linha remota (contracts.md §2). */

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
    }));
  }

  return legacyIncomeSources(Number(row.monthly_income));
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
    };
  }

  return {
    ...base,
    amount: record.amount,
    installment_amount: null,
    total_installments: null,
    remaining_installments: null,
    started_at_cycle_id: null,
  };
}

export function fixedExpenseFromRow(row: FixedExpenseRow): FixedExpenseRecord {
  const meta = { updatedAt: row.client_updated_at, deletedAt: row.deleted_at, dirty: false };

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

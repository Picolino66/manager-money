import { z } from 'zod';

import {
  MAX_CARD_DAY,
  MAX_CARD_INSTALLMENTS,
  MIN_CARD_DAY,
} from '@manager-money/core/domain/financial/credit-card';
import { MAX_PAYDAY, MIN_PAYDAY } from '@manager-money/core/domain/financial/financial.types';
import { LocalState, STATE_SCHEMA_VERSION } from '@manager-money/core/application/state';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const cents = z.number().int();
const monthKey = z.string().regex(/^\d{4}-\d{2}$/);

const syncMeta = {
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
  dirty: z.boolean(),
};

const settingsSchema = z.object({
  ...syncMeta,
  monthlyIncome: cents.min(0),
  incomeSources: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      amount: cents.min(0),
      payday: z.number().int().min(MIN_PAYDAY).max(MAX_PAYDAY),
      active: z.boolean().optional(),
    }),
  ),
  savingGoal: cents.min(0),
  payday: z.number().int().min(MIN_PAYDAY).max(MAX_PAYDAY),
  customCategories: z.array(z.string()),
});

const fixedExpenseSchema = z.discriminatedUnion('type', [
  z.object({
    ...syncMeta,
    id: z.string().min(1),
    type: z.literal('permanent'),
    name: z.string(),
    category: z.string(),
    amount: cents.min(0),
    active: z.boolean().optional(),
    recurringCardId: z.string().optional(),
  }),
  z.object({
    ...syncMeta,
    id: z.string().min(1),
    type: z.literal('installment'),
    name: z.string(),
    category: z.string(),
    installmentAmount: cents.min(0),
    totalInstallments: z.number().int().min(1),
    remainingInstallments: z.number().int().min(0),
    startedAtCycleId: z.string().optional(),
    active: z.boolean().optional(),
  }),
]);

const cycleSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
  receivedAt: z.string(),
  startedAt: z.string(),
  closedAt: z.string().optional(),
  status: z.enum(['active', 'closed']),
  initialAvailableAmount: cents,
  previousMonthDebt: cents.min(0),
  carriedStatementDebt: cents.min(0).optional(),
  carriedStatements: z
    .array(
      z.object({ cardId: z.string().min(1), statementKey: monthKey, amount: cents.positive() }),
    )
    .optional(),
  finalBalance: cents.optional(),
});

const expenseSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  cycleId: z.string().min(1),
  amount: cents,
  category: z.string(),
  description: z.string(),
  date: isoDate,
  createdAt: z.string(),
});

const creditCardSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  name: z.string().min(1),
  closingDay: z.number().int().min(MIN_CARD_DAY).max(MAX_CARD_DAY),
  dueDay: z.number().int().min(MIN_CARD_DAY).max(MAX_CARD_DAY),
  creditLimit: cents.min(0).nullable(),
  active: z.boolean(),
});

const cardPurchaseSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  cardId: z.string().min(1),
  description: z.string().min(1),
  category: z.string(),
  totalAmount: cents.positive(),
  installments: z.number().int().min(1).max(MAX_CARD_INSTALLMENTS),
  purchaseDate: isoDate,
  firstStatementKey: monthKey,
  firstCycleKey: monthKey,
  settledInstallments: z.number().int().min(0),
  origin: z.literal('existing').optional(),
  kind: z.literal('statement-balance').optional(),
  includedInStatementBalance: z.boolean().optional(),
  createdAt: z.string(),
});

const statementPaymentSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  cardId: z.string().min(1),
  statementKey: monthKey,
  cycleId: z.string().min(1),
  statementAmount: cents.min(0),
  paidAmount: cents.min(0),
  charges: cents.min(0),
  paidAt: isoDate,
});

const fixedPaymentSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  cycleId: z.string().min(1),
  fixedExpenseId: z.string().min(1),
  name: z.string(),
  category: z.string(),
  method: z.enum(['pix', 'cash', 'debit', 'credit']),
  amount: cents.min(0),
  interest: cents.min(0),
  paidAt: isoDate,
  cardPurchaseId: z.string().optional(),
});

const extraIncomeSchema = z.object({
  ...syncMeta,
  id: z.string().min(1),
  cycleId: z.string().min(1),
  name: z.string().min(1),
  amount: cents.positive(),
  date: isoDate,
});

const cursor = z.string().nullable();

/** Validação do documento local v2 (contracts.md §4). */
export const localStateSchema = z.object({
  schemaVersion: z.literal(STATE_SCHEMA_VERSION),
  settings: settingsSchema.nullable(),
  fixedExpenses: z.array(fixedExpenseSchema),
  creditCards: z.array(creditCardSchema),
  cycles: z.array(cycleSchema),
  expenses: z.array(expenseSchema),
  cardPurchases: z.array(cardPurchaseSchema),
  fixedPayments: z.array(fixedPaymentSchema),
  extraIncomes: z.array(extraIncomeSchema),
  statementPayments: z.array(statementPaymentSchema),
  sync: z.object({
    userId: z.string().nullable(),
    cursors: z.object({
      settings: cursor,
      fixed_expenses: cursor,
      credit_cards: cursor,
      cycles: cursor,
      expenses: cursor,
      card_purchases: cursor,
      fixed_payments: cursor,
      extra_incomes: cursor,
      statement_payments: cursor,
    }),
    lastSyncAt: z.string().nullable(),
    lastError: z.string().nullable(),
  }),
}) satisfies z.ZodType<LocalState>;

export function parseLocalState(value: unknown): LocalState {
  return localStateSchema.parse(value) as LocalState;
}

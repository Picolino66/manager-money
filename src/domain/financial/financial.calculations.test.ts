import assert from 'node:assert/strict';

import {
  buildDashboardSummary,
  buildFinancialCycleDates,
  buildLegacyFinancialCycleDates,
  advanceInstallmentExpenses,
  calculateBaseAvailableAmount,
  calculateFixedExpenseAmount,
  calculateCycleEndDate,
  calculateDayStatus,
  calculateDefaultCycleStartDate,
  calculateFinalBalance,
  calculateFixedExpensesTotal,
  calculateInitialAvailableAmount,
  calculatePreviousMonthDebt,
  calculateRemainingDays,
  calculateTodayBalance,
  canReceiveIncomeEarly,
  startPendingInstallmentExpenses,
} from './financial.calculations';
import { FinancialConfig, FinancialMonth } from './financial.types';
import { toISODate } from '../../utils/date';

const config: FinancialConfig = {
  monthlyIncome: 880000,
  fixedExpenses: [
    { id: 'fixed-1', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 300000 },
    { id: 'fixed-2', type: 'permanent', name: 'Internet', category: 'Assinatura', amount: 118000 },
  ],
  customCategories: [],
  savingGoal: 150000,
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const baseMonth: FinancialMonth = {
  id: '2026-04-cycle',
  startDate: '2026-04-07',
  endDate: '2026-05-06',
  receivedAt: '2026-04-07T03:00:00.000Z',
  startedAt: '2026-04-07T03:00:00.000Z',
  status: 'active',
  initialAvailableAmount: 312000,
  previousMonthDebt: 0,
  expenses: [],
};

assert.equal(calculateFixedExpensesTotal(config), 418000);
assert.equal(calculateBaseAvailableAmount(config), 312000);
assert.equal(calculateInitialAvailableAmount(config, 0), 312000);

const installmentConfig: FinancialConfig = {
  ...config,
  fixedExpenses: [
    ...config.fixedExpenses,
    {
      id: 'installment-1',
      type: 'installment',
      name: 'Notebook',
      category: 'Educação',
      installmentAmount: 10000,
      totalInstallments: 10,
      remainingInstallments: 10,
    },
  ],
};
const startedInstallmentConfig = startPendingInstallmentExpenses(installmentConfig, 'cycle-1');
const activeInstallment = startedInstallmentConfig.fixedExpenses.find(
  (expense) => expense.id === 'installment-1',
);
assert.equal(activeInstallment?.type, 'installment');
assert.equal(
  activeInstallment?.type === 'installment' ? activeInstallment.startedAtCycleId : undefined,
  'cycle-1',
);
assert.equal(calculateFixedExpensesTotal(startedInstallmentConfig), 428000);
assert.equal(calculateBaseAvailableAmount(startedInstallmentConfig), 302000);

const advancedInstallmentConfig = advanceInstallmentExpenses(startedInstallmentConfig);
const advancedInstallment = advancedInstallmentConfig.fixedExpenses.find(
  (expense) => expense.id === 'installment-1',
);
assert.equal(
  advancedInstallment?.type === 'installment'
    ? advancedInstallment.remainingInstallments
    : undefined,
  9,
);
assert.equal(calculateFixedExpenseAmount({
  id: 'installment-finished',
  type: 'installment',
  name: 'Finalizado',
  category: 'Outros',
  installmentAmount: 10000,
  totalInstallments: 10,
  remainingInstallments: 0,
}), 0);
assert.equal(toISODate(calculateDefaultCycleStartDate(new Date(2026, 3, 25))), '2026-04-07');
assert.equal(toISODate(calculateDefaultCycleStartDate(new Date(2026, 3, 3))), '2026-03-07');
assert.equal(toISODate(calculateCycleEndDate(new Date(2026, 3, 7))), '2026-05-06');
assert.equal(toISODate(calculateCycleEndDate(new Date(2026, 3, 3))), '2026-05-06');
assert.equal(buildFinancialCycleDates(new Date(2026, 3, 3)).startDate, '2026-04-03');
assert.equal(buildFinancialCycleDates(new Date(2026, 3, 3)).endDate, '2026-05-06');
assert.deepEqual(buildLegacyFinancialCycleDates(2026, 4), {
  startDate: '2026-04-07',
  endDate: '2026-05-06',
  receivedAt: new Date(2026, 3, 7).toISOString(),
});
assert.equal(canReceiveIncomeEarly(new Date(2026, 3, 6)), true);
assert.equal(canReceiveIncomeEarly(new Date(2026, 3, 7)), false);
assert.equal(calculateRemainingDays(baseMonth, new Date(2026, 3, 6)), 30);
assert.equal(calculateRemainingDays(baseMonth, new Date(2026, 3, 7)), 30);
assert.equal(calculateRemainingDays(baseMonth, new Date(2026, 4, 6)), 1);
assert.equal(calculateRemainingDays(baseMonth, new Date(2026, 4, 7)), 0);
assert.equal(buildDashboardSummary(baseMonth, new Date(2026, 3, 7)).currentDailyLimit, 10400);
assert.equal(buildDashboardSummary(baseMonth, new Date(2026, 3, 7)).cycleLabel, '07/04 a 06/05');
assert.equal(calculateTodayBalance(10400, 2000), 8400);

const excessMonth: FinancialMonth = {
  ...baseMonth,
  initialAvailableAmount: 100000,
  expenses: [
    {
      id: 'expense-1',
      amount: 15000,
      category: 'Alimentação',
      description: 'Mercado',
      date: '2026-04-20',
      createdAt: '2026-04-20T12:00:00.000Z',
    },
  ],
};

const excessSummary = buildDashboardSummary(excessMonth, new Date(2026, 3, 21));
assert.equal(excessSummary.currentDailyLimit, 5312);

const negativeMonth: FinancialMonth = {
  ...baseMonth,
  status: 'closed',
  finalBalance: -30000,
};

const positiveMonth: FinancialMonth = {
  ...baseMonth,
  status: 'closed',
  finalBalance: 30000,
};

assert.equal(calculatePreviousMonthDebt(negativeMonth), 30000);
assert.equal(calculatePreviousMonthDebt(positiveMonth), 0);
assert.equal(calculateFinalBalance({ ...baseMonth, expenses: [{ id: '1', amount: 312000, category: 'Outros', description: 'Tudo', date: '2026-04-30', createdAt: '2026-04-30T00:00:00.000Z' }] }), 0);
assert.equal(calculateDayStatus(8000, 10000), 'healthy');
assert.equal(calculateDayStatus(5000, 10000), 'warning');
assert.equal(calculateDayStatus(1000, 10000), 'critical');
assert.equal(calculateDayStatus(-100, 10000), 'negative');

console.log('financial.calculations.test.ts passed');

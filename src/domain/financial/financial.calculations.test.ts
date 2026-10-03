import {
  buildDashboardSummary,
  buildFinancialCycleDates,
  buildLegacyFinancialCycleDates,
  calculateBaseAvailableAmount,
  calculateCycleEndDate,
  calculateDailyLimit,
  calculateDayBalance,
  calculateDayStatus,
  calculateDefaultCycleStartDate,
  calculateExpensesByCategory,
  calculateFinalBalance,
  calculateFixedExpenseAmount,
  calculateFixedExpensesTotal,
  calculateInitialAvailableAmount,
  calculatePercentageRemaining,
  calculatePreviousMonthDebt,
  calculateRemainingDays,
  calculateTodayBalance,
  canCloseCycle,
  canReceiveIncomeEarly,
  canReceiveIncomeEarlyForCycle,
  describeCloseCycleBlock,
  getAvailableCategories,
  getSortedCategories,
  normalizeCategory,
} from './financial.calculations';
import { FinancialConfig, FinancialMonth } from './financial.types';
import { toISODate } from '../../utils/date';

const config: FinancialConfig = {
  monthlyIncome: 880000,
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 880000 }],
  payday: 7,
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

const expense = (id: string, amount: number, date: string, category = 'Outros') => ({
  id,
  amount,
  category,
  description: id,
  date,
  createdAt: `${date}T12:00:00.000Z`,
});

const iso = (date: Date) => toISODate(date);

describe('saldo base e fixos (BR-FIN-004, BR-FIN-005, BR-FIN-010)', () => {
  it('soma fixos e desconta a meta', () => {
    expect(calculateFixedExpensesTotal(config)).toBe(418000);
    expect(calculateBaseAvailableAmount(config)).toBe(312000);
    expect(calculateInitialAvailableAmount(config, 0)).toBe(312000);
    expect(calculateInitialAvailableAmount(config, 12000)).toBe(300000);
  });

  it('parcelamento conta enquanto houver parcelas restantes', () => {
    const installment = {
      id: 'i',
      type: 'installment' as const,
      name: 'Notebook',
      category: 'Educação',
      installmentAmount: 10000,
      totalInstallments: 10,
      remainingInstallments: 1,
    };
    expect(calculateFixedExpenseAmount(installment)).toBe(10000);
    expect(calculateFixedExpenseAmount({ ...installment, remainingInstallments: 0 })).toBe(0);
  });
});

describe('datas do ciclo com payday 7 (regressão do MVP)', () => {
  it('início padrão e fim', () => {
    expect(iso(calculateDefaultCycleStartDate(new Date(2026, 3, 25)))).toBe('2026-04-07');
    expect(iso(calculateDefaultCycleStartDate(new Date(2026, 3, 3)))).toBe('2026-03-07');
    expect(iso(calculateCycleEndDate(new Date(2026, 3, 7)))).toBe('2026-05-06');
    expect(iso(calculateCycleEndDate(new Date(2026, 3, 3)))).toBe('2026-05-06');
  });

  it('ciclo antecipado começa na data de recebimento', () => {
    expect(buildFinancialCycleDates(new Date(2026, 3, 3))).toMatchObject({
      startDate: '2026-04-03',
      endDate: '2026-05-06',
    });
  });

  it('ciclo legado por mês civil', () => {
    expect(buildLegacyFinancialCycleDates(2026, 4)).toEqual({
      startDate: '2026-04-07',
      endDate: '2026-05-06',
      receivedAt: new Date(2026, 3, 7).toISOString(),
    });
  });

  it('sem data informada usa o início padrão de hoje', () => {
    expect(buildFinancialCycleDates().startDate).toBe(iso(calculateDefaultCycleStartDate(new Date())));
  });
});

describe('payday configurável (SPEC-001)', () => {
  it('payday 1 é o mês civil e não tem antecipação', () => {
    expect(buildFinancialCycleDates(new Date(2026, 3, 1), 1)).toMatchObject({
      startDate: '2026-04-01',
      endDate: '2026-04-30',
    });
    expect(canReceiveIncomeEarly(new Date(2026, 3, 1), 1)).toBe(false);
  });

  it('payday 15', () => {
    const start = calculateDefaultCycleStartDate(new Date(2026, 3, 10), 15);
    expect(iso(start)).toBe('2026-03-15');
    expect(iso(calculateCycleEndDate(start, 15))).toBe('2026-04-14');
  });

  it('payday 28 atravessa fevereiro', () => {
    expect(iso(calculateCycleEndDate(new Date(2026, 0, 28), 28))).toBe('2026-02-27');
  });
});

describe('recebimento antecipado (BR-FIN-003, BR-FIN-016)', () => {
  it('janela antes do dia de pagamento', () => {
    expect(canReceiveIncomeEarly(new Date(2026, 3, 6))).toBe(true);
    expect(canReceiveIncomeEarly(new Date(2026, 3, 7))).toBe(false);
  });

  it('permite para o ciclo que termina antes do próximo pagamento', () => {
    const cycle = { startDate: '2026-10-07', endDate: '2026-11-06' };
    expect(canReceiveIncomeEarlyForCycle(cycle, new Date(2026, 10, 3), 7)).toBe(true);
  });

  it('bloqueia o segundo acionamento no mesmo período (DEF-001)', () => {
    const earlyCycle = { startDate: '2026-11-03', endDate: '2026-12-06' };
    expect(canReceiveIncomeEarlyForCycle(earlyCycle, new Date(2026, 10, 4), 7)).toBe(false);
    expect(canReceiveIncomeEarlyForCycle(earlyCycle, new Date(2026, 10, 3), 7)).toBe(false);
  });

  it('bloqueia fora da janela', () => {
    const cycle = { startDate: '2026-10-07', endDate: '2026-11-06' };
    expect(canReceiveIncomeEarlyForCycle(cycle, new Date(2026, 10, 8), 7)).toBe(false);
  });
});

describe('fechamento (BR-FIN-017)', () => {
  it('só depois do fim do período', () => {
    expect(canCloseCycle(baseMonth, new Date(2026, 4, 6))).toBe(false);
    expect(canCloseCycle(baseMonth, new Date(2026, 4, 7))).toBe(true);
    expect(describeCloseCycleBlock(baseMonth)).toContain('06/05');
  });
});

describe('limite diário e status (BR-FIN-007..009)', () => {
  it('dias restantes', () => {
    expect(calculateRemainingDays(baseMonth, new Date(2026, 3, 6))).toBe(30);
    expect(calculateRemainingDays(baseMonth, new Date(2026, 3, 7))).toBe(30);
    expect(calculateRemainingDays(baseMonth, new Date(2026, 4, 6))).toBe(1);
    expect(calculateRemainingDays(baseMonth, new Date(2026, 4, 7))).toBe(0);
  });

  it('limite sem dias restantes é o saldo inteiro', () => {
    expect(calculateDailyLimit(5000, 0)).toBe(5000);
  });

  it('resumo do dia', () => {
    const summary = buildDashboardSummary(baseMonth, new Date(2026, 3, 7));
    expect(summary.currentDailyLimit).toBe(10400);
    expect(summary.cycleLabel).toBe('07/04 a 06/05');
    expect(calculateTodayBalance(10400, 2000)).toBe(8400);
  });

  it('gasto acima do limite reduz os dias seguintes', () => {
    const month = { ...baseMonth, initialAvailableAmount: 100000, expenses: [expense('e1', 15000, '2026-04-20')] };
    expect(buildDashboardSummary(month, new Date(2026, 3, 21)).currentDailyLimit).toBe(5312);
    expect(calculateDayBalance(month, new Date(2026, 3, 20))).toBeLessThan(0);
  });

  it('status do dia', () => {
    expect(calculateDayStatus(8000, 10000)).toBe('healthy');
    expect(calculateDayStatus(5000, 10000)).toBe('warning');
    expect(calculateDayStatus(1000, 10000)).toBe('critical');
    expect(calculateDayStatus(-100, 10000)).toBe('negative');
    expect(calculatePercentageRemaining(0, 0)).toBe(1);
    expect(calculatePercentageRemaining(-1, 0)).toBe(-1);
  });
});

describe('dívida herdada e saldo final (BR-FIN-006)', () => {
  it('só déficit é herdado', () => {
    expect(calculatePreviousMonthDebt({ ...baseMonth, status: 'closed', finalBalance: -30000 })).toBe(30000);
    expect(calculatePreviousMonthDebt({ ...baseMonth, status: 'closed', finalBalance: 30000 })).toBe(0);
    expect(calculatePreviousMonthDebt(undefined)).toBe(0);
  });

  it('saldo final', () => {
    expect(calculateFinalBalance({ ...baseMonth, expenses: [expense('1', 312000, '2026-04-30')] })).toBe(0);
  });
});

describe('categorias (BR-FIN-012)', () => {
  it('normaliza e agrega', () => {
    expect(normalizeCategory('  ')).toBe('Outros');
    expect(normalizeCategory(' Viagem ')).toBe('Viagem');
    expect(getAvailableCategories({ customCategories: ['Viagem', 'Moradia'] })).toContain('Viagem');
    expect(getAvailableCategories({ customCategories: ['Moradia'] }).filter((c) => c === 'Moradia')).toHaveLength(1);
    expect(getSortedCategories(null)[0]).toBe('Alimentação');
    expect(
      calculateExpensesByCategory([expense('a', 100, '2026-04-08', 'Lazer'), expense('b', 50, '2026-04-08', 'Lazer')]),
    ).toEqual({ Lazer: 150 });
  });
});

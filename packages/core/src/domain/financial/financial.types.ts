export type MoneyCents = number;

/** Dia de pagamento padrão (compatível com o MVP). Ver BR-FIN-002. */
export const DEFAULT_PAYDAY = 7;
export const MIN_PAYDAY = 1;
export const MAX_PAYDAY = 28;

export const DEFAULT_EXPENSE_CATEGORY = 'Outros';

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Dívida',
  'Saúde',
  'Assinatura',
  'Pessoal',
  'Lazer',
  'Educação',
  'Namoro',
  DEFAULT_EXPENSE_CATEGORY,
] as const;

export type ExpenseCategory = string;

/** Fonte de renda, despesa fixa ou cartão ativo: ausente conta como ativo (compatibilidade). */
export function isActive(item: { active?: boolean }): boolean {
  return item.active !== false;
}

export type MonthStatus = 'active' | 'closed';

export type DayStatus = 'healthy' | 'warning' | 'critical' | 'negative';

export type Expense = {
  id: string;
  amount: MoneyCents;
  category: ExpenseCategory;
  description: string;
  date: string;
  createdAt: string;
};

export type PermanentFixedExpense = {
  id: string;
  type: 'permanent';
  name: string;
  category: ExpenseCategory;
  amount: MoneyCents;
  /** Inativa não entra no ciclo nem na projeção. Ausente = ativa (dados antigos). */
  active?: boolean;
  /**
   * Recorrente no cartão de crédito (BR-FIN-035): a cada virada da fatura desse cartão, a fixa é cobrada sozinha nele
   * cartão (1 parcela, sem juros). Ausente = pagamento manual, como antes.
   */
  recurringCardId?: string;
};

export type InstallmentFixedExpense = {
  id: string;
  type: 'installment';
  name: string;
  category: ExpenseCategory;
  installmentAmount: MoneyCents;
  totalInstallments: number;
  remainingInstallments: number;
  startedAtCycleId?: string;
  /** Inativa não entra no ciclo nem na projeção. Ausente = ativa (dados antigos). */
  active?: boolean;
};

export type FixedExpense = PermanentFixedExpense | InstallmentFixedExpense;

/** Fonte de renda mensal (ex.: salário, freela). Ver BR-FIN-018. */
export type IncomeSource = {
  id: string;
  name: string;
  amount: MoneyCents;
  /** Dia do mês em que a fonte paga (1–28). O ciclo usa o da fonte de maior valor (BR-FIN-024). */
  payday: number;
  /** Inativa não soma à renda nem define o ciclo. Ausente = ativa (dados antigos). */
  active?: boolean;
};

export type FinancialConfig = {
  /** Soma das fontes de renda ativas (derivado de `incomeSources`). */
  monthlyIncome: MoneyCents;
  incomeSources: IncomeSource[];
  /** Dia do mês em que a renda cai (1–28). Derivado: dia da fonte ativa de maior valor (BR-FIN-024). */
  payday: number;
  fixedExpenses: FixedExpense[];
  customCategories: ExpenseCategory[];
  savingGoal: MoneyCents;
  updatedAt: string;
};

export type FinancialMonth = {
  id: string;
  startDate: string;
  endDate: string;
  receivedAt: string;
  startedAt: string;
  closedAt?: string;
  status: MonthStatus;
  initialAvailableAmount: MoneyCents;
  previousMonthDebt: MoneyCents;
  /**
   * Restante de faturas pagas parcialmente que veio do ciclo anterior e fica reservado neste
   * (BR-FIN-034). Ausente = 0.
   */
  carriedStatementDebt?: MoneyCents;
  /** Ciclo fechado: restante de faturas parciais transportado para o próximo ciclo (BR-FIN-034). */
  carriedStatements?: CarriedStatement[];
  finalBalance?: MoneyCents;
  expenses: Expense[];
};

/** Restante de uma fatura paga parcialmente, transportado de um ciclo para o seguinte. */
export type CarriedStatement = {
  cardId: string;
  statementKey: string;
  amount: MoneyCents;
};

export type DashboardSummary = {
  cycleLabel: string;
  initialAvailableAmount: MoneyCents;
  remainingAvailableAmount: MoneyCents;
  totalSpent: MoneyCents;
  currentDailyLimit: MoneyCents;
  todaySpent: MoneyCents;
  todayBalance: MoneyCents;
  percentageRemaining: number;
  dayStatus: DayStatus;
  remainingDays: number;
};

export type FinancialConfigInput = Omit<FinancialConfig, 'updatedAt' | 'monthlyIncome' | 'payday'>;

export type ExpenseInput = Pick<Expense, 'amount' | 'category' | 'description' | 'date'>;

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
};

export type FixedExpense = PermanentFixedExpense | InstallmentFixedExpense;

export type FinancialConfig = {
  monthlyIncome: MoneyCents;
  /** Dia do mês em que a renda cai (1–28). Define início e fim do ciclo. */
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
  finalBalance?: MoneyCents;
  expenses: Expense[];
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

export type FinancialConfigInput = Omit<FinancialConfig, 'updatedAt'>;

export type ExpenseInput = Pick<Expense, 'amount' | 'category' | 'description' | 'date'>;

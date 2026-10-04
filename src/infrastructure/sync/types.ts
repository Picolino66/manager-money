import { SyncTable } from '../../application/state';

/** Versão do contrato remoto (docs/architecture/contracts.md). */
export const CONTRACT_VERSION = 'v1';

type RowMeta = {
  user_id: string;
  client_updated_at: string;
  deleted_at: string | null;
  /** Preenchido pelo servidor (trigger); ausente nas linhas enviadas. */
  server_updated_at?: string;
};

export type SettingsRow = RowMeta & {
  monthly_income: number;
  /** Fontes de renda (contrato v1, aditivo). Ausente em linhas antigas. */
  income_sources?: {
    id: string;
    name: string;
    amount: number;
    payday?: number;
    active?: boolean;
  }[];
  saving_goal: number;
  payday: number;
  custom_categories: string[];
};

export type FixedExpenseRow = RowMeta & {
  id: string;
  kind: 'permanent' | 'installment';
  name: string;
  category: string;
  amount: number | null;
  installment_amount: number | null;
  total_installments: number | null;
  remaining_installments: number | null;
  started_at_cycle_id: string | null;
  /** Contrato v1 aditivo (ADR-017): ausente em linhas antigas = ativa. */
  active?: boolean;
};

export type CreditCardRow = RowMeta & {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  /** Contrato v1 aditivo (ADR-017): ausente/nulo em linhas antigas. */
  credit_limit?: number | null;
  active?: boolean;
};

export type CardPurchaseRow = RowMeta & {
  id: string;
  card_id: string;
  description: string;
  category: string;
  total_amount: number;
  installments: number;
  purchase_date: string;
  first_cycle_key: string;
  /** Contrato v1 aditivo (ADR-017): nulo em linhas antigas. */
  first_statement_key?: string | null;
  settled_installments?: number;
  /** `existing` = situação inicial; nulo/ausente = compra feita no app. */
  origin?: 'existing' | null;
  created_at: string;
};

export type StatementPaymentRow = RowMeta & {
  id: string;
  card_id: string;
  statement_key: string;
  cycle_id: string;
  statement_amount: number;
  paid_amount: number;
  paid_at: string;
};

export type FixedPaymentRow = RowMeta & {
  id: string;
  cycle_id: string;
  fixed_expense_id: string;
  name: string;
  category: string;
  method: 'pix' | 'cash' | 'debit' | 'credit';
  amount: number;
  interest: number;
  paid_at: string;
  card_purchase_id: string | null;
};

export type ExtraIncomeRow = RowMeta & {
  id: string;
  cycle_id: string;
  name: string;
  amount: number;
  date: string;
};

export type CycleRow = RowMeta & {
  id: string;
  start_date: string;
  end_date: string;
  received_at: string;
  started_at: string;
  closed_at: string | null;
  status: 'active' | 'closed';
  initial_available_amount: number;
  previous_month_debt: number;
  final_balance: number | null;
};

export type ExpenseRow = RowMeta & {
  id: string;
  cycle_id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_at: string;
};

export type RowByTable = {
  settings: SettingsRow;
  fixed_expenses: FixedExpenseRow;
  credit_cards: CreditCardRow;
  cycles: CycleRow;
  expenses: ExpenseRow;
  card_purchases: CardPurchaseRow;
  fixed_payments: FixedPaymentRow;
  extra_incomes: ExtraIncomeRow;
  statement_payments: StatementPaymentRow;
};

export type RemoteRow = RowByTable[SyncTable];

export type SyncErrorCode = 'conflict-active-cycle' | 'auth' | 'network' | 'unknown';

export class SyncError extends Error {
  constructor(
    public readonly code: SyncErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** Porta de saída do sync (ADR-004). Implementações: Supabase e memória (testes). */
export interface SyncRemote {
  upsert<T extends SyncTable>(table: T, rows: RowByTable[T][]): Promise<void>;
  /** Linhas com `server_updated_at` posterior ao cursor (com janela de segurança), em ordem crescente. */
  pull<T extends SyncTable>(table: T, since: string | null): Promise<RowByTable[T][]>;
  hasData(): Promise<boolean>;
  markAllDeleted(nowIso: string): Promise<void>;
  deleteAccount(): Promise<void>;
}

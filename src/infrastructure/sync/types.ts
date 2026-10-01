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
  cycles: CycleRow;
  expenses: ExpenseRow;
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

import { LocalState, SYNC_TABLES, SyncTable } from '@manager-money/core/application/state';
import { collectDirty } from '@manager-money/core/contract/dirty';
import { RemoteRow, RowByTable, SyncError } from '@manager-money/core/contract/types';

import type { AuthChange, AuthGateway, AuthUser } from '../infrastructure/auth';
import { AuthFailure } from '../infrastructure/auth';
import type { RemoteGateway } from '../infrastructure/remote';

type Rows = { [T in SyncTable]: RowByTable[T][] };

const key = (table: SyncTable, row: RemoteRow) =>
  table === 'settings' ? row.user_id : (row as { id: string }).id;

/**
 * Supabase em memória para testes: RLS por usuário implícita (um usuário), exclusão lógica e o
 * índice único `cycles_one_active_per_user` verificado linha a linha, como no Postgres.
 */
export class MemoryGateway implements RemoteGateway {
  rows: Rows = Object.fromEntries(SYNC_TABLES.map((table) => [table, []])) as unknown as Rows;
  upserts: { table: SyncTable; count: number }[] = [];
  failOn: { table: SyncTable; error: Error } | null = null;
  failSelect: Error | null = null;

  async selectLive<T extends SyncTable>(table: T): Promise<RowByTable[T][]> {
    if (this.failSelect) throw this.failSelect;
    return (this.rows[table] as RowByTable[T][]).filter((row) => row.deleted_at === null);
  }

  async upsert<T extends SyncTable>(table: T, rows: RowByTable[T][]): Promise<void> {
    if (this.failOn?.table === table) throw this.failOn.error;

    const current = [...this.rows[table]] as RemoteRow[];
    for (const row of rows) {
      const index = current.findIndex((existing) => key(table, existing) === key(table, row));
      if (index >= 0) current[index] = row;
      else current.push(row);

      if (table === 'cycles') {
        const active = (current as RowByTable['cycles'][]).filter(
          (cycle) => cycle.status === 'active' && cycle.deleted_at === null,
        );
        if (active.length > 1) {
          throw new SyncError('conflict-active-cycle', 'cycles_one_active_per_user');
        }
      }
    }

    (this.rows[table] as RemoteRow[]) = current;
    this.upserts.push({ table, count: rows.length });
  }

  /** Grava o estado produzido por casos de uso (todos os registros marcados). */
  seed(state: LocalState, userId: string) {
    for (const table of SYNC_TABLES) {
      const { rows } = collectDirty(state, table, userId);
      (this.rows[table] as RemoteRow[]).push(...rows);
    }
  }
}

export class FakeAuth implements AuthGateway {
  user: AuthUser | null = null;
  refreshResult = true;
  failure: AuthFailure | null = null;
  signOutCalls = 0;
  private listeners: ((change: AuthChange) => void)[] = [];

  async currentUser() {
    return this.user;
  }

  onChange(listener: (change: AuthChange) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }

  emit(change: AuthChange) {
    for (const listener of this.listeners) listener(change);
  }

  async signIn(email: string) {
    if (this.failure) throw this.failure;
    this.user = { userId: `user-${email}` };
    return this.user;
  }

  async signUp(email: string) {
    return this.signIn(email);
  }

  async signOut() {
    this.signOutCalls += 1;
    this.user = null;
  }

  async refresh() {
    return this.refreshResult;
  }
}

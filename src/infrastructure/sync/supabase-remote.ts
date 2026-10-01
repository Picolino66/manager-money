import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { SyncTable } from '../../application/state';
import { RowByTable, SyncError, SyncRemote } from './types';

const PAGE_SIZE = 500;
/** Janela de segurança do pull: cobre commits concorrentes fora de ordem (contracts.md §3). */
const PULL_OVERLAP_MS = 5_000;

export function mapSupabaseError(error: Pick<PostgrestError, 'code' | 'message'>): SyncError {
  if (error.code === '23505' && error.message.includes('cycles_one_active_per_user')) {
    return new SyncError('conflict-active-cycle', error.message);
  }

  if (error.code === '42501' || error.code === 'PGRST301' || error.code === 'PGRST303') {
    return new SyncError('auth', error.message);
  }

  if (/network|fetch|timeout/i.test(error.message)) {
    return new SyncError('network', error.message);
  }

  return new SyncError('unknown', error.message);
}

export function pullSince(cursor: string | null): string | null {
  return cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : null;
}

/** Implementação Supabase da porta de sync (ADR-002 / ADR-004). */
export class SupabaseRemote implements SyncRemote {
  constructor(private readonly client: SupabaseClient) {}

  private async run<T>(promise: PromiseLike<{ data: T; error: PostgrestError | null }>): Promise<T> {
    let result: { data: T; error: PostgrestError | null };

    try {
      result = await promise;
    } catch (error) {
      throw new SyncError('network', error instanceof Error ? error.message : String(error));
    }

    if (result.error) throw mapSupabaseError(result.error);

    return result.data;
  }

  async upsert<T extends SyncTable>(table: T, rows: RowByTable[T][]): Promise<void> {
    const onConflict = table === 'settings' ? 'user_id' : 'user_id,id';
    await this.run(this.client.from(table).upsert(rows, { onConflict }));
  }

  async pull<T extends SyncTable>(table: T, since: string | null): Promise<RowByTable[T][]> {
    const rows: RowByTable[T][] = [];
    let cursor = pullSince(since);

    for (;;) {
      let query = this.client
        .from(table)
        .select('*')
        .order('server_updated_at', { ascending: true })
        .limit(PAGE_SIZE);

      if (cursor) query = query.gt('server_updated_at', cursor);

      const page = (await this.run(query)) as RowByTable[T][];
      rows.push(...page);

      if (page.length < PAGE_SIZE) return rows;

      cursor = page[page.length - 1]?.server_updated_at ?? cursor;
    }
  }

  async hasData(): Promise<boolean> {
    for (const table of ['settings', 'cycles'] as const) {
      const { count, error } = await this.client
        .from(table)
        .select('user_id', { count: 'exact', head: true })
        .is('deleted_at', null);

      if (error) throw mapSupabaseError(error);
      if ((count ?? 0) > 0) return true;
    }

    return false;
  }

  async markAllDeleted(nowIso: string): Promise<void> {
    for (const table of ['expenses', 'cycles', 'fixed_expenses', 'settings'] as const) {
      await this.run(
        this.client
          .from(table)
          .update({ deleted_at: nowIso, client_updated_at: nowIso })
          .is('deleted_at', null),
      );
    }
  }

  async deleteAccount(): Promise<void> {
    await this.run(this.client.rpc('delete_my_account'));
  }
}

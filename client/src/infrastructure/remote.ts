import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

import { SyncTable } from '@manager-money/core/application/state';
import { mapSupabaseError } from '@manager-money/core/contract/errors';
import { RowByTable, SyncError } from '@manager-money/core/contract/types';

/**
 * Porta de acesso ao Supabase do client web (sem sync, ADR-020): ler as linhas vivas do usuário e
 * gravar (upsert) linhas alteradas. A RLS restringe tudo ao `auth.uid()` da sessão.
 */
export interface RemoteGateway {
  selectLive<T extends SyncTable>(table: T): Promise<RowByTable[T][]>;
  upsert<T extends SyncTable>(table: T, rows: RowByTable[T][]): Promise<void>;
}

/** Limite padrão de linhas por requisição do PostgREST. */
export const PAGE_SIZE = 1000;

export class SupabaseGateway implements RemoteGateway {
  constructor(private readonly client: SupabaseClient) {}

  private async run<T>(
    promise: PromiseLike<{ data: T; error: PostgrestError | null }>,
  ): Promise<T> {
    let result: { data: T; error: PostgrestError | null };

    try {
      result = await promise;
    } catch (error) {
      throw new SyncError('network', error instanceof Error ? error.message : String(error));
    }

    if (result.error) throw mapSupabaseError(result.error);

    return result.data;
  }

  async selectLive<T extends SyncTable>(table: T): Promise<RowByTable[T][]> {
    const rows: RowByTable[T][] = [];
    // Ordem estável para paginar por faixa; `settings` tem uma linha por usuário.
    const orderBy = table === 'settings' ? 'user_id' : 'id';

    for (let from = 0; ; from += PAGE_SIZE) {
      const page = (await this.run(
        this.client
          .from(table)
          .select('*')
          .is('deleted_at', null)
          .order(orderBy, { ascending: true })
          .range(from, from + PAGE_SIZE - 1),
      )) as RowByTable[T][];

      rows.push(...page);
      if (page.length < PAGE_SIZE) return rows;
    }
  }

  async upsert<T extends SyncTable>(table: T, rows: RowByTable[T][]): Promise<void> {
    const onConflict = table === 'settings' ? 'user_id' : 'user_id,id';
    await this.run(this.client.from(table).upsert(rows, { onConflict }));
  }
}

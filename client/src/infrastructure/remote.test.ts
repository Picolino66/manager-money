import type { SupabaseClient } from '@supabase/supabase-js';

import { SyncError } from '@manager-money/core/contract/types';

import { PAGE_SIZE, SupabaseGateway } from './remote';

type Result = { data?: unknown; error?: { code: string; message: string } | null };

/** Query builder falso: registra a cadeia de chamadas e resolve com o próximo resultado. */
function fakeClient(results: (Result | Error)[]) {
  const calls: unknown[][] = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'upsert', 'order', 'range', 'is']) {
      chain[method] = (...args: unknown[]) => {
        calls.push([table, method, ...args]);
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
      const next = results.shift();
      if (next instanceof Error) reject(next);
      else resolve({ data: next?.data ?? null, error: next?.error ?? null });
    };
    return chain;
  };

  return { client: { from: builder } as unknown as SupabaseClient, calls };
}

describe('SupabaseGateway', () => {
  it('lê só linhas vivas, paginando até a última página', async () => {
    const full = Array.from({ length: PAGE_SIZE }, (_, index) => ({ id: `e${index}` }));
    const { client, calls } = fakeClient([{ data: full }, { data: [{ id: 'last' }] }]);

    const rows = await new SupabaseGateway(client).selectLive('expenses');

    expect(rows).toHaveLength(PAGE_SIZE + 1);
    expect(calls).toContainEqual(['expenses', 'is', 'deleted_at', null]);
    expect(calls).toContainEqual(['expenses', 'range', PAGE_SIZE, 2 * PAGE_SIZE - 1]);
  });

  it('settings ordena por usuário e faz upsert por user_id', async () => {
    const { client, calls } = fakeClient([{ data: [] }, { data: null }]);
    const gateway = new SupabaseGateway(client);

    await gateway.selectLive('settings');
    await gateway.upsert('settings', []);

    expect(calls).toContainEqual(['settings', 'order', 'user_id', { ascending: true }]);
    expect(calls).toContainEqual(['settings', 'upsert', [], { onConflict: 'user_id' }]);
  });

  it('demais tabelas fazem upsert por (user_id, id)', async () => {
    const { client, calls } = fakeClient([{ data: null }]);
    await new SupabaseGateway(client).upsert('expenses', []);
    expect(calls).toContainEqual(['expenses', 'upsert', [], { onConflict: 'user_id,id' }]);
  });

  it('traduz erros do PostgREST e de rede para o contrato', async () => {
    const { client } = fakeClient([
      { error: { code: '23505', message: 'violates "cycles_one_active_per_user"' } },
      { error: { code: 'PGRST301', message: 'JWT expired' } },
      new TypeError('Failed to fetch'),
    ]);
    const gateway = new SupabaseGateway(client);

    await expect(gateway.upsert('cycles', [])).rejects.toMatchObject({
      code: 'conflict-active-cycle',
    });
    await expect(gateway.selectLive('cycles')).rejects.toMatchObject({ code: 'auth' });
    const network = await gateway.selectLive('cycles').catch((error: unknown) => error);
    expect(network).toBeInstanceOf(SyncError);
    expect(network).toMatchObject({ code: 'network' });
  });
});

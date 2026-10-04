import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseRemote } from './supabase-remote';
import { SyncError } from './types';

type Result = { data?: unknown; error?: { code: string; message: string } | null; count?: number };

/** Query builder falso: registra a cadeia de chamadas e resolve com o próximo resultado. */
function fakeClient(results: Result[]) {
  const calls: unknown[][] = [];
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'upsert', 'update', 'order', 'limit', 'gt', 'is']) {
      chain[method] = (...args: unknown[]) => {
        calls.push([table, method, ...args]);
        return chain;
      };
    }
    chain.then = (resolve: (value: unknown) => void, reject: (error: unknown) => void) => {
      const next = results.shift();
      if (!next) return reject(new Error('Network request failed'));
      return resolve({ data: next.data ?? null, error: next.error ?? null, count: next.count });
    };
    return chain;
  };
  const client = {
    from: (table: string) => builder(table),
    rpc: (name: string) => {
      calls.push([`rpc:${name}`, 'rpc']);
      return builder(`rpc:${name}`);
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

describe('SupabaseRemote', () => {
  it('upsert usa a chave de conflito correta', async () => {
    const { client, calls } = fakeClient([{}, {}]);
    const remote = new SupabaseRemote(client);
    await remote.upsert('settings', []);
    await remote.upsert('expenses', []);
    expect(calls).toEqual([
      ['settings', 'upsert', [], { onConflict: 'user_id' }],
      ['expenses', 'upsert', [], { onConflict: 'user_id,id' }],
    ]);
  });

  it('pull pagina até vir uma página incompleta', async () => {
    const page = Array.from({ length: 500 }, (_, index) => ({
      id: String(index),
      server_updated_at: `t${index}`,
    }));
    const { client, calls } = fakeClient([
      { data: page },
      { data: [{ id: 'x', server_updated_at: 'z' }] },
    ]);
    const rows = await new SupabaseRemote(client).pull('cycles', '2026-10-10T12:00:05.000Z');
    expect(rows).toHaveLength(501);
    expect(calls.filter((call) => call[1] === 'gt')).toEqual([
      ['cycles', 'gt', 'server_updated_at', '2026-10-10T12:00:00.000Z'],
      ['cycles', 'gt', 'server_updated_at', 't499'],
    ]);
  });

  it('converte erros e falhas de rede em SyncError', async () => {
    const { client } = fakeClient([
      { error: { code: '23505', message: 'cycles_one_active_per_user' } },
    ]);
    const remote = new SupabaseRemote(client);
    await expect(remote.upsert('cycles', [])).rejects.toMatchObject({
      code: 'conflict-active-cycle',
    });
    await expect(remote.deleteAccount()).rejects.toBeInstanceOf(SyncError);
  });

  it('hasData, markAllDeleted e deleteAccount', async () => {
    const { client, calls } = fakeClient([
      { count: 0 },
      { count: 2 },
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
      {},
    ]);
    const remote = new SupabaseRemote(client);
    expect(await remote.hasData()).toBe(true);
    await remote.markAllDeleted('2026-10-10T00:00:00.000Z');
    await remote.deleteAccount();
    expect(calls.filter((call) => call[1] === 'update')).toHaveLength(9);
    expect(calls.at(-1)?.[0]).toBe('rpc:delete_my_account');
  });

  it('hasData falso e erro de contagem', async () => {
    expect(
      await new SupabaseRemote(fakeClient([{ count: 0 }, { count: 0 }]).client).hasData(),
    ).toBe(false);
    await expect(
      new SupabaseRemote(
        fakeClient([{ error: { code: 'PGRST301', message: 'JWT expired' } }]).client,
      ).hasData(),
    ).rejects.toMatchObject({ code: 'auth' });
  });
});

import type { SupabaseClient } from '@supabase/supabase-js';

import { AuthFailure, mapAuthError, SupabaseAuthGateway } from './auth';
import { setLogSink } from './monitoring/logger';

const session = { user: { id: 'u1', email: 'pessoa@example.com' }, access_token: 'segredo' };

function fakeClient(overrides: Record<string, unknown> = {}) {
  let listener: ((event: string, value: unknown) => void) | null = null;
  const auth = {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (callback: (event: string, value: unknown) => void) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: () => (listener = null) } } };
    },
    signInWithPassword: async () => ({ data: { session }, error: null }),
    signUp: async () => ({ data: { session }, error: null }),
    signOut: async () => ({ error: null }),
    refreshSession: async () => ({ data: { session }, error: null }),
    ...overrides,
  };
  return {
    client: { auth } as unknown as SupabaseClient,
    emit: (event: string, value: unknown) => listener?.(event, value),
  };
}

describe('mapAuthError', () => {
  it.each([
    [{ message: 'Invalid login credentials', status: 400 }, 'invalid-credentials'],
    [{ message: 'User already registered', status: 422 }, 'already-registered'],
    [{ message: 'x', status: 422, code: 'weak_password' }, 'weak-password'],
    [{ message: 'x', status: 400, code: 'email_not_confirmed' }, 'confirmation-required'],
    [{ message: 'x', status: 429 }, 'rate-limited'],
    [{ message: 'Failed to fetch', status: 0 }, 'network'],
    [{ message: '???', status: 500 }, 'unknown'],
  ])('%o → %s', (error, code) => {
    expect(mapAuthError(error).code).toBe(code);
  });
});

describe('SupabaseAuthGateway', () => {
  const events: unknown[] = [];
  beforeEach(() => {
    events.length = 0;
    setLogSink((kind, name, fields) => events.push({ kind, name, fields }));
  });

  it('expõe só o id do usuário e não registra e-mail nem token', async () => {
    const { client } = fakeClient();
    const gateway = new SupabaseAuthGateway(client);

    expect(await gateway.signIn('pessoa@example.com', '12345678')).toEqual({ userId: 'u1' });
    expect(await gateway.currentUser()).toEqual({ userId: 'u1' });
    expect(JSON.stringify(events)).not.toMatch(/pessoa@example.com|segredo/);
  });

  it('erro do Supabase vira AuthFailure', async () => {
    const { client } = fakeClient({
      signInWithPassword: async () => ({
        data: { session: null },
        error: { message: 'Invalid login credentials', status: 400 },
      }),
    });

    await expect(new SupabaseAuthGateway(client).signIn('a@b.c', 'x')).rejects.toMatchObject({
      code: 'invalid-credentials',
    });
  });

  it('cadastro sem sessão pede confirmação; exceção de rede vira network', async () => {
    const noSession = fakeClient({
      signUp: async () => ({ data: { session: null }, error: null }),
    });
    await expect(
      new SupabaseAuthGateway(noSession.client).signUp('a@b.c', 'x'),
    ).rejects.toMatchObject({
      code: 'confirmation-required',
    });

    const offline = fakeClient({
      signInWithPassword: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const failure = await new SupabaseAuthGateway(offline.client)
      .signIn('a@b.c', 'x')
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(AuthFailure);
    expect(failure).toMatchObject({ code: 'network' });
  });

  it('traduz eventos de sessão e encerra só a sessão local', async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    const { client, emit } = fakeClient({ signOut });
    const gateway = new SupabaseAuthGateway(client);
    const changes: unknown[] = [];
    const stop = gateway.onChange((change) => changes.push(change));

    emit('SIGNED_IN', session);
    emit('TOKEN_REFRESHED', session);
    emit('SIGNED_OUT', null);
    emit('USER_UPDATED', session);
    stop();
    await gateway.signOut();

    expect(changes).toEqual([
      { event: 'signed-in', user: { userId: 'u1' } },
      { event: 'refreshed', user: { userId: 'u1' } },
      { event: 'signed-out', user: null },
    ]);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('refresh: sucesso, erro e exceção', async () => {
    expect(await new SupabaseAuthGateway(fakeClient().client).refresh()).toBe(true);
    const failing = fakeClient({
      refreshSession: async () => ({ data: { session: null }, error: { message: 'x' } }),
    });
    expect(await new SupabaseAuthGateway(failing.client).refresh()).toBe(false);
    const throwing = fakeClient({
      refreshSession: async () => {
        throw new Error('x');
      },
    });
    expect(await new SupabaseAuthGateway(throwing.client).refresh()).toBe(false);
  });
});

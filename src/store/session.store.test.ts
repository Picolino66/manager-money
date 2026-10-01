import type { SupabaseClient } from '@supabase/supabase-js';

import { saveConfig } from '../application/cycle.use-cases';
import { createEmptyState } from '../application/state';
import { MemoryServer } from '../infrastructure/sync/memory-remote';
import { useFinancialStore } from './financial.store';
import { configureSessionDependencies, useSessionStore } from './session.store';

jest.mock('../infrastructure/supabase/client', () => ({ supabase: null, isSupabaseConfigured: false }));

type AuthResult = { data: { user: { id: string; email: string } | null }; error: { message: string } | null };

function fakeClient(user = { id: 'u1', email: 'ana@email.com' }) {
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
    verifyOtp: jest.fn<Promise<AuthResult>, []>().mockResolvedValue({ data: { user }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  return { auth } as unknown as SupabaseClient & { auth: typeof auth };
}

const config = { monthlyIncome: 1000, savingGoal: 0, payday: 7, customCategories: [], fixedExpenses: [] };
const ctx = { now: new Date(2026, 9, 10), newId: (p: string) => `${p}-1` };
const session = () => useSessionStore.getState();
const financial = () => useFinancialStore.getState();

let server: MemoryServer;
let client: ReturnType<typeof fakeClient>;

beforeEach(() => {
  server = new MemoryServer();
  client = fakeClient();
  configureSessionDependencies({ client, remoteFactory: () => server.clientFor('u1') });
  financial().setSyncRemote(null);
  useFinancialStore.setState({ doc: createEmptyState() });
  useSessionStore.setState({ status: 'signed-out', email: null, userId: null, awaitingFirstLoginChoice: false });
});

describe('useSessionStore (SPEC-005)', () => {
  it('sem cliente fica desabilitado', async () => {
    configureSessionDependencies({ client: null });
    await session().init();
    expect(session().status).toBe('disabled');
    await expect(session().sendCode('a@b.c')).rejects.toThrow('Sincronização indisponível');
  });

  it('init sem sessão fica deslogado; com sessão vincula', async () => {
    await session().init();
    expect(session().status).toBe('signed-out');

    client.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1', email: 'ana@email.com' } } } });
    await session().init();
    expect(session()).toMatchObject({ status: 'signed-in', userId: 'u1' });
    expect(financial().doc.sync.userId).toBe('u1');
  });

  it('envia e verifica o código; primeiro login com dados locais faz upload', async () => {
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().sendCode(' Ana@Email.com ');
    expect(client.auth.signInWithOtp).toHaveBeenCalledWith({ email: 'ana@email.com', options: { shouldCreateUser: true } });
    await session().verifyCode('ana@email.com', '123456');
    expect(session().status).toBe('signed-in');
    expect(financial().doc.sync.userId).toBe('u1');
    expect(financial().doc.settings?.dirty).toBe(true);
  });

  it('código inválido gera mensagem amigável', async () => {
    client.auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: 'Token has expired or is invalid' } });
    await expect(session().verifyCode('a@b.c', '000000')).rejects.toThrow('Código inválido ou expirado.');
    client.auth.signInWithOtp.mockResolvedValue({ error: { message: 'For security purposes, you can only request this after 60 seconds' } });
    await expect(session().sendCode('a@b.c')).rejects.toThrow('Muitas tentativas');
    client.auth.signInWithOtp.mockResolvedValue({ error: { message: 'boom' } });
    await expect(session().sendCode('a@b.c')).rejects.toThrow('Verifique a conexão');
  });

  it('dados nos dois lados pedem escolha; usar nuvem descarta os locais', async () => {
    const remote = server.clientFor('u1');
    await remote.upsert('settings', [
      { user_id: 'u1', monthly_income: 9, saving_goal: 0, payday: 7, custom_categories: [], client_updated_at: 'a', deleted_at: null },
    ]);
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().verifyCode('ana@email.com', '123456');
    expect(session().awaitingFirstLoginChoice).toBe(true);
    expect(financial().doc.sync.userId).toBeNull();

    await session().resolveFirstLogin('use-remote');
    expect(session().awaitingFirstLoginChoice).toBe(false);
    expect(financial().doc.settings).toBeNull();
    expect(await financial().syncNow()).toEqual({ ok: true });
    expect(financial().doc.settings?.monthlyIncome).toBe(9);
  });

  it('manter dados do aparelho marca a nuvem como excluída', async () => {
    const remote = server.clientFor('u1');
    await remote.upsert('settings', [
      { user_id: 'u1', monthly_income: 9, saving_goal: 0, payday: 7, custom_categories: [], client_updated_at: 'a', deleted_at: null },
    ]);
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().verifyCode('ana@email.com', '123456');
    await session().resolveFirstLogin('keep-local');
    expect(financial().doc.sync.userId).toBe('u1');
    await financial().syncNow();
    expect(server.store('u1').settings[0]).toMatchObject({ monthly_income: 1000, deleted_at: null });
  });

  it('sair mantendo ou apagando os dados locais', async () => {
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().verifyCode('ana@email.com', '123456');
    await session().signOut(false);
    expect(session().status).toBe('signed-out');
    expect(financial().doc.settings?.monthlyIncome).toBe(1000);
    expect(financial().doc.sync.userId).toBeNull();

    await session().verifyCode('ana@email.com', '123456');
    await session().signOut(true);
    expect(financial().doc.settings).toBeNull();
  });

  it('excluir conta: sucesso desvincula; falha não altera nada', async () => {
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().verifyCode('ana@email.com', '123456');
    await financial().syncNow();

    const failing = server.clientFor('u1');
    failing.offline = true;
    configureSessionDependencies({ client, remoteFactory: () => failing });
    await expect(session().deleteAccount()).rejects.toThrow('Nada foi apagado');
    expect(session().status).toBe('signed-in');

    configureSessionDependencies({ client, remoteFactory: () => server.clientFor('u1') });
    await session().deleteAccount();
    expect(server.data.u1).toBeUndefined();
    expect(session().status).toBe('signed-out');
    expect(financial().doc.settings?.monthlyIncome).toBe(1000);
  });
});

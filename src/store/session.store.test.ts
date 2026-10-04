import type { SupabaseClient } from '@supabase/supabase-js';

import { saveConfig } from '../application/cycle.use-cases';
import { createEmptyState } from '../application/state';
import { MemoryServer } from '../infrastructure/sync/memory-remote';
import { useFinancialStore } from './financial.store';
import { configureSessionDependencies, useSessionStore } from './session.store';

jest.mock('../infrastructure/supabase/client', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

type User = { id: string; email: string; identities?: unknown[] };
type AuthResult = {
  data: { user: User | null; session?: object | null };
  error: { message: string } | null;
};

function fakeClient(user = { id: 'u1', email: 'ana@email.com' }) {
  const auth = {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    signInWithPassword: jest
      .fn<Promise<AuthResult>, []>()
      .mockResolvedValue({ data: { user }, error: null }),
    signUp: jest
      .fn<Promise<AuthResult>, []>()
      .mockResolvedValue({
        data: { user: { ...user, identities: [{}] }, session: {} },
        error: null,
      }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    startAutoRefresh: jest.fn(),
    stopAutoRefresh: jest.fn(),
  };
  return { auth } as unknown as SupabaseClient & { auth: typeof auth };
}

const config = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 1000, payday: 7 }],
  savingGoal: 0,
  customCategories: [],
  fixedExpenses: [],
};
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
  useSessionStore.setState({
    status: 'signed-out',
    email: null,
    userId: null,
    awaitingFirstLoginChoice: false,
  });
});

describe('useSessionStore (SPEC-005)', () => {
  it('sem cliente fica desabilitado', async () => {
    configureSessionDependencies({ client: null });
    await session().init();
    expect(session().status).toBe('disabled');
    await expect(session().signIn('a@b.c', 'senha-forte')).rejects.toThrow(
      'Sincronização indisponível',
    );
  });

  it('init sem sessão fica deslogado; com sessão vincula', async () => {
    await session().init();
    expect(session().status).toBe('signed-out');

    client.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'ana@email.com' } } },
    });
    await session().init();
    expect(session()).toMatchObject({ status: 'signed-in', userId: 'u1' });
    expect(financial().doc.sync.userId).toBe('u1');
  });

  it('entra com e-mail e senha; primeiro login com dados locais faz upload', async () => {
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().signIn(' Ana@Email.com ', 'senha-forte');
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ana@email.com',
      password: 'senha-forte',
    });
    expect(session().status).toBe('signed-in');
    expect(financial().doc.sync.userId).toBe('u1');
    expect(financial().doc.settings?.dirty).toBe(true);
  });

  it('cria conta e já entra (confirmação de e-mail desligada)', async () => {
    await session().signUp('nova@email.com', 'senha-forte');
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: 'nova@email.com',
      password: 'senha-forte',
    });
    expect(session()).toMatchObject({ status: 'signed-in', userId: 'u1' });
  });

  it('senha curta é rejeitada antes de chamar o servidor', async () => {
    await expect(session().signIn('a@b.c', '1234567')).rejects.toThrow('pelo menos 8 caracteres');
    await expect(session().signUp('a@b.c', 'curta')).rejects.toThrow('pelo menos 8 caracteres');
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it('erros do servidor viram mensagens amigáveis', async () => {
    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    await expect(session().signIn('a@b.c', 'senha-errada')).rejects.toThrow(
      'E-mail ou senha incorretos.',
    );

    client.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'x', email: 'a@b.c', identities: [] }, session: null },
      error: null,
    });
    await expect(session().signUp('a@b.c', 'senha-forte')).rejects.toThrow(
      'Já existe uma conta com este e-mail',
    );

    client.auth.signUp.mockResolvedValueOnce({
      data: { user: { id: 'x', email: 'a@b.c', identities: [{}] }, session: null },
      error: null,
    });
    await expect(session().signUp('a@b.c', 'senha-forte')).rejects.toThrow('Confirme o cadastro');

    client.auth.signUp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Password should be at least 8 characters' },
    });
    await expect(session().signUp('a@b.c', 'senha-forte')).rejects.toThrow(
      'pelo menos 8 caracteres',
    );

    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Request rate limit reached, try again in 60 seconds' },
    });
    await expect(session().signIn('a@b.c', 'senha-forte')).rejects.toThrow('Muitas tentativas');

    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'boom' },
    });
    await expect(session().signIn('a@b.c', 'senha-forte')).rejects.toThrow('Verifique a conexão');
  });

  it('dados nos dois lados pedem escolha; usar nuvem descarta os locais', async () => {
    const remote = server.clientFor('u1');
    await remote.upsert('settings', [
      {
        user_id: 'u1',
        monthly_income: 9,
        saving_goal: 0,
        payday: 7,
        custom_categories: [],
        client_updated_at: 'a',
        deleted_at: null,
      },
    ]);
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().signIn('ana@email.com', 'senha-forte');
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
      {
        user_id: 'u1',
        monthly_income: 9,
        saving_goal: 0,
        payday: 7,
        custom_categories: [],
        client_updated_at: 'a',
        deleted_at: null,
      },
    ]);
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().signIn('ana@email.com', 'senha-forte');
    await session().resolveFirstLogin('keep-local');
    expect(financial().doc.sync.userId).toBe('u1');
    await financial().syncNow();
    expect(server.store('u1').settings[0]).toMatchObject({
      monthly_income: 1000,
      deleted_at: null,
    });
  });

  it('sair mantendo ou apagando os dados locais', async () => {
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().signIn('ana@email.com', 'senha-forte');
    await session().signOut(false);
    expect(session().status).toBe('signed-out');
    expect(financial().doc.settings?.monthlyIncome).toBe(1000);
    expect(financial().doc.sync.userId).toBeNull();

    await session().signIn('ana@email.com', 'senha-forte');
    await session().signOut(true);
    expect(financial().doc.settings).toBeNull();
  });

  it('excluir conta: sucesso desvincula; falha não altera nada', async () => {
    await financial().replaceDocument((doc) => saveConfig(doc, config, ctx));
    await session().signIn('ana@email.com', 'senha-forte');
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

import { AuthFailure } from '../infrastructure/auth';
import { userFixture } from '../test/fixtures';
import { FakeAuth, MemoryGateway } from '../test/memory-gateway';
import { at } from '../test/fixtures';
import { useDataStore } from './data.store';
import { setDependencies } from './dependencies';
import { EXPIRED_NOTICE, useSessionStore } from './session.store';

let auth: FakeAuth;
let stop: () => void = () => undefined;

beforeEach(() => {
  auth = new FakeAuth();
  const remote = new MemoryGateway();
  remote.seed(userFixture(), 'user-a@b.c');
  setDependencies({ auth, remote, context: () => at(2026, 11, 12) });
  useSessionStore.setState({ status: 'loading', userId: null, notice: null });
  useDataStore.getState().reset();
});

afterEach(() => stop());
afterAll(() => setDependencies(null));

const session = () => useSessionStore.getState();
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('session.store', () => {
  it('sessão salva no navegador continua após recarregar a página', async () => {
    auth.user = { userId: 'u1' };
    stop = session().init();
    await flush();
    expect(session()).toMatchObject({ status: 'signed-in', userId: 'u1' });
  });

  it('sem sessão: deslogado', async () => {
    stop = session().init();
    await flush();
    expect(session().status).toBe('signed-out');
  });

  it('entrar e criar conta', async () => {
    await session().signIn('a@b.c', '12345678');
    expect(session()).toMatchObject({ status: 'signed-in', userId: 'user-a@b.c' });
    await session().signOut();
    await session().signUp('n@b.c', '12345678');
    expect(session().userId).toBe('user-n@b.c');
  });

  it('erro de login em português', async () => {
    auth.failure = new AuthFailure('invalid-credentials');
    await expect(session().signIn('a@b.c', 'x')).rejects.toThrow('E-mail ou senha incorretos.');
    auth.failure = new AuthFailure('already-registered');
    await expect(session().signUp('a@b.c', 'x')).rejects.toThrow(/Já existe uma conta/);
    auth.failure = new AuthFailure('network');
    await expect(session().signIn('a@b.c', 'x')).rejects.toThrow(/Sem conexão/);
  });

  it('sair descarta o estado em memória', async () => {
    await session().signIn('a@b.c', '12345678');
    await useDataStore.getState().load();
    expect(useDataStore.getState().doc).not.toBeNull();

    await session().signOut();
    expect(useDataStore.getState().doc).toBeNull();
    expect(session()).toMatchObject({ status: 'signed-out', notice: null });
    expect(auth.signOutCalls).toBe(1);
  });

  it('saída não pedida (token revogado/expirado) mostra aviso', async () => {
    auth.user = { userId: 'u1' };
    stop = session().init();
    await flush();
    auth.emit({ event: 'signed-out', user: null });
    expect(session()).toMatchObject({ status: 'signed-out', notice: EXPIRED_NOTICE });
    session().clearNotice();
    expect(session().notice).toBeNull();
  });

  it('troca de conta em outra aba descarta os dados', async () => {
    auth.user = { userId: 'u1' };
    stop = session().init();
    await flush();
    auth.emit({ event: 'signed-in', user: { userId: 'u2' } });
    expect(session().userId).toBe('u2');
  });

  it('expire encerra a sessão com aviso', async () => {
    await session().signIn('a@b.c', '12345678');
    await session().expire();
    expect(session()).toMatchObject({ status: 'signed-out', notice: EXPIRED_NOTICE });
  });

  it('sem variáveis do Supabase: não configurado', () => {
    setDependencies(null);
    vi.stubEnv('VITE_SUPABASE_URL', '');
    stop = session().init();
    expect(session().status).toBe('unconfigured');
    vi.unstubAllEnvs();
  });
});

import { addExpense, openCycle } from '@manager-money/core/application/cycle.use-cases';
import { selectActiveMonth } from '@manager-money/core/application/selectors';
import { cycleToRow, settingsToRow } from '@manager-money/core/contract/mappers';
import { SyncError } from '@manager-money/core/contract/types';

import { at, userFixture } from '../test/fixtures';
import { FakeAuth, MemoryGateway } from '../test/memory-gateway';
import { ActionError, useDataStore } from './data.store';
import { setDependencies } from './dependencies';
import { EXPIRED_NOTICE, useSessionStore } from './session.store';

const USER = 'user-1';
let gateway: MemoryGateway;
let auth: FakeAuth;

const newExpense =
  (description = 'Cinema') =>
  (state: Parameters<typeof addExpense>[0]) =>
    addExpense(
      state,
      { amount: 990, category: 'Lazer', description, date: '2026-11-12' },
      at(2026, 11, 12),
    );

beforeEach(() => {
  gateway = new MemoryGateway();
  gateway.seed(userFixture(), USER);
  auth = new FakeAuth();
  auth.user = { userId: USER };
  setDependencies({ auth, remote: gateway, context: () => at(2026, 11, 12) });
  useDataStore.getState().reset();
  useSessionStore.setState({ status: 'signed-in', userId: USER, notice: null });
});

afterAll(() => setDependencies(null));

const state = () => useDataStore.getState();

describe('load', () => {
  it('carrega o estado do servidor', async () => {
    await state().load();
    expect(state().status).toBe('ready');
    expect(state().doc?.expenses).toHaveLength(4);
  });

  it('erro de rede vira mensagem legível', async () => {
    gateway.failSelect = new SyncError('network');
    await state().load();
    expect(state().status).toBe('error');
    expect(state().loadError).toMatch(/Sem conexão/);
  });

  it('JWT expirado: renova a sessão e tenta de novo', async () => {
    gateway.failSelect = new SyncError('auth');
    auth.refresh = async () => {
      gateway.failSelect = null;
      return true;
    };
    await state().load();
    expect(state().status).toBe('ready');
  });

  it('refresh falho: volta ao login com aviso de sessão expirada', async () => {
    gateway.failSelect = new SyncError('auth');
    auth.refreshResult = false;
    await state().load();
    expect(useSessionStore.getState()).toMatchObject({
      status: 'signed-out',
      notice: EXPIRED_NOTICE,
    });
  });
});

describe('run (caso de uso → grava)', () => {
  it('aplica o caso de uso e grava só o gasto novo', async () => {
    await state().load();
    await state().run(newExpense());

    expect(state().doc?.expenses).toHaveLength(5);
    expect(gateway.upserts).toEqual([{ table: 'expenses', count: 1 }]);
    expect(state().doc?.expenses.every((expense) => !expense.dirty)).toBe(true);
    expect(state().saving).toBe(false);
  });

  it('recarrega antes: parte do que o mobile gravou nesse meio-tempo', async () => {
    await state().load();
    const fromMobile = addExpense(
      userFixture(),
      { amount: 500, category: 'Pets', description: 'Petisco', date: '2026-11-11' },
      at(2026, 11, 11),
    );
    gateway.seed({ ...fromMobile, expenses: fromMobile.expenses.slice(-1) }, USER);

    await state().run(newExpense());
    expect(state().doc?.expenses).toHaveLength(6);
  });

  it('falha de gravação não altera o estado e devolve mensagem', async () => {
    await state().load();
    const before = state().doc;
    gateway.failOn = { table: 'expenses', error: new SyncError('network') };

    await expect(state().run(newExpense())).rejects.toThrow(/Nada foi salvo/);
    expect(state().doc?.expenses).toHaveLength(before!.expenses.length);
    expect(gateway.rows.expenses).toHaveLength(4);
  });

  it('regra do núcleo recusada vira mensagem do domínio', async () => {
    await state().load();
    const outside = (doc: Parameters<typeof addExpense>[0]) =>
      addExpense(
        doc,
        { amount: 10, category: 'Lazer', description: 'x', date: '2027-01-01' },
        at(2026, 11, 12),
      );

    await expect(state().run(outside)).rejects.toThrow(
      'A data do gasto precisa estar dentro do ciclo ativo.',
    );
    expect(gateway.upserts).toEqual([]);
  });

  it('ciclo ativo duplicado (outro aparelho): avisa e recarrega', async () => {
    gateway.rows = new MemoryGateway().rows;
    await state().load();
    gateway.rows.settings.push(settingsToRow(userFixture().settings!, USER));
    // Outro aparelho abre um ciclo depois da nossa leitura (entre o load e o upsert).
    const otherDevice = userFixture();
    const realSelect = gateway.selectLive.bind(gateway);
    let reads = 0;
    gateway.selectLive = async (table) => {
      const rows = await realSelect(table);
      if (table === 'expenses' && ++reads === 1) {
        const active = otherDevice.cycles.find((cycle) => cycle.status === 'active')!;
        gateway.rows.cycles.push(cycleToRow({ ...active, id: 'ciclo-do-celular' }, USER));
      }
      return rows;
    };

    await expect(state().run((doc) => openCycle(doc, at(2026, 11, 12)))).rejects.toThrow(
      /Outro aparelho já abriu um ciclo/,
    );
    expect(selectActiveMonth(state().doc!)?.id).toBe('ciclo-do-celular');
  });

  it('sessão perdida ao gravar: volta ao login', async () => {
    await state().load();
    gateway.failOn = { table: 'expenses', error: new SyncError('auth') };
    auth.refreshResult = false;

    await expect(state().run(newExpense())).rejects.toBeInstanceOf(ActionError);
    expect(useSessionStore.getState().status).toBe('signed-out');
  });

  it('sem sessão: pede login', async () => {
    useSessionStore.setState({ userId: null });
    await expect(state().run(newExpense())).rejects.toThrow(/Entre na sua conta/);
  });
});

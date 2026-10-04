import {
  addExpense,
  closeCycle,
  openCycle,
  updateExpense,
} from '@manager-money/core/application/cycle.use-cases';
import { buildDashboardSummary } from '@manager-money/core/domain/financial/financial.calculations';
import { selectActiveMonth, selectClosedMonths } from '@manager-money/core/application/selectors';
import { countPendingChanges } from '@manager-money/core/application/state';
import { SyncError } from '@manager-money/core/contract/types';

import { at, userFixture } from '../test/fixtures';
import { MemoryGateway } from '../test/memory-gateway';
import { loadUserState, SaveError, saveChanges } from './repository';

const USER = 'user-1';

function seeded() {
  const gateway = new MemoryGateway();
  gateway.seed(userFixture(), USER);
  return gateway;
}

describe('loadUserState', () => {
  it('monta em memória o mesmo estado do núcleo, sem nada pendente', async () => {
    const fixture = userFixture();
    const state = await loadUserState(seeded(), USER, at(2026, 11, 12));

    expect(state.sync.userId).toBe(USER);
    expect(countPendingChanges(state)).toBe(0);
    expect(selectClosedMonths(state)).toHaveLength(1);
    const now = new Date(2026, 10, 12, 12);
    expect(buildDashboardSummary(selectActiveMonth(state)!, now)).toEqual(
      buildDashboardSummary(selectActiveMonth(fixture)!, now),
    );
  });

  it('ignora linhas excluídas logicamente', async () => {
    const gateway = seeded();
    gateway.rows.expenses[0]!.deleted_at = '2026-11-01T00:00:00.000Z';

    const state = await loadUserState(gateway, USER, at(2026, 11, 12));
    expect(state.expenses).toHaveLength(3);
  });

  it('conta nova: sem configuração e sem ciclos', async () => {
    const state = await loadUserState(new MemoryGateway(), USER, at(2026, 11, 12));
    expect(state.settings).toBeNull();
    expect(state.cycles).toEqual([]);
  });
});

describe('saveChanges', () => {
  it('grava só os registros alterados pelo caso de uso', async () => {
    const gateway = seeded();
    const state = await loadUserState(gateway, USER, at(2026, 11, 12));
    const next = addExpense(
      state,
      { amount: 990, category: 'Lazer', description: 'Cinema', date: '2026-11-12' },
      at(2026, 11, 12),
    );

    expect(await saveChanges(gateway, next, USER)).toBe(1);
    expect(gateway.upserts).toEqual([{ table: 'expenses', count: 1 }]);
    expect(gateway.rows.expenses).toHaveLength(5);
  });

  it('nada alterado, nada gravado', async () => {
    const gateway = seeded();
    const state = await loadUserState(gateway, USER, at(2026, 11, 12));

    expect(await saveChanges(gateway, state, USER)).toBe(0);
    expect(gateway.upserts).toEqual([]);
  });

  it('fecha antes de abrir: o índice de ciclo ativo único aceita a troca', async () => {
    const gateway = seeded();
    let state = await loadUserState(gateway, USER, at(2026, 12, 7));
    state = closeCycle(state, at(2026, 12, 7));
    state = openCycle(state, at(2026, 12, 7));

    await saveChanges(gateway, state, USER);
    const active = gateway.rows.cycles.filter((cycle) => cycle.status === 'active');
    expect(active).toHaveLength(1);
    expect(gateway.upserts).toEqual([{ table: 'cycles', count: 2 }]);
  });

  it('falha na primeira tabela: erro não parcial com o código do contrato', async () => {
    const gateway = seeded();
    const state = await loadUserState(gateway, USER, at(2026, 11, 12));
    const id = state.expenses.find(
      (expense) => expense.cycleId === selectActiveMonth(state)!.id,
    )!.id;
    const next = updateExpense(
      state,
      id,
      { amount: 100, category: 'Pets', description: 'x', date: '2026-11-08' },
      at(2026, 11, 12),
    );
    gateway.failOn = { table: 'expenses', error: new SyncError('network') };

    await expect(saveChanges(gateway, next, USER)).rejects.toMatchObject({
      code: 'network',
      partial: false,
    });
  });

  it('falha depois de gravar outra tabela: erro parcial', async () => {
    const gateway = seeded();
    let state = await loadUserState(gateway, USER, at(2026, 12, 7));
    state = closeCycle(state, at(2026, 12, 7));
    state = openCycle(state, at(2026, 12, 7));
    state = addExpense(
      state,
      { amount: 100, category: 'Lazer', description: 'x', date: '2026-12-07' },
      at(2026, 12, 7),
    );
    gateway.failOn = { table: 'expenses', error: new Error('boom') };

    const failure = await saveChanges(gateway, state, USER).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(SaveError);
    expect(failure).toMatchObject({ code: 'unknown', partial: true });
  });
});

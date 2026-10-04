import { addCardPurchase, saveCreditCard } from '../application/card.use-cases';
import { addExpense, closeCycle, openCycle, saveConfig } from '../application/cycle.use-cases';
import { addExtraIncome, payFixedExpense } from '../application/payment.use-cases';
import { selectActiveCycle } from '../application/selectors';
import {
  countPendingChanges,
  createDefaultContext,
  createEmptyState,
  hasLocalData,
  LocalState,
  SYNC_TABLES,
  UseCaseContext,
} from '../application/state';
import { acknowledge, collectDirty, markAllClean } from './dirty';

const USER = 'user-a';
let sequence = 0;
const at = (day: number, month = 10): UseCaseContext => ({
  now: new Date(2026, month - 1, day, 12),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

/** Estado com ao menos um registro alterado em cada uma das 9 tabelas. */
function everyTableDirty(): LocalState {
  let state = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 500000, payday: 7 }],
      savingGoal: 0,
      customCategories: [],
      fixedExpenses: [
        { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 100000 },
      ],
    },
    at(10),
  );
  state = openCycle(state, at(10));
  state = addExpense(
    state,
    { amount: 2500, category: 'Alimentação', description: 'Café', date: '2026-10-10' },
    at(10),
  );
  state = saveCreditCard(state, { name: 'Cartão', closingDay: 1, dueDay: 10 }, at(10));
  const cardId = state.creditCards[0]!.id;
  state = addCardPurchase(
    state,
    {
      cardId,
      description: 'Livro',
      category: 'Educação',
      totalAmount: 9000,
      installments: 1,
      date: '2026-10-10',
    },
    at(10),
  );
  state = payFixedExpense(state, { fixedExpenseId: 'aluguel', method: 'pix' }, at(10));
  state = addExtraIncome(state, { name: 'Bico', amount: 10000, date: '2026-10-10' }, at(10));
  const cycleId = selectActiveCycle(state)!.id;
  return {
    ...state,
    statementPayments: [
      {
        id: 'sp-1',
        cardId,
        statementKey: '2026-10',
        cycleId,
        statementAmount: 9000,
        paidAmount: 9000,
        charges: 0,
        paidAt: '2026-10-10',
        updatedAt: at(10).now.toISOString(),
        deletedAt: null,
        dirty: true,
      },
    ],
  };
}

describe('collectDirty', () => {
  it('devolve as linhas alteradas de cada tabela no formato remoto', () => {
    const state = everyTableDirty();

    for (const table of SYNC_TABLES) {
      const { refs, rows } = collectDirty(state, table, USER);
      expect(rows.length).toBeGreaterThan(0);
      expect(refs).toHaveLength(rows.length);
      for (const row of rows) expect(row.user_id).toBe(USER);
    }
  });

  it('ignora registros limpos', () => {
    const state = markAllClean(everyTableDirty());

    expect(countPendingChanges(state)).toBe(0);
    for (const table of SYNC_TABLES) expect(collectDirty(state, table, USER).rows).toEqual([]);
  });

  it('em cycles, envia os fechados antes do ativo (índice único)', () => {
    let state = markAllClean(everyTableDirty());
    state = closeCycle(state, at(7, 11));
    state = openCycle(state, at(7, 11));

    const rows = collectDirty(state, 'cycles', USER).rows as { status: string }[];
    expect(rows.map((row) => row.status)).toEqual(['closed', 'active']);
  });
});

describe('acknowledge', () => {
  it('limpa só o que não mudou desde o envio', () => {
    const state = everyTableDirty();

    for (const table of SYNC_TABLES) {
      const { refs } = collectDirty(state, table, USER);
      const acked = acknowledge(state, table, refs);
      expect(collectDirty(acked, table, USER).rows).toEqual([]);
      const stale = acknowledge(
        state,
        table,
        refs.map((ref) => ({ ...ref, updatedAt: 'outro' })),
      );
      expect(collectDirty(stale, table, USER).rows.length).toBeGreaterThan(0);
    }
  });
});

describe('estado', () => {
  it('reconhece dados locais e gera ids únicos', () => {
    expect(hasLocalData(createEmptyState())).toBe(false);
    expect(hasLocalData(everyTableDirty())).toBe(true);
    const ctx = createDefaultContext();
    expect(ctx.newId('x')).not.toBe(ctx.newId('x'));
  });
});

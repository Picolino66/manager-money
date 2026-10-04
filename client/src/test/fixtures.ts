import {
  addExpense,
  closeCycle,
  openCycle,
  saveConfig,
} from '@manager-money/core/application/cycle.use-cases';
import {
  createEmptyState,
  LocalState,
  UseCaseContext,
} from '@manager-money/core/application/state';

let sequence = 0;

/** Contexto determinístico: datas fixas e ids sequenciais. */
export const at = (year: number, month: number, day: number, hour = 12): UseCaseContext => ({
  now: new Date(year, month - 1, day, hour),
  newId: (prefix) => `${prefix}-${++sequence}`,
});

/**
 * Usuário com um ciclo fechado (out/2026) e o ativo (nov/2026), gastos nos dois, uma fixa e uma
 * fonte de renda. Usado nos testes de paridade com o núcleo.
 */
export function userFixture(): LocalState {
  let state = saveConfig(
    createEmptyState(),
    {
      incomeSources: [{ id: 'renda', name: 'Salário', amount: 600000, payday: 7 }],
      savingGoal: 50000,
      customCategories: ['Pets'],
      fixedExpenses: [
        { id: 'aluguel', type: 'permanent', name: 'Aluguel', category: 'Moradia', amount: 150000 },
      ],
    },
    at(2026, 10, 7),
  );
  state = openCycle(state, at(2026, 10, 7));
  state = addExpense(
    state,
    { amount: 4590, category: 'Alimentação', description: 'Mercado', date: '2026-10-08' },
    at(2026, 10, 8),
  );
  state = addExpense(
    state,
    { amount: 1200, category: 'Transporte', description: 'Ônibus', date: '2026-10-20' },
    at(2026, 10, 20),
  );
  state = closeCycle(state, at(2026, 11, 7));
  state = openCycle(state, at(2026, 11, 7));
  state = addExpense(
    state,
    { amount: 3000, category: 'Pets', description: 'Ração', date: '2026-11-08' },
    at(2026, 11, 8),
  );
  state = addExpense(
    state,
    { amount: 2550, category: 'Alimentação', description: 'Padaria', date: '2026-11-10' },
    at(2026, 11, 10),
  );

  return state;
}

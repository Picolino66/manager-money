import { openCycle, saveConfig } from '@manager-money/core/application/cycle.use-cases';
import { selectActiveMonth, selectConfig } from '@manager-money/core/application/selectors';
import { createEmptyState } from '@manager-money/core/application/state';

import { at } from '../test/fixtures';
import { toConfigInput } from './onboarding';

describe('onboarding → núcleo', () => {
  it('conta nova sai configurada e com o 1º ciclo aberto pelos casos de uso', () => {
    const input = toConfigInput({
      incomeSources: [{ id: 'r1', name: ' Salário ', amount: 400000, payday: 5 }],
      savingGoal: 40000,
      fixedExpenses: [{ id: 'f1', name: ' Aluguel ', category: 'Moradia', amount: 120000 }],
    });
    const ctx = at(2026, 11, 12);
    const state = openCycle(saveConfig(createEmptyState(), input, ctx), ctx);

    expect(selectConfig(state)).toMatchObject({
      monthlyIncome: 400000,
      payday: 5,
      savingGoal: 40000,
    });
    expect(state.fixedExpenses[0]).toMatchObject({ name: 'Aluguel', type: 'permanent' });
    const month = selectActiveMonth(state)!;
    expect(month.startDate).toBe('2026-11-05');
    // Renda − fixas pendentes reservadas − meta (BR-FIN-004/ADR-017).
    expect(month.initialAvailableAmount).toBe(400000 - 120000 - 40000);
  });
});

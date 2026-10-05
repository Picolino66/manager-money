import { saveConfig } from '@manager-money/core/application/cycle.use-cases';
import { selectConfig } from '@manager-money/core/application/selectors';

import { at, userFixture } from '../test/fixtures';
import {
  configSchema,
  configToForm,
  formToConfigInput,
  plannedOutflowExceedsIncome,
} from './settings';

const newId = (prefix: string) => `${prefix}-novo`;

describe('configuração financeira (formulário ↔ núcleo)', () => {
  it('formulário sem edição devolve a mesma configuração ao núcleo', () => {
    const state = userFixture();
    const config = selectConfig(state)!;
    const values = configToForm(config, newId);
    const next = saveConfig(
      state,
      formToConfigInput(values, config.customCategories),
      at(2026, 11, 12),
    );

    expect(configSchema.safeParse(values).success).toBe(true);
    expect(selectConfig(next)).toMatchObject({
      monthlyIncome: config.monthlyIncome,
      payday: config.payday,
      savingGoal: config.savingGoal,
      customCategories: config.customCategories,
      fixedExpenses: config.fixedExpenses,
    });
  });

  it('inativo grava active:false; ativo omite o campo (compatível com dados antigos)', () => {
    const values = configToForm(selectConfig(userFixture()), newId);
    values.permanentExpenses[0]!.active = false;
    const input = formToConfigInput(values, []);

    expect(input.fixedExpenses[0]).toMatchObject({ type: 'permanent', active: false });
    expect(input.incomeSources[0]).not.toHaveProperty('active');
  });

  it('conta sem configuração começa com uma fonte "Salário"', () => {
    const values = configToForm(null, newId);

    expect(values.incomeSources).toEqual([
      expect.objectContaining({ id: 'income-novo', name: 'Salário', amount: 0, active: true }),
    ]);
  });

  it('exige ao menos uma fonte ativa e dia entre 1 e 28', () => {
    const values = configToForm(selectConfig(userFixture()), newId);

    expect(
      configSchema.safeParse({
        ...values,
        incomeSources: [{ ...values.incomeSources[0]!, active: false }],
      }).success,
    ).toBe(false);
    expect(
      configSchema.safeParse({
        ...values,
        incomeSources: [{ ...values.incomeSources[0]!, payday: 29 }],
      }).success,
    ).toBe(false);
  });

  it('fixa recorrente no cartão atravessa o formulário e vai ao núcleo', () => {
    const values = configToForm(selectConfig(userFixture()), newId);
    values.permanentExpenses[0]!.recurringCardId = 'k1';

    expect(formToConfigInput(values, []).fixedExpenses[0]).toMatchObject({
      type: 'permanent',
      recurringCardId: 'k1',
    });
    expect(configSchema.safeParse(values).success).toBe(true);
    expect(configToForm(null, newId).permanentExpenses).toEqual([]);
  });

  it('parcelas restantes nunca passam do total', () => {
    const values = configToForm(null, newId);
    values.installmentExpenses = [
      {
        id: 'p1',
        name: 'Notebook',
        category: 'Outros',
        installmentAmount: 10000,
        totalInstallments: 3,
        remainingInstallments: 9,
        active: true,
      },
    ];

    expect(formToConfigInput(values, []).fixedExpenses[0]).toMatchObject({
      remainingInstallments: 3,
    });
  });

  it('avisa quando fixas ativas e meta passam da renda ativa', () => {
    const values = configToForm(selectConfig(userFixture()), newId);

    expect(plannedOutflowExceedsIncome(values)).toBe(false);
    expect(plannedOutflowExceedsIncome({ ...values, savingGoal: 10_000_000 })).toBe(true);
    values.permanentExpenses[0]!.active = false;
    expect(plannedOutflowExceedsIncome({ ...values, savingGoal: 450000 })).toBe(false);
  });
});

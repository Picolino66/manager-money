import { FinancialConfigInput } from '@manager-money/core/domain/financial/financial.types';

export type OnboardingValues = {
  incomeSources: { id: string; name: string; amount: number; payday: number }[];
  savingGoal: number;
  fixedExpenses: { id: string; name: string; category: string; amount: number }[];
};

/** Formulário do onboarding → entrada do caso de uso `saveConfig` do núcleo. */
export function toConfigInput(values: OnboardingValues): FinancialConfigInput {
  return {
    incomeSources: values.incomeSources.map((source) => ({ ...source, name: source.name.trim() })),
    savingGoal: values.savingGoal,
    customCategories: [],
    fixedExpenses: values.fixedExpenses.map((expense) => ({
      id: expense.id,
      type: 'permanent' as const,
      name: expense.name.trim(),
      category: expense.category,
      amount: expense.amount,
    })),
  };
}

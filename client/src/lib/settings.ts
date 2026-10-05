import { z } from 'zod';

import {
  calculateFixedExpensesTotal,
  calculateIncomeTotal,
  normalizeCategory,
} from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_PAYDAY,
  FinancialConfig,
  FinancialConfigInput,
  MAX_PAYDAY,
  MIN_PAYDAY,
} from '@manager-money/core/domain/financial/financial.types';

const paydayMessage = `Informe um dia entre ${MIN_PAYDAY} e ${MAX_PAYDAY}.`;

/** Mesmas regras do formulário de configuração do app; o núcleo valida de novo ao salvar. */
export const configSchema = z.object({
  incomeSources: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1, 'Informe o nome da fonte.'),
        amount: z.number().int().positive('Informe um valor maior que zero.'),
        payday: z.number().int().min(MIN_PAYDAY, paydayMessage).max(MAX_PAYDAY, paydayMessage),
        active: z.boolean(),
      }),
    )
    .min(1, 'Informe ao menos uma fonte de renda.')
    // BR-FIN-018: ao menos uma fonte ativa (o domínio também valida).
    .refine((sources) => sources.some((source) => source.active), {
      message: 'Mantenha ao menos uma fonte de renda ativa.',
    }),
  permanentExpenses: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1, 'Informe o nome da despesa.'),
      category: z.string().trim().min(1),
      amount: z.number().int().min(0, 'Valor não pode ser negativo.'),
      active: z.boolean(),
      /** BR-FIN-035: cartão da fixa recorrente; ausente = pagamento manual. */
      recurringCardId: z.string().optional(),
    }),
  ),
  installmentExpenses: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1, 'Informe o nome do parcelamento.'),
      category: z.string().trim().min(1),
      installmentAmount: z.number().int().positive('Informe uma parcela maior que zero.'),
      totalInstallments: z.number().int().min(1, 'Informe ao menos uma parcela.'),
      remainingInstallments: z.number().int().min(0, 'Informe zero ou mais parcelas.'),
      startedAtCycleId: z.string().optional(),
      active: z.boolean(),
    }),
  ),
  savingGoal: z.number().int().min(0, 'Meta não pode ser negativa.'),
});

export type ConfigFormValues = z.infer<typeof configSchema>;

/** Grava `active: false` só quando desligado; ligado = campo ausente (compatível com dados antigos). */
function withActiveFlag<T extends { active: boolean }>({ active, ...item }: T) {
  return active ? item : { ...item, active: false as const };
}

/** Configuração atual → valores do formulário (`active` ausente = ativo). */
export function configToForm(
  config: FinancialConfig | null,
  newId: (prefix: string) => string,
): ConfigFormValues {
  return {
    incomeSources: config?.incomeSources.length
      ? config.incomeSources.map((source) => ({ ...source, active: source.active !== false }))
      : [{ id: newId('income'), name: 'Salário', amount: 0, payday: DEFAULT_PAYDAY, active: true }],
    savingGoal: config?.savingGoal ?? 0,
    permanentExpenses: (config?.fixedExpenses ?? []).flatMap((expense) =>
      expense.type === 'permanent'
        ? [
            {
              id: expense.id,
              name: expense.name,
              category: expense.category,
              amount: expense.amount,
              active: expense.active !== false,
              recurringCardId: expense.recurringCardId,
            },
          ]
        : [],
    ),
    installmentExpenses: (config?.fixedExpenses ?? []).flatMap((expense) =>
      expense.type === 'installment'
        ? [
            {
              id: expense.id,
              name: expense.name,
              category: expense.category,
              installmentAmount: expense.installmentAmount,
              totalInstallments: expense.totalInstallments,
              remainingInstallments: expense.remainingInstallments,
              startedAtCycleId: expense.startedAtCycleId,
              active: expense.active !== false,
            },
          ]
        : [],
    ),
  };
}

/** Formulário → entrada do caso de uso `saveConfig`; as categorias personalizadas não mudam aqui. */
export function formToConfigInput(
  values: ConfigFormValues,
  customCategories: string[],
): FinancialConfigInput {
  return {
    incomeSources: values.incomeSources.map((source) =>
      withActiveFlag({ ...source, name: source.name.trim() }),
    ),
    savingGoal: values.savingGoal,
    customCategories,
    fixedExpenses: [
      ...values.permanentExpenses.map((expense) =>
        withActiveFlag({
          ...expense,
          type: 'permanent' as const,
          name: expense.name.trim(),
          category: normalizeCategory(expense.category),
        }),
      ),
      ...values.installmentExpenses.map((expense) =>
        withActiveFlag({
          ...expense,
          type: 'installment' as const,
          name: expense.name.trim(),
          category: normalizeCategory(expense.category),
          remainingInstallments: Math.min(expense.remainingInstallments, expense.totalInstallments),
        }),
      ),
    ],
  };
}

/** Despesas fixas ativas + meta passam da renda ativa (o app pede confirmação, o web também). */
export function plannedOutflowExceedsIncome(values: ConfigFormValues): boolean {
  const fixed = calculateFixedExpensesTotal(
    formToConfigInput(values, []) as Pick<FinancialConfig, 'fixedExpenses'>,
  );

  return fixed + values.savingGoal > calculateIncomeTotal(values.incomeSources);
}

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';

import { openCycle, saveConfig } from '@manager-money/core/application/cycle.use-cases';
import { createDefaultContext } from '@manager-money/core/application/state';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_PAYDAY,
  MAX_PAYDAY,
  MIN_PAYDAY,
} from '@manager-money/core/domain/financial/financial.types';

import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { toConfigInput } from '@/lib/onboarding';
import { useDataStore } from '@/store/data.store';

const newId = (prefix: string) => createDefaultContext().newId(prefix);
const paydayMessage = `Informe um dia entre ${MIN_PAYDAY} e ${MAX_PAYDAY}.`;

/** Mesmas regras do formulário de configuração do app; o núcleo valida de novo ao salvar. */
const schema = z.object({
  incomeSources: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1, 'Informe o nome da fonte.'),
        amount: z.number().int().positive('Informe um valor maior que zero.'),
        payday: z.number().int().min(MIN_PAYDAY, paydayMessage).max(MAX_PAYDAY, paydayMessage),
      }),
    )
    .min(1, 'Informe ao menos uma fonte de renda.'),
  savingGoal: z.number().int().min(0, 'Meta não pode ser negativa.'),
  fixedExpenses: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1, 'Informe o nome da despesa.'),
      category: z.string().trim().min(1),
      amount: z.number().int().positive('Informe um valor maior que zero.'),
    }),
  ),
});

type OnboardingForm = z.infer<typeof schema>;

/**
 * Onboarding de conta nova (CLIENT-009A): configuração financeira + 1º ciclo, gravados pelos casos
 * de uso do núcleo (`saveConfig` → `openCycle`). O app mobile recebe tudo no primeiro login.
 */
export function OnboardingPage() {
  const run = useDataStore((state) => state.run);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const categories = getSortedCategories(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      incomeSources: [{ id: newId('income'), name: 'Salário', amount: 0, payday: DEFAULT_PAYDAY }],
      savingGoal: 0,
      fixedExpenses: [],
    },
  });
  const sources = useFieldArray({ control, name: 'incomeSources' });
  const fixed = useFieldArray({ control, name: 'fixedExpenses' });

  async function onSubmit(values: OnboardingForm) {
    setError(null);
    try {
      await run((state, ctx) => openCycle(saveConfig(state, toConfigInput(values), ctx), ctx));
      toast.success('Tudo pronto! Seu primeiro ciclo foi aberto.');
      navigate('/', { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.');
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink">Vamos começar</h1>
      <p className="mt-1 text-sm text-muted">
        Informe sua renda, a meta de economia e as despesas fixas. Com isso abrimos o seu primeiro
        ciclo e calculamos quanto você pode gastar por dia. Dá para ajustar tudo depois no app.
      </p>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="mt-6 flex flex-col gap-5">
        <Card>
          <CardTitle>Fontes de renda</CardTitle>
          <p className="mt-1 text-sm text-muted">
            O ciclo começa no dia de pagamento da maior fonte (entre {MIN_PAYDAY} e {MAX_PAYDAY}).
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {sources.fields.map((source, index) => (
              <fieldset
                key={source.id}
                className="grid gap-3 md:grid-cols-[1fr_10rem_7rem_auto] md:items-end"
              >
                <legend className="sr-only">Fonte {index + 1}</legend>
                <Field label="Nome" error={errors.incomeSources?.[index]?.name?.message}>
                  {(props) => <Input {...props} {...register(`incomeSources.${index}.name`)} />}
                </Field>
                <Field label="Valor mensal" error={errors.incomeSources?.[index]?.amount?.message}>
                  {(props) => (
                    <Controller
                      control={control}
                      name={`incomeSources.${index}.amount`}
                      render={({ field }) => (
                        <MoneyInput
                          {...props}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
                <Field
                  label="Dia de pagamento"
                  error={errors.incomeSources?.[index]?.payday?.message}
                >
                  {(props) => (
                    <Input
                      type="number"
                      min={MIN_PAYDAY}
                      max={MAX_PAYDAY}
                      {...props}
                      {...register(`incomeSources.${index}.payday`, { valueAsNumber: true })}
                    />
                  )}
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover fonte ${index + 1}`}
                  disabled={sources.fields.length === 1}
                  onClick={() => sources.remove(index)}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              </fieldset>
            ))}
            {errors.incomeSources?.root?.message ? (
              <p role="alert" className="text-xs text-critical">
                {errors.incomeSources.root.message}
              </p>
            ) : null}
            <Button
              variant="secondary"
              className="self-start"
              onClick={() =>
                sources.append({ id: newId('income'), name: '', amount: 0, payday: DEFAULT_PAYDAY })
              }
            >
              <Plus aria-hidden className="h-4 w-4" /> Adicionar fonte
            </Button>
          </div>
        </Card>

        <Card>
          <CardTitle>Meta de economia</CardTitle>
          <div className="mt-4 max-w-xs">
            <Field label="Quanto guardar por ciclo" error={errors.savingGoal?.message}>
              {(props) => (
                <Controller
                  control={control}
                  name="savingGoal"
                  render={({ field }) => (
                    <MoneyInput
                      {...props}
                      value={field.value}
                      onValueChange={field.onChange}
                      onBlur={field.onBlur}
                    />
                  )}
                />
              )}
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Despesas fixas (opcional)</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Aluguel, contas e assinaturas que saem todo ciclo.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {fixed.fields.map((expense, index) => (
              <fieldset
                key={expense.id}
                className="grid gap-3 md:grid-cols-[1fr_11rem_10rem_auto] md:items-end"
              >
                <legend className="sr-only">Despesa {index + 1}</legend>
                <Field label="Nome" error={errors.fixedExpenses?.[index]?.name?.message}>
                  {(props) => <Input {...props} {...register(`fixedExpenses.${index}.name`)} />}
                </Field>
                <Field label="Categoria">
                  {(props) => (
                    <NativeSelect {...props} {...register(`fixedExpenses.${index}.category`)}>
                      {categories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </NativeSelect>
                  )}
                </Field>
                <Field label="Valor" error={errors.fixedExpenses?.[index]?.amount?.message}>
                  {(props) => (
                    <Controller
                      control={control}
                      name={`fixedExpenses.${index}.amount`}
                      render={({ field }) => (
                        <MoneyInput
                          {...props}
                          value={field.value}
                          onValueChange={field.onChange}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  )}
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover despesa ${index + 1}`}
                  onClick={() => fixed.remove(index)}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              </fieldset>
            ))}
            <Button
              variant="secondary"
              className="self-start"
              onClick={() =>
                fixed.append({ id: newId('fixed'), name: '', category: 'Moradia', amount: 0 })
              }
            >
              <Plus aria-hidden className="h-4 w-4" /> Adicionar despesa fixa
            </Button>
          </div>
        </Card>

        {error ? (
          <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-ink">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="self-end">
          {isSubmitting ? 'Salvando…' : 'Salvar e abrir o primeiro ciclo'}
        </Button>
      </form>
    </main>
  );
}

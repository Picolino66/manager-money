import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

import { saveConfig } from '@manager-money/core/application/cycle.use-cases';
import { selectConfig, selectCreditCards } from '@manager-money/core/application/selectors';
import { createDefaultContext } from '@manager-money/core/application/state';
import {
  calculateFixedExpensesTotal,
  calculateIncomeTotal,
  calculatePrimaryIncomeSource,
  getSortedCategories,
} from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_PAYDAY,
  MAX_PAYDAY,
  MIN_PAYDAY,
} from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import {
  ConfigFormValues,
  configSchema,
  configToForm,
  formToConfigInput,
  plannedOutflowExceedsIncome,
} from '@/lib/settings';
import { useDataStore } from '@/store/data.store';

const newId = (prefix: string) => createDefaultContext().newId(prefix);

/**
 * Configuração financeira (renda, meta, despesas fixas e parcelamentos), a mesma do app. Grava pelo
 * caso de uso `saveConfig` do núcleo; falha: o formulário continua com o erro e nada muda.
 */
export function ConfigPage() {
  const doc = useDataStore((state) => state.doc);
  const run = useDataStore((state) => state.run);
  const config = doc ? selectConfig(doc) : null;
  const cards = doc ? selectCreditCards(doc) : [];
  const activeCards = cards.filter((card) => card.active);
  const categories = useMemo(() => getSortedCategories(config), [config]);
  const initial = useMemo(() => configToForm(config, newId), [config]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<ConfigFormValues | null>(null);
  const {
    control,
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ConfigFormValues>({ resolver: zodResolver(configSchema), values: initial });
  const sources = useFieldArray({ control, name: 'incomeSources' });
  const permanent = useFieldArray({ control, name: 'permanentExpenses' });
  const installments = useFieldArray({ control, name: 'installmentExpenses' });
  const watchedSources = useWatch({ control, name: 'incomeSources' });
  const watchedPermanent = useWatch({ control, name: 'permanentExpenses' });
  const watchedInstallments = useWatch({ control, name: 'installmentExpenses' });
  const primary = calculatePrimaryIncomeSource(watchedSources ?? []);
  const incomeTotal = calculateIncomeTotal(watchedSources ?? []);
  const fixedTotal = calculateFixedExpensesTotal(
    formToConfigInput(
      {
        incomeSources: [],
        savingGoal: 0,
        permanentExpenses: watchedPermanent ?? [],
        installmentExpenses: watchedInstallments ?? [],
      },
      [],
    ),
  );
  const sourcesError = errors.incomeSources?.message ?? errors.incomeSources?.root?.message;

  async function persist(values: ConfigFormValues) {
    setError(null);
    try {
      await run((state, ctx) =>
        saveConfig(state, formToConfigInput(values, config?.customCategories ?? []), ctx),
      );
      toast.success('Configuração salva.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.');
    }
  }

  function onSubmit(values: ConfigFormValues) {
    if (plannedOutflowExceedsIncome(values)) {
      setPending(values);
      return;
    }
    return persist(values);
  }

  if (!doc) return null;

  const categoryOptions = (current: string) =>
    [...new Set([...categories, current])].map((category) => (
      <option key={category}>{category}</option>
    ));

  return (
    <>
      <PageHeader
        title="Configuração financeira"
        description="Renda, meta de economia, despesas fixas e parcelamentos. As mudanças valem para o ciclo ativo e os próximos."
      />

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Renda mensal</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Total: {formatCurrency(incomeTotal)}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  sources.append({
                    id: newId('income'),
                    name: '',
                    amount: 0,
                    payday: primary?.payday ?? DEFAULT_PAYDAY,
                    active: true,
                  })
                }
              >
                <Plus aria-hidden className="h-4 w-4" /> Adicionar fonte
              </Button>
            </div>
          </div>
          {primary ? (
            <p className="mt-1 text-sm text-muted">
              O ciclo usa o dia {primary.payday}
              {primary.name.trim() ? ` (${primary.name.trim()}, a fonte de maior valor)` : ''}.
            </p>
          ) : null}
          {sourcesError ? (
            <p role="alert" className="mt-2 text-sm text-critical">
              {sourcesError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col gap-4">
            {sources.fields.map((source, index) => (
              <fieldset
                key={source.id}
                className="grid gap-3 md:grid-cols-[1fr_10rem_7rem_auto] md:items-end"
              >
                <legend className="sr-only">Fonte {index + 1}</legend>
                <Field label="Nome da fonte" error={errors.incomeSources?.[index]?.name?.message}>
                  {(props) => <Input {...props} {...register(`incomeSources.${index}.name`)} />}
                </Field>
                <Field label="Valor" error={errors.incomeSources?.[index]?.amount?.message}>
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
                  label="Dia do pagamento"
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
                <div className="flex items-center gap-2">
                  <CheckboxField
                    label="Ativa"
                    aria-label={`Fonte de renda ${index + 1} ativa`}
                    {...register(`incomeSources.${index}.active`)}
                  />
                  {sources.fields.length > 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Remover fonte"
                      aria-label={`Remover fonte de renda ${index + 1}`}
                      onClick={() => sources.remove(index)}
                    >
                      <Trash2 aria-hidden className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </fieldset>
            ))}
          </div>
        </Card>

        <Card>
          <Field label="Meta mensal de economia" error={errors.savingGoal?.message}>
            {(props) => (
              <Controller
                control={control}
                name="savingGoal"
                render={({ field }) => (
                  <MoneyInput
                    {...props}
                    className="max-w-xs"
                    value={field.value}
                    onValueChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                )}
              />
            )}
          </Field>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Despesas fixas</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">Total: {formatCurrency(fixedTotal)}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  permanent.prepend({
                    id: newId('fixed'),
                    name: '',
                    category: DEFAULT_EXPENSE_CATEGORY,
                    amount: 0,
                    active: true,
                  })
                }
              >
                <Plus aria-hidden className="h-4 w-4" /> Adicionar despesa fixa
              </Button>
            </div>
          </div>
          {permanent.fields.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma despesa fixa cadastrada.</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-4">
            {permanent.fields.map((expense, index) => (
              <fieldset
                key={expense.id}
                className="grid gap-3 md:grid-cols-[1fr_10rem_12rem_auto] md:items-end"
              >
                <legend className="sr-only">Despesa fixa {index + 1}</legend>
                <Field label="Nome" error={errors.permanentExpenses?.[index]?.name?.message}>
                  {(props) => <Input {...props} {...register(`permanentExpenses.${index}.name`)} />}
                </Field>
                <Field label="Valor" error={errors.permanentExpenses?.[index]?.amount?.message}>
                  {(props) => (
                    <Controller
                      control={control}
                      name={`permanentExpenses.${index}.amount`}
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
                <Field label="Categoria">
                  {(props) => (
                    <NativeSelect {...props} {...register(`permanentExpenses.${index}.category`)}>
                      {categoryOptions(expense.category)}
                    </NativeSelect>
                  )}
                </Field>
                <div className="flex items-center gap-2">
                  <CheckboxField
                    label="Ativa"
                    aria-label={`Despesa fixa ${index + 1} ativa`}
                    {...register(`permanentExpenses.${index}.active`)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remover despesa fixa"
                    aria-label={`Remover despesa fixa ${index + 1}`}
                    onClick={() => permanent.remove(index)}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
                <Controller
                  control={control}
                  name={`permanentExpenses.${index}.recurringCardId`}
                  render={({ field }) => {
                    const selected = cards.find((card) => card.id === field.value);
                    const options = [
                      ...activeCards,
                      ...(selected && !selected.active ? [selected] : []),
                    ];
                    const enabled = Boolean(field.value);

                    return (
                      <div className="flex flex-col gap-2 md:col-span-full">
                        <CheckboxField
                          label="Recorrente no cartão de crédito"
                          hint={
                            activeCards.length === 0 && !enabled
                              ? 'Cadastre um cartão em Cartões para usar.'
                              : 'Cobrada sozinha no cartão toda vez que a fatura vira (1 parcela, sem juros).'
                          }
                          aria-label={`Despesa fixa ${index + 1} recorrente no cartão de crédito`}
                          checked={enabled}
                          disabled={activeCards.length === 0 && !enabled}
                          onChange={(event) =>
                            field.onChange(event.target.checked ? activeCards[0]?.id : undefined)
                          }
                        />
                        {enabled ? (
                          <div className="max-w-xs">
                            <Field label="Cartão da despesa recorrente">
                              {(props) => (
                                <NativeSelect
                                  {...props}
                                  value={field.value ?? ''}
                                  onChange={(event) => field.onChange(event.target.value)}
                                >
                                  {options.map((card) => (
                                    <option key={card.id} value={card.id}>
                                      {card.active ? card.name : `${card.name} (inativo)`}
                                    </option>
                                  ))}
                                </NativeSelect>
                              )}
                            </Field>
                            {selected && !selected.active ? (
                              <p className="mt-1 text-xs text-critical">
                                Este cartão está inativo: a despesa não será lançada até você
                                escolher outro.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  }}
                />
              </fieldset>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Parcelamentos</CardTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                installments.prepend({
                  id: newId('installment'),
                  name: '',
                  category: DEFAULT_EXPENSE_CATEGORY,
                  installmentAmount: 0,
                  totalInstallments: 1,
                  remainingInstallments: 1,
                  active: true,
                })
              }
            >
              <Plus aria-hidden className="h-4 w-4" /> Adicionar parcelamento
            </Button>
          </div>
          <p className="mt-1 text-sm text-muted">
            Carnês, financiamentos e outros parcelamentos fora do cartão. Parcelamentos do cartão de
            crédito ficam no próprio cartão.
          </p>
          {installments.fields.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhum parcelamento cadastrado.</p>
          ) : null}
          <div className="mt-4 flex flex-col gap-4">
            {installments.fields.map((expense, index) => (
              <fieldset
                key={expense.id}
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_9rem_11rem_6rem_6rem_auto] xl:items-end"
              >
                <legend className="sr-only">Parcelamento {index + 1}</legend>
                <Field label="Nome" error={errors.installmentExpenses?.[index]?.name?.message}>
                  {(props) => (
                    <Input {...props} {...register(`installmentExpenses.${index}.name`)} />
                  )}
                </Field>
                <Field
                  label="Valor da parcela"
                  error={errors.installmentExpenses?.[index]?.installmentAmount?.message}
                >
                  {(props) => (
                    <Controller
                      control={control}
                      name={`installmentExpenses.${index}.installmentAmount`}
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
                <Field label="Categoria">
                  {(props) => (
                    <NativeSelect {...props} {...register(`installmentExpenses.${index}.category`)}>
                      {categoryOptions(expense.category)}
                    </NativeSelect>
                  )}
                </Field>
                <Field
                  label="Total de parcelas"
                  error={errors.installmentExpenses?.[index]?.totalInstallments?.message}
                >
                  {(props) => (
                    <Input
                      type="number"
                      min={1}
                      {...props}
                      {...register(`installmentExpenses.${index}.totalInstallments`, {
                        valueAsNumber: true,
                        onChange: (event) => {
                          const total = Number(event.target.value);
                          if (Number.isInteger(total) && total >= 1) {
                            setValue(`installmentExpenses.${index}.remainingInstallments`, total);
                          }
                        },
                      })}
                    />
                  )}
                </Field>
                <Field
                  label="Parcelas restantes"
                  error={errors.installmentExpenses?.[index]?.remainingInstallments?.message}
                >
                  {(props) => (
                    <Input
                      type="number"
                      min={0}
                      {...props}
                      {...register(`installmentExpenses.${index}.remainingInstallments`, {
                        valueAsNumber: true,
                      })}
                    />
                  )}
                </Field>
                <div className="flex items-center gap-2">
                  <CheckboxField
                    label="Ativo"
                    aria-label={`Parcelamento ${index + 1} ativo`}
                    {...register(`installmentExpenses.${index}.active`)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remover parcelamento"
                    aria-label={`Remover parcelamento ${index + 1}`}
                    onClick={() => installments.remove(index)}
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </div>
              </fieldset>
            ))}
          </div>
        </Card>

        {error ? (
          <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-ink">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar configuração'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Plano acima da renda"
        description="Despesas fixas e meta passam da renda mensal. Deseja salvar mesmo assim?"
        confirmLabel="Salvar mesmo assim"
        onConfirm={() => {
          const values = pending;
          setPending(null);
          if (values) void persist(values);
        }}
      />
    </>
  );
}

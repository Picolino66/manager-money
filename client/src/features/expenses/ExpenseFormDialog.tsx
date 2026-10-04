import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { addExpense, updateExpense } from '@manager-money/core/application/cycle.use-cases';
import { CycleRecord } from '@manager-money/core/application/state';
import { DEFAULT_EXPENSE_CATEGORY } from '@manager-money/core/domain/financial/financial.types';
import { clampIsoDate, formatCycleLabel, toISODate } from '@manager-money/core/utils/date';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { ExpenseRow } from '@/lib/expenses';
import { useDataStore } from '@/store/data.store';

const schema = z.object({
  amount: z.number().int().positive('Informe um valor maior que zero.'),
  category: z.string().trim().min(1),
  description: z.string().trim().max(120, 'Use até 120 caracteres.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
});

type ExpenseForm = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleRecord;
  categories: string[];
  /** Ausente = novo gasto. */
  expense?: ExpenseRow;
};

/**
 * Registrar/editar gasto à vista do ciclo ativo pelos casos de uso do núcleo (`addExpense`,
 * `updateExpense`). Falha: o diálogo continua aberto com o erro e nada muda na tabela.
 */
export function ExpenseFormDialog({ open, onOpenChange, cycle, categories, expense }: Props) {
  const run = useDataStore((state) => state.run);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(schema),
    values: expense
      ? {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          date: expense.date,
        }
      : {
          amount: 0,
          category: categories.includes('Alimentação') ? 'Alimentação' : DEFAULT_EXPENSE_CATEGORY,
          description: '',
          date: clampIsoDate(toISODate(new Date()), cycle.startDate, cycle.endDate),
        },
  });

  async function onSubmit(values: ExpenseForm) {
    setError(null);
    try {
      await run((state, ctx) =>
        expense ? updateExpense(state, expense.id, values, ctx) : addExpense(state, values, ctx),
      );
      toast.success(expense ? 'Gasto atualizado.' : 'Gasto registrado.');
      onOpenChange(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível salvar.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
      title={expense ? 'Editar gasto' : 'Registrar gasto'}
      description={`Ciclo ativo: ${formatCycleLabel(cycle.startDate, cycle.endDate)}`}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Valor" error={errors.amount?.message}>
          {(props) => (
            <Controller
              control={control}
              name="amount"
              render={({ field }) => (
                <MoneyInput
                  {...props}
                  autoFocus
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}
        </Field>
        <Field label="Data" error={errors.date?.message}>
          {(props) => (
            <Input
              type="date"
              min={cycle.startDate}
              max={cycle.endDate}
              {...props}
              {...register('date')}
            />
          )}
        </Field>
        <Field label="Categoria" error={errors.category?.message}>
          {(props) => (
            <NativeSelect {...props} {...register('category')}>
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Descrição (opcional)" error={errors.description?.message}>
          {(props) => <Input maxLength={120} {...props} {...register('description')} />}
        </Field>
        {error ? (
          <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-ink">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

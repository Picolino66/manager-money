import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { updateCardPurchase } from '@manager-money/core/application/card.use-cases';
import { CardPurchaseRecord, CycleRecord } from '@manager-money/core/application/state';
import { formatCycleLabel, toISODate } from '@manager-money/core/utils/date';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { useDataStore } from '@/store/data.store';

const schema = z.object({
  totalAmount: z.number().int().positive('Informe um valor maior que zero.'),
  installments: z.number().int().min(1, 'Informe ao menos 1 parcela.'),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1, 'Informe a descrição.').max(120, 'Use até 120 caracteres.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data.'),
});

type PurchaseForm = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle: CycleRecord;
  categories: string[];
  purchase: CardPurchaseRecord;
};

/**
 * Editar compra no cartão pelo caso de uso `updateCardPurchase` (BR-FIN-029). Compra da situação
 * inicial muda descrição, categoria e data (informativa, BR-FIN-036). Falha: o diálogo continua aberto com o erro do núcleo.
 */
export function CardPurchaseFormDialog({ open, onOpenChange, cycle, categories, purchase }: Props) {
  const run = useDataStore((state) => state.run);
  const [error, setError] = useState<string | null>(null);
  const valuesLocked = purchase.origin === 'existing';
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseForm>({
    resolver: zodResolver(schema),
    values: {
      totalAmount: purchase.totalAmount,
      installments: purchase.installments,
      category: purchase.category,
      description: purchase.description,
      date: purchase.purchaseDate,
    },
  });

  async function onSubmit(values: PurchaseForm) {
    setError(null);
    try {
      await run((state, ctx) => updateCardPurchase(state, purchase.id, values, ctx));
      toast.success('Compra atualizada.');
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
      title="Editar compra no cartão"
      description={`Ciclo ativo: ${formatCycleLabel(cycle.startDate, cycle.endDate)}`}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Valor total" error={errors.totalAmount?.message}>
          {(props) => (
            <Controller
              control={control}
              name="totalAmount"
              render={({ field }) => (
                <MoneyInput
                  {...props}
                  disabled={valuesLocked}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
          )}
        </Field>
        <Field label="Parcelas" error={errors.installments?.message}>
          {(props) => (
            <Input
              type="number"
              min={1}
              step={1}
              disabled={valuesLocked}
              {...props}
              {...register('installments', { valueAsNumber: true })}
            />
          )}
        </Field>
        <Field label="Data da compra" error={errors.date?.message}>
          {(props) => (
            <Input
              type="date"
              min={valuesLocked ? undefined : cycle.startDate}
              max={valuesLocked ? toISODate(new Date()) : cycle.endDate}
              {...props}
              {...register('date')}
            />
          )}
        </Field>
        <Field label="Categoria" error={errors.category?.message}>
          {(props) => (
            <NativeSelect {...props} {...register('category')}>
              {[...new Set([...categories, purchase.category])].map((category) => (
                <option key={category}>{category}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Descrição" error={errors.description?.message}>
          {(props) => <Input maxLength={120} {...props} {...register('description')} />}
        </Field>
        {valuesLocked ? (
          <p className="text-sm text-muted">
            Compra anterior ao app: valor e parcelas não mudam. A data é a da 1ª parcela; as demais
            seguem mês a mês (mudar aqui ajusta todas).
          </p>
        ) : null}
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

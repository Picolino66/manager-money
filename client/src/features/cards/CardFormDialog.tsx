import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { saveCreditCard } from '@manager-money/core/application/card.use-cases';
import { CreditCardRecord } from '@manager-money/core/application/state';
import { MAX_CARD_DAY, MIN_CARD_DAY } from '@manager-money/core/domain/financial/credit-card';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { useDataStore } from '@/store/data.store';

const dayMessage = `Informe um dia entre ${MIN_CARD_DAY} e ${MAX_CARD_DAY}.`;
const day = z.number().int().min(MIN_CARD_DAY, dayMessage).max(MAX_CARD_DAY, dayMessage);

const schema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do cartão.').max(60, 'Use até 60 caracteres.'),
  closingDay: day,
  dueDay: day,
  /** 0 = limite não informado. */
  creditLimit: z.number().int().min(0),
});

type CardForm = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ausente = novo cartão. */
  card?: CreditCardRecord;
};

/** Cadastrar/editar cartão (BR-FIN-019/026/028) pelo caso de uso `saveCreditCard` do núcleo. */
export function CardFormDialog({ open, onOpenChange, card }: Props) {
  const run = useDataStore((state) => state.run);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CardForm>({
    resolver: zodResolver(schema),
    values: {
      name: card?.name ?? '',
      closingDay: card?.closingDay ?? 0,
      dueDay: card?.dueDay ?? 0,
      creditLimit: card?.creditLimit ?? 0,
    },
  });

  async function onSubmit(values: CardForm) {
    setError(null);
    try {
      await run((state, ctx) =>
        saveCreditCard(
          state,
          {
            id: card?.id,
            name: values.name,
            closingDay: values.closingDay,
            dueDay: values.dueDay,
            creditLimit: values.creditLimit > 0 ? values.creditLimit : null,
          },
          ctx,
        ),
      );
      toast.success(card ? 'Cartão atualizado.' : 'Cartão cadastrado.');
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
      title={card ? 'Editar cartão' : 'Novo cartão'}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Nome do cartão" error={errors.name?.message}>
          {(props) => <Input autoFocus placeholder="Ex: Nubank" {...props} {...register('name')} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dia de fechamento (1 a 28)" error={errors.closingDay?.message}>
            {(props) => (
              <Input
                type="number"
                min={MIN_CARD_DAY}
                max={MAX_CARD_DAY}
                {...props}
                {...register('closingDay', { valueAsNumber: true })}
              />
            )}
          </Field>
          <Field label="Dia de vencimento (1 a 28)" error={errors.dueDay?.message}>
            {(props) => (
              <Input
                type="number"
                min={MIN_CARD_DAY}
                max={MAX_CARD_DAY}
                {...props}
                {...register('dueDay', { valueAsNumber: true })}
              />
            )}
          </Field>
        </div>
        <Field
          label="Limite total do cartão (opcional)"
          hint="O limite do cartão não é dinheiro para gastar."
          error={errors.creditLimit?.message}
        >
          {(props) => (
            <Controller
              control={control}
              name="creditLimit"
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

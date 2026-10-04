import { useState } from 'react';
import { toast } from 'sonner';

import { addStatementCharges, payStatement } from '@manager-money/core/application/card.use-cases';
import { formatMonthKey } from '@manager-money/core/application/card-text';
import { formatDayMonth } from '@manager-money/core/application/card-view';
import { CreditCardRecord } from '@manager-money/core/application/state';
import { CardStatement } from '@manager-money/core/domain/financial/credit-card';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { MoneyInput } from '@/components/ui/money-input';
import { useDataStore } from '@/store/data.store';

type DialogProps = {
  card: CreditCardRecord;
  statement: CardStatement;
  onClose: () => void;
};

function ErrorBox({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-ink">
      {message}
    </p>
  ) : null;
}

/**
 * BR-FIN-033/034: pagar fatura. Valor menor que o restante é parcial (o resto vira dívida do próximo
 * ciclo se não for pago até o fim do ciclo); maior registra a diferença como juros/encargos.
 */
export function PayStatementDialog({
  card,
  statement,
  overdue,
  onClose,
}: DialogProps & { overdue: boolean }) {
  const run = useDataStore((state) => state.run);
  const [paidAmount, setPaidAmount] = useState<MoneyCents>(statement.remaining);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const shortfall = paidAmount > 0 ? Math.max(0, statement.remaining - paidAmount) : 0;
  const excess = Math.max(0, paidAmount - statement.remaining);

  async function submit(value: MoneyCents | undefined) {
    if (value !== undefined && value <= 0) {
      setError('Informe um valor pago maior que zero.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await run((state, ctx) =>
        payStatement(
          state,
          {
            cardId: card.id,
            statementKey: statement.key,
            ...(value === undefined ? {} : { paidAmount: value }),
          },
          ctx,
        ),
      );
      toast.success('Pagamento registrado.');
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Fatura ${card.name} ${formatMonthKey(statement.key)}`}
      description={
        overdue
          ? `A fatura venceu em ${formatDayMonth(statement.dueDate)}. Informe quanto você pagou, com juros se houver.`
          : `Vence em ${formatDayMonth(statement.dueDate)}. Informe quanto você pagou.`
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-ink">
          Fatura {formatCurrency(statement.amount)}
          {statement.charges > 0 ? ` · Encargos ${formatCurrency(statement.charges)}` : ''} · Já
          pago {formatCurrency(statement.paid)} · Restante {formatCurrency(statement.remaining)}
        </p>
        {!overdue ? (
          <Button disabled={saving} onClick={() => void submit(undefined)}>
            Pagar o restante ({formatCurrency(statement.remaining)})
          </Button>
        ) : null}
        <Field label="Valor pago">
          {(props) => <MoneyInput {...props} value={paidAmount} onValueChange={setPaidAmount} />}
        </Field>
        <div aria-live="polite" className="flex flex-col gap-1 text-sm text-warning">
          {shortfall > 0 ? (
            <p>
              Pagamento parcial: {formatCurrency(shortfall)} continuam devidos. Se a fatura pesa no
              ciclo atual, o que faltar ao fechar o ciclo vira dívida do próximo.
            </p>
          ) : null}
          {excess > 0 ? (
            <p>
              {formatCurrency(excess)} serão registrados como juros/encargos e saem do orçamento
              deste ciclo.
            </p>
          ) : null}
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={overdue ? 'primary' : 'secondary'}
            disabled={saving}
            onClick={() => void submit(paidAmount)}
          >
            Confirmar pagamento
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** BR-FIN-033: juros/multa informados pelo banco; saem do orçamento do ciclo atual. */
export function StatementChargesDialog({ card, statement, onClose }: DialogProps) {
  const run = useDataStore((state) => state.run);
  const [amount, setAmount] = useState<MoneyCents>(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (amount <= 0) {
      setError('Informe o valor dos juros ou da multa.');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await run((state, ctx) =>
        addStatementCharges(state, { cardId: card.id, statementKey: statement.key, amount }, ctx),
      );
      toast.success('Juros/multa registrados.');
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível registrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Juros/multa da fatura ${card.name} ${formatMonthKey(statement.key)}`}
      description="Os juros/multa aumentam o que falta pagar desta fatura e saem do orçamento deste ciclo."
    >
      <div className="flex flex-col gap-4">
        <Field label="Valor dos juros/multa">
          {(props) => <MoneyInput {...props} autoFocus value={amount} onValueChange={setAmount} />}
        </Field>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            Registrar
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

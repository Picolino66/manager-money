import { useState } from 'react';
import { startOfDay } from 'date-fns';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import {
  addExistingCardDebt,
  addExistingCardDebts,
  ExistingCardDebtInput,
} from '@manager-money/core/application/card.use-cases';
import {
  buildExistingDebtInput,
  existingDebtCommitted,
  existingDebtCycleRange,
  findStatementBalance,
  isValidInstallmentCount,
  resolveChosenStatement,
  selectStatementChoices,
  validateExistingDebtDraft,
} from '@manager-money/core/application/card-debt';
import {
  describeInstallmentSchedule,
  formatMonthKey,
} from '@manager-money/core/application/card-text';
import { formatDayMonth } from '@manager-money/core/application/card-view';
import {
  selectActiveCycle,
  selectConfig,
  selectCreditCards,
} from '@manager-money/core/application/selectors';
import { addCycleKeys } from '@manager-money/core/domain/financial/credit-card';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  MoneyCents,
} from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

import { formatDateInput, toISODate } from '@manager-money/core/utils/date';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckboxField } from '@/components/ui/checkbox-field';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { EmptyState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { useDataStore } from '@/store/data.store';

type Mode = 'statement' | 'installments';
type Errors = Partial<
  Record<'description' | 'amount' | 'total' | 'remaining' | 'purchaseDate', string>
>;

/** Item do lote (parcelamento em andamento) aguardando o "Salvar tudo". */
type QueuedItem = {
  key: number;
  input: ExistingCardDebtInput;
  amount: MoneyCents;
  total: number;
  remaining: number;
  included: boolean;
};

let queueKey = 0;

const toCount = (value: string) => Number(value.replace(/\D/g, '')) || 0;

const MODES: { value: Mode; label: string }[] = [
  { value: 'statement', label: 'Fatura em aberto' },
  { value: 'installments', label: 'Parcelamento em andamento' },
];

/**
 * Situação inicial do cartão (BR-FIN-027/032): total da fatura em aberto (como o banco mostra) ou
 * parcelamento que já existia antes do app. Grava pelo caso de uso `addExistingCardDebt`; parcelas já
 * pagas não entram no orçamento nem no limite.
 */
export function CardDebtPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const doc = useDataStore((state) => state.doc);
  const run = useDataStore((state) => state.run);
  const [mode, setMode] = useState<Mode>('statement');
  const [description, setDescription] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [amount, setAmount] = useState<MoneyCents>(0);
  const [totalText, setTotalText] = useState('');
  const [remainingText, setRemainingText] = useState('');
  const [chosenKey, setChosenKey] = useState('');
  const [includeInBalance, setIncludeInBalance] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedItem[]>([]);

  if (!doc) return null;

  const card = selectCreditCards(doc).find((item) => item.id === id);
  const config = selectConfig(doc);

  if (!card) {
    return (
      <EmptyState
        title="Cartão não encontrado"
        message="Este cartão não existe mais."
        action={
          <Button asChild>
            <Link to="/cartoes">Voltar aos cartões</Link>
          </Button>
        }
      />
    );
  }

  if (!config) {
    return (
      <EmptyState
        title="Configuração pendente"
        message="Configure sua base financeira antes de cadastrar compras anteriores ao app."
        action={
          <Button asChild>
            <Link to="/ajustes/configuracao">Configurar</Link>
          </Button>
        }
      />
    );
  }

  const cardId = card.id;
  const today = startOfDay(new Date());
  const choices = selectStatementChoices(doc, card, today);
  const selectedKey = resolveChosenStatement(choices, chosenKey, card, today);
  const isInstallments = mode === 'installments';
  // BR-FIN-032: total da fatura já informado para a fatura escolhida (um por cartão + fatura).
  const balance = findStatementBalance(doc, cardId, selectedKey);
  const included = isInstallments && balance !== undefined && includeInBalance;
  const total = isInstallments ? toCount(totalText) : 1;
  const remaining = isInstallments ? toCount(remainingText) : 1;
  const { firstCycleKey, lastCycleKey } = existingDebtCycleRange(
    card,
    config.payday,
    selectActiveCycle(doc)?.startDate ?? null,
    selectedKey,
    remaining,
  );
  const categories = getSortedCategories(config);

  function selectMode(next: Mode) {
    setMode(next);
    setIncludeInBalance(true);
    setErrors({});
    setError(null);
    setLastSaved(null);
  }

  const draftIsEmpty =
    !description.trim() && amount === 0 && !totalText && !remainingText && !purchaseDate;
  const queuedCount = queue.length + (draftIsEmpty ? 0 : 1);
  const queueCommitted = queue.reduce(
    (sum, item) => sum + existingDebtCommitted(item.amount, item.remaining, item.included),
    0,
  );

  /** Valida o formulário e monta o item; `null` mostra os erros na tela. */
  function readDraft(): QueuedItem | null {
    const next = validateExistingDebtDraft(
      { mode, description, amount, total, remaining, purchaseDate },
      toISODate(new Date()),
    );

    setErrors(next);
    setError(null);

    if (Object.keys(next).length > 0) return null;

    return {
      key: ++queueKey,
      input: buildExistingDebtInput({
        cardId,
        mode,
        description,
        category,
        amount,
        total,
        remaining,
        statementKey: selectedKey,
        includedInBalance: included,
        purchaseDate,
      }),
      amount,
      total,
      remaining,
      included,
    };
  }

  function clearDraft() {
    setDescription('');
    setPurchaseDate('');
    setAmount(0);
    setTotalText('');
    setRemainingText('');
  }

  async function handleSave() {
    const item = readDraft();

    if (!item) return;

    setSaving(true);
    try {
      await run((state, ctx) => addExistingCardDebt(state, item.input, ctx));
      toast.success(`${item.input.description} cadastrado.`);
      setLastSaved(item.input.description);
      clearDraft();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  /** Parcelamento em lote: põe o item na lista e limpa o formulário (fatura e categoria ficam). */
  function handleAddToQueue() {
    const item = readDraft();

    if (!item) return;

    setQueue((current) => [...current, item]);
    setLastSaved(null);
    clearDraft();
  }

  async function handleSaveAll() {
    const items = [...queue];

    if (!draftIsEmpty) {
      const pending = readDraft();

      if (!pending) return;

      items.push(pending);
    }

    if (items.length === 0) {
      setError('Adicione ao menos um parcelamento à lista.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await run((state, ctx) =>
        addExistingCardDebts(
          state,
          items.map((item) => item.input),
          ctx,
        ),
      );
      const label =
        items.length === 1 ? items[0]!.input.description : `${items.length} parcelamentos`;
      toast.success(`${label} cadastrado.`);
      setLastSaved(label);
      setQueue([]);
      clearDraft();
    } catch (failure) {
      // Tudo ou nada: a lista continua como estava para corrigir o item citado.
      setError(failure instanceof Error ? failure.message : 'Não foi possível cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        to={`/cartoes/${cardId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-primary underline"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> {card.name}
      </Link>
      <PageHeader
        title="Compras anteriores ao app"
        description={`Cadastre o que o cartão ${card.name} já devia antes de você começar a usar o app. Parcelas já pagas não entram no orçamento nem no limite.`}
      />

      <div role="radiogroup" aria-label="Tipo de cadastro" className="mb-4 flex flex-wrap gap-2">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={mode === option.value}
            onClick={() => selectMode(option.value)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              mode === option.value
                ? 'border-primary bg-primary-soft text-primary-dark'
                : 'border-border bg-surface text-text hover:bg-surface-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Card className="flex max-w-2xl flex-col gap-4">
        <Field
          label={isInstallments ? 'Descrição' : 'Descrição (opcional)'}
          error={errors.description}
        >
          {(props) => (
            <Input
              placeholder={isInstallments ? 'Ex: Celular' : `Fatura ${formatMonthKey(selectedKey)}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              {...props}
            />
          )}
        </Field>
        {isInstallments ? (
          <Field label="Categoria">
            {(props) => (
              <NativeSelect
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                {...props}
              >
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </NativeSelect>
            )}
          </Field>
        ) : null}
        <Field
          label="Data da compra (opcional)"
          error={errors.purchaseDate}
          hint="Só informativa: a fatura e o limite seguem a fatura escolhida acima."
        >
          {(props) => (
            <Input
              type="date"
              max={toISODate(new Date())}
              value={purchaseDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              {...props}
            />
          )}
        </Field>
        <Field
          label={isInstallments ? 'Valor da parcela' : 'Valor da fatura'}
          error={errors.amount}
          hint={
            isInstallments
              ? undefined
              : 'Informe o total que aparece no app do banco para essa fatura.'
          }
        >
          {(props) => <MoneyInput {...props} value={amount} onValueChange={setAmount} />}
        </Field>
        {isInstallments ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Total de parcelas" error={errors.total}>
              {(props) => (
                <Input
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="Ex: 10"
                  value={totalText}
                  onChange={(event) => setTotalText(event.target.value)}
                  {...props}
                />
              )}
            </Field>
            <Field
              label="Parcelas restantes (incluindo a da fatura escolhida)"
              error={errors.remaining}
            >
              {(props) => (
                <Input
                  inputMode="numeric"
                  maxLength={2}
                  placeholder="Ex: 6"
                  value={remainingText}
                  onChange={(event) => setRemainingText(event.target.value)}
                  {...props}
                />
              )}
            </Field>
          </div>
        ) : null}
        {choices.length > 0 ? (
          <Field label={isInstallments ? 'Fatura da próxima parcela' : 'Fatura'}>
            {(props) => (
              <NativeSelect
                value={selectedKey}
                onChange={(event) => setChosenKey(event.target.value)}
                {...props}
              >
                {choices.map((choice) => (
                  <option key={choice.key} value={choice.key}>
                    Fatura {formatMonthKey(choice.key)} ·{' '}
                    {choice.status === 'open' ? 'aberta' : 'fechada'} · vence{' '}
                    {formatDayMonth(choice.dueDate)}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
        ) : (
          <p className="text-sm text-muted">
            Não há fatura disponível: as faturas vencidas ou com pagamento lançado não recebem
            compras anteriores.
          </p>
        )}
        {!isInstallments && balance ? (
          <p className="text-sm font-medium text-warning">
            Já existe um total informado para a fatura {formatMonthKey(selectedKey)} (
            {formatCurrency(balance.totalAmount)}).
          </p>
        ) : null}
        {isInstallments && balance ? (
          <CheckboxField
            label={`Esta parcela já está no total da fatura informada (${formatCurrency(balance.totalAmount)})`}
            checked={includeInBalance}
            onChange={(event) => setIncludeInBalance(event.target.checked)}
          />
        ) : null}

        {amount > 0 && isValidInstallmentCount(total, remaining) ? (
          <div aria-live="polite" className="flex flex-col gap-1 rounded-md bg-surface-muted p-3">
            <p className="text-sm font-semibold text-ink">
              {describeInstallmentSchedule(
                remaining,
                formatCurrency(amount),
                selectedKey,
                addCycleKeys(selectedKey, remaining - 1),
              )}
            </p>
            {included ? (
              <p className="text-sm text-muted">
                {remaining > 1
                  ? `A parcela de ${formatMonthKey(selectedKey)} já está no total; as próximas ${remaining - 1} serão somadas às faturas seguintes.`
                  : `A parcela de ${formatMonthKey(selectedKey)} já está no total.`}
              </p>
            ) : null}
            <p className="text-sm text-muted">
              {remaining > 1
                ? `Pesa nos ciclos de ${formatMonthKey(firstCycleKey)} a ${formatMonthKey(lastCycleKey)}.`
                : `Pesa no ciclo de ${formatMonthKey(firstCycleKey)}.`}{' '}
              Compromete {formatCurrency(existingDebtCommitted(amount, remaining, included))} do
              limite do cartão.
            </p>
            {total - remaining > 0 ? (
              <p className="text-sm text-muted">
                {total - remaining} parcela(s) já paga(s) ficam de fora do orçamento e do limite.
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-ink">
            {error}
          </p>
        ) : null}
        {isInstallments ? (
          <div className="flex justify-start">
            <Button
              variant="secondary"
              disabled={saving || choices.length === 0}
              onClick={handleAddToQueue}
            >
              <Plus aria-hidden className="h-4 w-4" /> Adicionar à lista
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button disabled={saving || choices.length === 0} onClick={() => void handleSave()}>
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        )}
      </Card>

      {isInstallments && queue.length > 0 ? (
        <Card className="mt-4 flex max-w-2xl flex-col gap-3">
          <h2 className="text-base font-semibold text-ink">Na lista ({queue.length})</h2>
          <ul className="flex flex-col divide-y divide-border">
            {queue.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{item.input.description}</p>
                  <p className="text-xs text-muted">
                    {describeInstallmentSchedule(
                      item.remaining,
                      formatCurrency(item.amount),
                      item.input.nextStatementKey,
                      addCycleKeys(item.input.nextStatementKey, item.remaining - 1),
                    )}
                    {item.total > item.remaining ? ` · de ${item.total}` : ''}
                    {item.input.purchaseDate
                      ? ` · compra em ${formatDateInput(item.input.purchaseDate)}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remover"
                  aria-label={`Remover ${item.input.description} da lista`}
                  onClick={() => setQueue((current) => current.filter((q) => q.key !== item.key))}
                >
                  <Trash2 aria-hidden className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">
            Compromete {formatCurrency(queueCommitted)} do limite do cartão.
          </p>
        </Card>
      ) : null}

      {isInstallments ? (
        <div className="mt-4 flex max-w-2xl justify-end">
          <Button disabled={saving || choices.length === 0} onClick={() => void handleSaveAll()}>
            {saving
              ? 'Salvando…'
              : queuedCount > 0
                ? `Salvar tudo (${queuedCount})`
                : 'Salvar tudo'}
          </Button>
        </div>
      ) : null}

      {lastSaved ? (
        <p aria-live="polite" className="mt-4 text-sm font-medium text-healthy">
          {lastSaved} cadastrado. Você pode cadastrar outro.
        </p>
      ) : null}
      <Button variant="ghost" className="mt-2" onClick={() => navigate(`/cartoes/${cardId}`)}>
        Concluir
      </Button>
    </>
  );
}

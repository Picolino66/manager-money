import { useState } from 'react';
import { startOfDay } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';

import { addExistingCardDebt } from '@manager-money/core/application/card.use-cases';
import {
  existingDebtCommitted,
  existingDebtCycleRange,
  findStatementBalance,
  isValidInstallmentCount,
  resolveChosenStatement,
  selectStatementChoices,
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
import {
  addCycleKeys,
  MAX_CARD_INSTALLMENTS,
} from '@manager-money/core/domain/financial/credit-card';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  MoneyCents,
} from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';

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
type Errors = Partial<Record<'description' | 'amount' | 'total' | 'remaining', string>>;

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
            <Link to="/ajustes/cartoes">Voltar aos cartões</Link>
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

  async function handleSave() {
    const next: Errors = {};

    if (isInstallments && !description.trim()) next.description = 'Informe uma descrição.';
    if (amount <= 0) next.amount = 'Informe um valor maior que zero.';

    if (isInstallments) {
      if (total < 1 || total > MAX_CARD_INSTALLMENTS) {
        next.total = `Informe de 1 a ${MAX_CARD_INSTALLMENTS} parcelas.`;
      }
      if (remaining < 1 || remaining > total) {
        next.remaining = 'As parcelas restantes devem ficar entre 1 e o total.';
      }
    }

    setErrors(next);
    setError(null);

    if (Object.keys(next).length > 0) return;

    const finalDescription = description.trim() || `Fatura ${formatMonthKey(selectedKey)}`;

    setSaving(true);
    try {
      await run((state, ctx) =>
        addExistingCardDebt(
          state,
          {
            cardId,
            description: finalDescription,
            category: isInstallments ? category : DEFAULT_EXPENSE_CATEGORY,
            installmentAmount: amount,
            totalInstallments: total,
            remainingInstallments: remaining,
            nextStatementKey: selectedKey,
            ...(isInstallments ? {} : { statementBalance: true }),
            ...(included ? { includedInStatementBalance: true } : {}),
          },
          ctx,
        ),
      );
      toast.success(`${finalDescription} cadastrado.`);
      setLastSaved(finalDescription);
      setDescription('');
      setAmount(0);
      setTotalText('');
      setRemainingText('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível cadastrar.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Link
        to={`/ajustes/cartoes/${cardId}`}
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
        <div className="flex justify-end">
          <Button disabled={saving || choices.length === 0} onClick={() => void handleSave()}>
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </Card>

      {lastSaved ? (
        <p aria-live="polite" className="mt-4 text-sm font-medium text-healthy">
          {lastSaved} cadastrado. Você pode cadastrar outro.
        </p>
      ) : null}
      <Button
        variant="ghost"
        className="mt-2"
        onClick={() => navigate(`/ajustes/cartoes/${cardId}`)}
      >
        Concluir
      </Button>
    </>
  );
}

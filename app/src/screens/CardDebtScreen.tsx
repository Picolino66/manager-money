import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { startOfDay } from 'date-fns';

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
import { ExistingCardDebtInput } from '@manager-money/core/application/card.use-cases';
import { selectCreditCards } from '@manager-money/core/application/selectors';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CurrencyInput } from '../components/CurrencyInput';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { TextInputField } from '../components/TextInputField';
import { radius, spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { addCycleKeys } from '@manager-money/core/domain/financial/credit-card';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  MoneyCents,
} from '@manager-money/core/domain/financial/financial.types';
import { RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatDateInput, parseBRDateInput, toISODate } from '@manager-money/core/utils/date';
import { formatCurrency } from '@manager-money/core/utils/currency';
import {
  describeInstallmentSchedule,
  formatMonthKey,
} from '@manager-money/core/application/card-text';
import { formatDayMonth } from '@manager-money/core/application/card-view';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDebt'>;

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

function toCount(value: string): number {
  return Number(value.replace(/\D/g, '')) || 0;
}

/**
 * SPEC-017/019 / BR-FIN-027/032: situação inicial do cartão — total da fatura em aberto (como o
 * banco mostra) ou parcelamento que já existia antes do app. Gera a agenda das parcelas restantes;
 * a parcela que já está no total informado só compõe esse total.
 */
export function CardDebtScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const doc = useFinancialStore((state) => state.doc);
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const addExistingCardDebt = useFinancialStore((state) => state.addExistingCardDebt);
  const addExistingCardDebts = useFinancialStore((state) => state.addExistingCardDebts);
  const [mode, setMode] = useState<Mode>('statement');
  const [description, setDescription] = useState('');
  const [dateText, setDateText] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [amount, setAmount] = useState<MoneyCents>(0);
  const [totalText, setTotalText] = useState('');
  const [remainingText, setRemainingText] = useState('');
  const [chosenKey, setChosenKey] = useState('');
  const [includeInBalance, setIncludeInBalance] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const card = selectCreditCards(doc).find((item) => item.id === route.params.cardId);

  if (!card) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Voltar"
          iconName="alert-circle-outline"
          message="Este cartão não existe mais neste aparelho."
          onActionPress={() => navigation.goBack()}
          title="Cartão não encontrado"
        />
      </Screen>
    );
  }

  if (!config) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Configurar"
          iconName="settings-outline"
          message="Configure sua base financeira antes de cadastrar compras anteriores ao app."
          onActionPress={() => navigation.navigate('Config')}
          title="Configuração pendente"
        />
      </Screen>
    );
  }

  const cardId = card.id;
  const today = startOfDay(new Date());
  const choices = selectStatementChoices(doc, card, today);
  const statementOptions = choices.map((choice) => ({
    value: choice.key,
    label: `Fatura ${formatMonthKey(choice.key)} · ${choice.status === 'open' ? 'aberta' : 'fechada'} · vence ${formatDayMonth(choice.dueDate)}`,
  }));
  const selectedKey = resolveChosenStatement(choices, chosenKey, card, today);
  const isInstallments = mode === 'installments';
  // BR-FIN-032: total da fatura já informado para a fatura escolhida (um por cartão + fatura).
  const balance = findStatementBalance(doc, cardId, selectedKey);
  const included = isInstallments && balance !== undefined && includeInBalance;
  const total = isInstallments ? toCount(totalText) : 1;
  const remaining = isInstallments ? toCount(remainingText) : 1;
  const isValidCount = isValidInstallmentCount(total, remaining);
  const { firstCycleKey, lastCycleKey } = existingDebtCycleRange(
    card,
    config.payday,
    activeMonth?.startDate ?? null,
    selectedKey,
    remaining,
  );
  const categoryOptions = getSortedCategories(config).map((value) => ({ label: value, value }));

  function selectMode(next: Mode) {
    setMode(next);
    setIncludeInBalance(true);
    setErrors({});
    setLastSaved(null);
  }

  const draftIsEmpty =
    !description.trim() && amount === 0 && !totalText && !remainingText && !dateText.trim();

  /** Valida o formulário e monta o item; `null` mostra os erros na tela. */
  function readDraft(): QueuedItem | null {
    const parsedDate = dateText.trim() ? parseBRDateInput(dateText) : null;
    const purchaseDate = parsedDate ? toISODate(parsedDate) : '';
    const nextErrors = validateExistingDebtDraft(
      { mode, description, amount, total, remaining, purchaseDate },
      toISODate(new Date()),
    );

    if (dateText.trim() && !parsedDate) nextErrors.purchaseDate = 'Use o formato DD/MM/AAAA.';

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return null;

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
    setDateText('');
    setAmount(0);
    setTotalText('');
    setRemainingText('');
  }

  function showFailure(error: unknown) {
    Alert.alert(
      'Não foi possível cadastrar',
      error instanceof Error ? error.message : 'Tente novamente.',
    );
  }

  async function handleSave() {
    const item = readDraft();

    if (!item) return;

    setIsSaving(true);

    try {
      await addExistingCardDebt(item.input);
      setLastSaved(item.input.description);
      clearDraft();
    } catch (error) {
      showFailure(error);
    } finally {
      setIsSaving(false);
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
      Alert.alert('Nada para salvar', 'Adicione ao menos um parcelamento à lista.');
      return;
    }

    setIsSaving(true);

    try {
      await addExistingCardDebts(items.map((item) => item.input));
      setLastSaved(
        items.length === 1 ? items[0]!.input.description : `${items.length} parcelamentos`,
      );
      setQueue([]);
      clearDraft();
    } catch (error) {
      // Tudo ou nada: a lista continua como estava para corrigir o item citado.
      showFailure(error);
    } finally {
      setIsSaving(false);
    }
  }

  const queueCommitted = queue.reduce(
    (sum, item) => sum + existingDebtCommitted(item.amount, item.remaining, item.included),
    0,
  );
  const queuedCount = queue.length + (draftIsEmpty ? 0 : 1);

  return (
    <Screen>
      <Text style={styles.title}>Compras anteriores ao app</Text>
      <Text style={styles.hint}>
        Cadastre o que o cartão {card.name} já devia antes de você começar a usar o app. Parcelas já
        pagas não entram no orçamento nem no limite.
      </Text>

      <View accessibilityRole="radiogroup" style={styles.chips}>
        <Chip
          label="Fatura em aberto"
          onPress={() => selectMode('statement')}
          selected={!isInstallments}
        />
        <Chip
          label="Parcelamento em andamento"
          onPress={() => selectMode('installments')}
          selected={isInstallments}
        />
      </View>

      <Card>
        <TextInputField
          error={errors.description}
          label={isInstallments ? 'Descrição' : 'Descrição (opcional)'}
          onChangeText={setDescription}
          placeholder={isInstallments ? 'Ex: Celular' : `Fatura ${formatMonthKey(selectedKey)}`}
          value={description}
        />
        {isInstallments ? (
          <SelectField
            label="Categoria"
            onChange={setCategory}
            options={categoryOptions}
            value={category}
          />
        ) : null}
        <TextInputField
          error={errors.purchaseDate}
          keyboardType="number-pad"
          label="Data da compra (opcional)"
          maxLength={10}
          onChangeText={setDateText}
          placeholder="DD/MM/AAAA"
          value={dateText}
        />
        <Text style={styles.hint}>
          Só informativa: a fatura e o limite seguem a fatura escolhida.
        </Text>
        <CurrencyInput
          error={errors.amount}
          label={isInstallments ? 'Valor da parcela' : 'Valor da fatura'}
          onChangeValue={setAmount}
          value={amount}
        />
        {!isInstallments ? (
          <Text style={styles.hint}>
            Informe o total que aparece no app do banco para essa fatura.
          </Text>
        ) : null}
        {isInstallments ? (
          <>
            <TextInputField
              error={errors.total}
              keyboardType="number-pad"
              label="Total de parcelas"
              maxLength={2}
              onChangeText={setTotalText}
              placeholder="Ex: 10"
              value={totalText}
            />
            <TextInputField
              error={errors.remaining}
              keyboardType="number-pad"
              label="Parcelas restantes (incluindo a da fatura escolhida)"
              maxLength={2}
              onChangeText={setRemainingText}
              placeholder="Ex: 6"
              value={remainingText}
            />
          </>
        ) : null}
        {statementOptions.length > 0 ? (
          <SelectField
            label={isInstallments ? 'Fatura da próxima parcela' : 'Fatura'}
            onChange={setChosenKey}
            options={statementOptions}
            value={selectedKey}
          />
        ) : null}
        {!isInstallments && balance ? (
          <Text style={styles.warning}>
            Já existe um total informado para a fatura {formatMonthKey(selectedKey)} (
            {formatCurrency(balance.totalAmount)}).
          </Text>
        ) : null}
        {isInstallments && balance ? (
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>
              Esta parcela já está no total da fatura informada (
              {formatCurrency(balance.totalAmount)})
            </Text>
            <Switch
              accessibilityLabel="Esta parcela já está no total da fatura informada"
              accessibilityRole="switch"
              onValueChange={setIncludeInBalance}
              thumbColor={colors.surface}
              trackColor={{ false: colors.disabled, true: colors.primary }}
              value={includeInBalance}
            />
          </View>
        ) : null}

        {amount > 0 && isValidCount ? (
          <View accessibilityLiveRegion="polite" style={styles.preview}>
            <Text style={styles.previewTitle}>
              {describeInstallmentSchedule(
                remaining,
                formatCurrency(amount),
                selectedKey,
                addCycleKeys(selectedKey, remaining - 1),
              )}
            </Text>
            {included ? (
              <Text style={styles.hint}>
                {remaining > 1
                  ? `A parcela de ${formatMonthKey(selectedKey)} já está no total; as próximas ${remaining - 1} serão somadas às faturas seguintes.`
                  : `A parcela de ${formatMonthKey(selectedKey)} já está no total.`}
              </Text>
            ) : null}
            <Text style={styles.hint}>
              {remaining > 1
                ? `Pesa nos ciclos de ${formatMonthKey(firstCycleKey)} a ${formatMonthKey(lastCycleKey)}.`
                : `Pesa no ciclo de ${formatMonthKey(firstCycleKey)}.`}{' '}
              Compromete {formatCurrency(existingDebtCommitted(amount, remaining, included))} do
              limite do cartão.
            </Text>
            {total - remaining > 0 ? (
              <Text style={styles.hint}>
                {total - remaining} parcela(s) já paga(s) ficam de fora do orçamento e do limite.
              </Text>
            ) : null}
          </View>
        ) : null}

        {isInstallments ? (
          <AppButton
            iconName="add-outline"
            onPress={handleAddToQueue}
            title="Adicionar à lista"
            variant="secondary"
          />
        ) : (
          <AppButton
            iconName="save-outline"
            isLoading={isSaving}
            onPress={() => void handleSave()}
            title="Salvar"
          />
        )}
      </Card>

      {isInstallments && queue.length > 0 ? (
        <Card>
          <Text style={styles.previewTitle}>Na lista ({queue.length})</Text>
          {queue.map((item) => (
            <View key={item.key} style={styles.queueRow}>
              <View style={styles.queueText}>
                <Text style={styles.queueTitle}>{item.input.description}</Text>
                <Text style={styles.hint}>
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
                </Text>
              </View>
              <AppButton
                accessibilityLabel={`Remover ${item.input.description} da lista`}
                iconName="trash-outline"
                onPress={() => setQueue((current) => current.filter((q) => q.key !== item.key))}
                title="Remover"
                variant="ghost"
              />
            </View>
          ))}
          <Text style={styles.hint}>
            Compromete {formatCurrency(queueCommitted)} do limite do cartão.
          </Text>
        </Card>
      ) : null}

      {isInstallments ? (
        <AppButton
          iconName="save-outline"
          isLoading={isSaving}
          onPress={() => void handleSaveAll()}
          title={queuedCount > 0 ? `Salvar tudo (${queuedCount})` : 'Salvar tudo'}
        />
      ) : null}

      {lastSaved ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {lastSaved} cadastrado. Você pode cadastrar outro.
        </Text>
      ) : null}

      <AppButton onPress={() => navigation.goBack()} title="Concluir" variant="ghost" />
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
  warning: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
  },
  switchLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  chipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '900',
  },
  queueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  queueText: {
    flex: 1,
    gap: 2,
  },
  queueTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  preview: {
    backgroundColor: colors.infoSoft,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
  },
  previewTitle: {
    color: colors.info,
    fontSize: 15,
    fontWeight: '900',
  },
  success: {
    color: colors.healthy,
    fontSize: 14,
    fontWeight: '800',
  },
}));

import { useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isAfter, startOfDay } from 'date-fns';

import { selectCardStatements, selectCreditCards } from '@manager-money/core/application/selectors';
import { isLive } from '@manager-money/core/application/state';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CurrencyInput } from '../components/CurrencyInput';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { TextInputField } from '../components/TextInputField';
import { radius, spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import {
  addCycleKeys,
  currentStatementKey,
  cycleKeyFromStartDate,
  MAX_CARD_INSTALLMENTS,
  statementCycleKey,
  statementDueDate,
} from '@manager-money/core/domain/financial/credit-card';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  MoneyCents,
} from '@manager-money/core/domain/financial/financial.types';
import { RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { toISODate } from '@manager-money/core/utils/date';
import { describeInstallmentSchedule, formatMonthKey } from '@manager-money/core/application/card-text';
import { formatDayMonth } from '@manager-money/core/application/card-view';

type Props = NativeStackScreenProps<RootStackParamList, 'CardDebt'>;

type Mode = 'statement' | 'installments';

type Errors = Partial<Record<'description' | 'amount' | 'total' | 'remaining', string>>;

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
  const [mode, setMode] = useState<Mode>('statement');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORY);
  const [amount, setAmount] = useState<MoneyCents>(0);
  const [totalText, setTotalText] = useState('');
  const [remainingText, setRemainingText] = useState('');
  const [chosenKey, setChosenKey] = useState('');
  const [includeInBalance, setIncludeInBalance] = useState(true);
  const [errors, setErrors] = useState<Errors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
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
  const openKey = currentStatementKey(card, today);
  const paidKeys = new Set(
    selectCardStatements(doc, cardId, today)
      // Fatura com qualquer lançamento (pago ou parcial) não recebe compras anteriores.
      .filter((statement) => statement.payments.length > 0)
      .map((statement) => statement.key),
  );
  // Faturas ainda não vencidas: a fechada aguardando vencimento (se houver) e a aberta.
  const statementOptions = [addCycleKeys(openKey, -1), openKey]
    .filter((key) => !isAfter(today, statementDueDate(key, card)) && !paidKeys.has(key))
    .map((key) => ({
      value: key,
      label: `Fatura ${formatMonthKey(key)} · ${key === openKey ? 'aberta' : 'fechada'} · vence ${formatDayMonth(toISODate(statementDueDate(key, card)))}`,
    }));
  const selectedKey =
    statementOptions.find((option) => option.value === chosenKey)?.value ??
    statementOptions[0]?.value ??
    openKey;
  const isInstallments = mode === 'installments';
  // BR-FIN-032: total da fatura já informado para a fatura escolhida (um por cartão + fatura).
  const balance = doc.cardPurchases.find(
    (purchase) =>
      isLive(purchase) &&
      purchase.cardId === cardId &&
      purchase.kind === 'statement-balance' &&
      purchase.firstStatementKey === selectedKey,
  );
  const included = isInstallments && balance !== undefined && includeInBalance;
  const total = isInstallments ? toCount(totalText) : 1;
  const remaining = isInstallments ? toCount(remainingText) : 1;
  const isValidCount =
    total >= 1 && total <= MAX_CARD_INSTALLMENTS && remaining >= 1 && remaining <= total;
  const activeCycleKey = activeMonth ? cycleKeyFromStartDate(activeMonth.startDate) : null;
  const dueCycleKey = statementCycleKey(selectedKey, card, config.payday);
  const firstCycleKey =
    activeCycleKey && activeCycleKey > dueCycleKey ? activeCycleKey : dueCycleKey;
  const lastCycleKey = addCycleKeys(firstCycleKey, remaining - 1);
  const categoryOptions = getSortedCategories(config).map((value) => ({ label: value, value }));

  function selectMode(next: Mode) {
    setMode(next);
    setIncludeInBalance(true);
    setErrors({});
    setLastSaved(null);
  }

  async function handleSave() {
    const nextErrors: Errors = {};

    if (isInstallments && !description.trim()) nextErrors.description = 'Informe uma descrição.';
    if (amount <= 0) nextErrors.amount = 'Informe um valor maior que zero.';

    if (isInstallments) {
      if (total < 1 || total > MAX_CARD_INSTALLMENTS) {
        nextErrors.total = `Informe de 1 a ${MAX_CARD_INSTALLMENTS} parcelas.`;
      }
      if (remaining < 1 || remaining > total) {
        nextErrors.remaining = 'As parcelas restantes devem ficar entre 1 e o total.';
      }
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    const finalDescription = description.trim() || `Fatura ${formatMonthKey(selectedKey)}`;

    setIsSaving(true);

    try {
      await addExistingCardDebt({
        cardId,
        description: finalDescription,
        category: isInstallments ? category : DEFAULT_EXPENSE_CATEGORY,
        installmentAmount: amount,
        totalInstallments: total,
        remainingInstallments: remaining,
        nextStatementKey: selectedKey,
        ...(isInstallments ? {} : { statementBalance: true }),
        ...(included ? { includedInStatementBalance: true } : {}),
      });
      setLastSaved(finalDescription);
      setDescription('');
      setAmount(0);
      setTotalText('');
      setRemainingText('');
    } catch (error) {
      Alert.alert(
        'Não foi possível cadastrar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    } finally {
      setIsSaving(false);
    }
  }

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
              Compromete {formatCurrency(amount * (included ? remaining - 1 : remaining))} do limite
              do cartão.
            </Text>
            {total - remaining > 0 ? (
              <Text style={styles.hint}>
                {total - remaining} parcela(s) já paga(s) ficam de fora do orçamento e do limite.
              </Text>
            ) : null}
          </View>
        ) : null}

        <AppButton
          iconName="save-outline"
          isLoading={isSaving}
          onPress={() => void handleSave()}
          title="Salvar"
        />
      </Card>

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

import { useMemo, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { RootStackParamList } from '../navigation/types';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CategoryPicker } from '../components/CategoryPicker';
import { CurrencyInput } from '../components/CurrencyInput';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import {
  calculateFixedExpensesTotal,
  calculateIncomeTotal,
  calculatePrimaryIncomeSource,
  getSortedCategories,
  normalizeCategory,
} from '@manager-money/core/domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_PAYDAY,
  IncomeSource,
  InstallmentFixedExpense,
  MAX_PAYDAY,
  MIN_PAYDAY,
  PermanentFixedExpense,
} from '@manager-money/core/domain/financial/financial.types';
import { spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, 'Config'>;

const configSchema = z.object({
  incomeSources: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1, 'Informe o nome da fonte.'),
        amount: z.number().int().positive('Informe um valor maior que zero.'),
        payday: z
          .number()
          .int()
          .min(MIN_PAYDAY, 'Informe um dia entre 1 e 28.')
          .max(MAX_PAYDAY, 'Informe um dia entre 1 e 28.'),
        active: z.boolean().optional(),
      }),
    )
    .min(1, 'Informe ao menos uma fonte de renda.')
    // BR-FIN-018: ao menos uma fonte ativa (o domínio também valida).
    .refine((sources) => sources.some((source) => source.active !== false), {
      message: 'Mantenha ao menos uma fonte de renda ativa.',
    }),
  permanentExpenses: z.array(
    z.object({
      id: z.string().min(1),
      type: z.literal('permanent'),
      name: z.string().trim().min(1, 'Informe o nome da despesa.'),
      category: z.string().trim().min(1),
      amount: z.number().int().min(0, 'Valor não pode ser negativo.'),
      active: z.boolean().optional(),
    }),
  ),
  installmentExpenses: z.array(
    z.object({
      id: z.string().min(1),
      type: z.literal('installment'),
      name: z.string().trim().min(1, 'Informe o nome do parcelamento.'),
      category: z.string().trim().min(1),
      installmentAmount: z.number().int().positive('Informe uma parcela maior que zero.'),
      totalInstallments: z.number().int().min(1, 'Informe ao menos uma parcela.'),
      remainingInstallments: z.number().int().min(0),
      startedAtCycleId: z.string().optional(),
      active: z.boolean().optional(),
    }),
  ),
  savingGoal: z.number().int().min(0, 'Meta não pode ser negativa.'),
});

type ConfigForm = z.infer<typeof configSchema>;

/** Grava `active: false` só quando desligado; ligado = campo ausente (compatível com dados antigos). */
function withActiveFlag<T extends { active?: boolean }>({
  active,
  ...item
}: T): Omit<T, 'active'> & {
  active?: false;
} {
  return active === false ? { ...item, active: false } : item;
}

function createIncomeSource(name = '', payday: number = DEFAULT_PAYDAY): IncomeSource {
  return {
    id: `income-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    amount: 0,
    payday,
  };
}

export function ConfigScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const saveConfig = useFinancialStore((state) => state.saveConfig);
  const categories = getSortedCategories(config);
  const [isPermanentExpanded, setIsPermanentExpanded] = useState(false);
  const [isInstallmentExpanded, setIsInstallmentExpanded] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<ConfigForm>({
    resolver: zodResolver(configSchema),
    defaultValues: {
      incomeSources: config?.incomeSources ?? [createIncomeSource('Salário', config?.payday)],
      permanentExpenses:
        config?.fixedExpenses.filter((expense) => expense.type === 'permanent') ?? [],
      installmentExpenses:
        config?.fixedExpenses.filter((expense) => expense.type === 'installment') ?? [],
      savingGoal: config?.savingGoal ?? 0,
    },
  });
  const {
    fields: incomeSourceFields,
    append: appendIncomeSource,
    remove: removeIncomeSource,
  } = useFieldArray<ConfigForm, 'incomeSources', 'fieldKey'>({
    control,
    keyName: 'fieldKey',
    name: 'incomeSources',
  });
  const {
    fields: permanentExpenseFields,
    prepend: prependPermanentExpense,
    remove: removePermanentExpense,
  } = useFieldArray<ConfigForm, 'permanentExpenses', 'fieldKey'>({
    control,
    keyName: 'fieldKey',
    name: 'permanentExpenses',
  });
  const {
    fields: installmentExpenseFields,
    prepend: prependInstallmentExpense,
    remove: removeInstallmentExpense,
  } = useFieldArray<ConfigForm, 'installmentExpenses', 'fieldKey'>({
    control,
    keyName: 'fieldKey',
    name: 'installmentExpenses',
  });
  // useWatch é seguro para o React Compiler (watch() não pode ser memoizado).
  const incomeSources = useWatch({ control, name: 'incomeSources' });
  const incomeSourcesError =
    errors.incomeSources?.message ?? errors.incomeSources?.root?.message ?? null;
  const incomeTotal = useMemo(() => calculateIncomeTotal(incomeSources), [incomeSources]);
  const primarySource = calculatePrimaryIncomeSource(incomeSources);
  const permanentExpenses = useWatch({ control, name: 'permanentExpenses' });
  const installmentExpenses = useWatch({ control, name: 'installmentExpenses' });
  const fixedExpenses = useMemo(
    () => [...permanentExpenses, ...installmentExpenses],
    [installmentExpenses, permanentExpenses],
  );
  const fixedExpensesTotal = useMemo(
    () => calculateFixedExpensesTotal({ fixedExpenses }),
    [fixedExpenses],
  );

  function createFixedExpense(): PermanentFixedExpense {
    return {
      id: `fixed-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'permanent',
      name: '',
      category: DEFAULT_EXPENSE_CATEGORY,
      amount: 0,
    };
  }

  function createInstallmentExpense(): InstallmentFixedExpense {
    return {
      id: `installment-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: 'installment',
      name: '',
      category: DEFAULT_EXPENSE_CATEGORY,
      installmentAmount: 0,
      totalInstallments: 1,
      remainingInstallments: 1,
    };
  }

  function handleAddPermanentExpense() {
    setIsPermanentExpanded(true);
    prependPermanentExpense(createFixedExpense());
  }

  function handleAddInstallmentExpense() {
    setIsInstallmentExpanded(true);
    prependInstallmentExpense(createInstallmentExpense());
  }

  async function persist(values: ConfigForm) {
    try {
      await save(values);
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  }

  async function save(values: ConfigForm) {
    await saveConfig({
      incomeSources: values.incomeSources.map((source) =>
        withActiveFlag({ ...source, name: source.name.trim() }),
      ),
      savingGoal: values.savingGoal,
      customCategories: config?.customCategories ?? [],
      fixedExpenses: [
        ...values.permanentExpenses.map((expense) =>
          withActiveFlag({
            ...expense,
            name: expense.name.trim(),
            category: normalizeCategory(expense.category),
          }),
        ),
        ...values.installmentExpenses.map((expense) =>
          withActiveFlag({
            ...expense,
            name: expense.name.trim(),
            category: normalizeCategory(expense.category),
            remainingInstallments: Math.min(
              expense.remainingInstallments,
              expense.totalInstallments,
            ),
          }),
        ),
      ],
    });
    navigation.navigate(activeMonth ? 'MainTabs' : 'StartMonth');
  }

  function onSubmit(values: ConfigForm) {
    const plannedOutflow =
      calculateFixedExpensesTotal({
        fixedExpenses: [...values.permanentExpenses, ...values.installmentExpenses],
      }) + values.savingGoal;

    if (plannedOutflow > calculateIncomeTotal(values.incomeSources)) {
      Alert.alert('Plano acima da renda', 'Despesas fixas e meta passam da renda mensal.', [
        { text: 'Revisar', style: 'cancel' },
        {
          text: 'Salvar mesmo assim',
          style: 'destructive',
          onPress: () => {
            void persist(values);
          },
        },
      ]);
      return;
    }

    void persist(values);
  }

  return (
    <Screen
      footer={
        <AppButton
          iconName="save-outline"
          isLoading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
          title="Salvar configuração"
        />
      }
    >
      <Text style={styles.title}>Configuração financeira</Text>
      <Card>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Renda mensal</Text>
          <View style={styles.sectionMetaRow}>
            <Text numberOfLines={1} style={styles.sectionSubtitle}>
              Total: {formatCurrency(incomeTotal)}
            </Text>
            <AppButton
              iconName="add-outline"
              onPress={() => appendIncomeSource(createIncomeSource('', primarySource?.payday))}
              style={styles.addButton}
              title="Adicionar"
              variant="secondary"
            />
          </View>
        </View>
        {primarySource && primarySource.payday >= MIN_PAYDAY ? (
          <Text style={styles.hint}>
            O ciclo usa o dia {primarySource.payday}
            {primarySource.name.trim()
              ? ` (${primarySource.name.trim()}, a fonte de maior valor)`
              : ''}
            .
          </Text>
        ) : null}
        {incomeSourcesError ? <Text style={styles.errorText}>{incomeSourcesError}</Text> : null}
        {incomeSourceFields.map((field, index) => (
          <View key={field.fieldKey} style={styles.fixedExpenseItem}>
            <Controller
              control={control}
              name={`incomeSources.${index}.name`}
              render={({ field: itemField }) => (
                <TextInputField
                  autoCapitalize="sentences"
                  error={errors.incomeSources?.[index]?.name?.message}
                  label="Nome da fonte"
                  onBlur={itemField.onBlur}
                  onChangeText={itemField.onChange}
                  placeholder="Ex: salário"
                  value={itemField.value}
                />
              )}
            />
            <Controller
              control={control}
              name={`incomeSources.${index}.amount`}
              render={({ field: itemField }) => (
                <CurrencyInput
                  error={errors.incomeSources?.[index]?.amount?.message}
                  label="Valor"
                  onBlur={itemField.onBlur}
                  onChangeValue={itemField.onChange}
                  value={itemField.value}
                />
              )}
            />
            <Controller
              control={control}
              name={`incomeSources.${index}.payday`}
              render={({ field: itemField }) => (
                <TextInputField
                  error={errors.incomeSources?.[index]?.payday?.message}
                  keyboardType="number-pad"
                  label="Dia do pagamento (1 a 28)"
                  maxLength={2}
                  onBlur={itemField.onBlur}
                  onChangeText={(value) =>
                    itemField.onChange(Number(value.replace(/\D/g, '')) || 0)
                  }
                  value={itemField.value ? String(itemField.value) : ''}
                />
              )}
            />
            <Controller
              control={control}
              name={`incomeSources.${index}.active`}
              render={({ field: itemField }) => (
                <ActiveToggle
                  accessibilityLabel={`Fonte de renda ${index + 1} ativa`}
                  inactiveHint="Não soma na renda nem define o dia do ciclo."
                  onChange={itemField.onChange}
                  value={itemField.value !== false}
                />
              )}
            />
            {incomeSourceFields.length > 1 ? (
              <AppButton
                iconName="trash-outline"
                onPress={() => removeIncomeSource(index)}
                title="Remover"
                variant="ghost"
              />
            ) : null}
          </View>
        ))}
      </Card>

      <Card>
        <Controller
          control={control}
          name="savingGoal"
          render={({ field }) => (
            <CurrencyInput
              error={errors.savingGoal?.message}
              label="Meta mensal de economia"
              onBlur={field.onBlur}
              onChangeValue={field.onChange}
              value={field.value}
            />
          )}
        />
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsPermanentExpanded((value) => !value)}
            style={styles.sectionTitleButton}
          >
            <Text style={styles.sectionTitle}>Despesas fixas</Text>
            <Ionicons
              color={colors.muted}
              name={isPermanentExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={20}
            />
          </Pressable>
          <View style={styles.sectionMetaRow}>
            <Text numberOfLines={1} style={styles.sectionSubtitle}>
              Total: {formatCurrency(fixedExpensesTotal)}
            </Text>
            <AppButton
              iconName="add-outline"
              onPress={handleAddPermanentExpense}
              style={styles.addButton}
              title="Adicionar"
              variant="secondary"
            />
          </View>
        </View>

        {isPermanentExpanded ? (
          <>
            {permanentExpenseFields.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma despesa fixa cadastrada.</Text>
            ) : null}

            {permanentExpenseFields.map((field, index) => (
              <View key={field.fieldKey} style={styles.fixedExpenseItem}>
                <Controller
                  control={control}
                  name={`permanentExpenses.${index}.name`}
                  render={({ field: itemField }) => (
                    <TextInputField
                      autoCapitalize="sentences"
                      error={errors.permanentExpenses?.[index]?.name?.message}
                      label="Nome"
                      onBlur={itemField.onBlur}
                      onChangeText={itemField.onChange}
                      placeholder="Ex: aluguel"
                      value={itemField.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`permanentExpenses.${index}.amount`}
                  render={({ field: itemField }) => (
                    <CurrencyInput
                      error={errors.permanentExpenses?.[index]?.amount?.message}
                      label="Valor"
                      onBlur={itemField.onBlur}
                      onChangeValue={itemField.onChange}
                      value={itemField.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`permanentExpenses.${index}.category`}
                  render={({ field: itemField }) => (
                    <CategoryPicker
                      categories={categories}
                      label="Categoria"
                      onSelectCategory={itemField.onChange}
                      selectedCategory={itemField.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`permanentExpenses.${index}.active`}
                  render={({ field: itemField }) => (
                    <ActiveToggle
                      accessibilityLabel={`Despesa fixa ${index + 1} ativa`}
                      inactiveHint="Não reserva dinheiro no ciclo nem aparece para pagar."
                      onChange={itemField.onChange}
                      value={itemField.value !== false}
                    />
                  )}
                />
                <AppButton
                  iconName="trash-outline"
                  onPress={() => removePermanentExpense(index)}
                  title="Remover"
                  variant="ghost"
                />
              </View>
            ))}
          </>
        ) : null}
      </Card>

      <Card>
        <View style={styles.sectionHeader}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsInstallmentExpanded((value) => !value)}
            style={styles.sectionTitleButton}
          >
            <Text style={styles.sectionTitle}>Parcelamentos</Text>
            <Ionicons
              color={colors.muted}
              name={isInstallmentExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              size={20}
            />
          </Pressable>
          <View style={styles.sectionMetaRow}>
            <Text numberOfLines={1} style={styles.sectionSubtitle}>
              Fora do cartão, por ciclo
            </Text>
            <AppButton
              iconName="calendar-outline"
              onPress={handleAddInstallmentExpense}
              style={styles.addButton}
              title="Adicionar"
              variant="secondary"
            />
          </View>
        </View>

        <Text style={styles.hint}>
          Parcelamentos do cartão de crédito são cadastrados no próprio cartão (em Cartões,
          &quot;Compras anteriores ao app&quot;). Aqui ficam carnês, financiamentos e outros
          parcelamentos fora do cartão.
        </Text>

        {isInstallmentExpanded ? (
          <>
            {installmentExpenseFields.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum parcelamento cadastrado.</Text>
            ) : null}

            {installmentExpenseFields.map((field, index) => (
              <View key={field.fieldKey} style={styles.fixedExpenseItem}>
                <Controller
                  control={control}
                  name={`installmentExpenses.${index}.name`}
                  render={({ field: itemField }) => (
                    <TextInputField
                      autoCapitalize="sentences"
                      error={errors.installmentExpenses?.[index]?.name?.message}
                      label="Nome"
                      onBlur={itemField.onBlur}
                      onChangeText={itemField.onChange}
                      placeholder="Ex: notebook"
                      value={itemField.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`installmentExpenses.${index}.installmentAmount`}
                  render={({ field: itemField }) => (
                    <CurrencyInput
                      error={errors.installmentExpenses?.[index]?.installmentAmount?.message}
                      label="Valor da parcela"
                      onBlur={itemField.onBlur}
                      onChangeValue={itemField.onChange}
                      value={itemField.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`installmentExpenses.${index}.category`}
                  render={({ field: itemField }) => (
                    <CategoryPicker
                      categories={categories}
                      label="Categoria"
                      onSelectCategory={itemField.onChange}
                      selectedCategory={itemField.value}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`installmentExpenses.${index}.totalInstallments`}
                  render={({ field: itemField }) => (
                    <TextInputField
                      error={errors.installmentExpenses?.[index]?.totalInstallments?.message}
                      keyboardType="number-pad"
                      label="Total de parcelas"
                      onBlur={itemField.onBlur}
                      onChangeText={(value) => {
                        const totalInstallments = Number(value.replace(/\D/g, '')) || 1;
                        itemField.onChange(totalInstallments);
                        setValue(
                          `installmentExpenses.${index}.remainingInstallments`,
                          totalInstallments,
                        );
                      }}
                      value={String(itemField.value)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`installmentExpenses.${index}.remainingInstallments`}
                  render={({ field: itemField }) => (
                    <TextInputField
                      error={errors.installmentExpenses?.[index]?.remainingInstallments?.message}
                      keyboardType="number-pad"
                      label="Parcelas restantes"
                      onBlur={itemField.onBlur}
                      onChangeText={(value) => {
                        itemField.onChange(Number(value.replace(/\D/g, '')) || 0);
                      }}
                      value={String(itemField.value)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name={`installmentExpenses.${index}.active`}
                  render={({ field: itemField }) => (
                    <ActiveToggle
                      accessibilityLabel={`Parcelamento ${index + 1} ativo`}
                      inactiveHint="Não reserva dinheiro no ciclo e as parcelas ficam pausadas."
                      onChange={itemField.onChange}
                      value={itemField.value !== false}
                    />
                  )}
                />
                <AppButton
                  iconName="trash-outline"
                  onPress={() => removeInstallmentExpense(index)}
                  title="Remover"
                  variant="ghost"
                />
              </View>
            ))}
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

type ActiveToggleProps = {
  accessibilityLabel: string;
  inactiveHint: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** Interruptor Ativa/Inativa (BR-FIN-018 e despesas fixas): inativo fica guardado, mas não pesa. */
function ActiveToggle({ accessibilityLabel, inactiveHint, value, onChange }: ActiveToggleProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.activeRow}>
      <View style={styles.activeText}>
        <Text style={styles.activeLabel}>{value ? 'Ativa' : 'Inativa'}</Text>
        {!value ? <Text style={styles.hint}>{inactiveHint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="switch"
        onValueChange={onChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.disabled, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  activeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
  },
  activeText: {
    flex: 1,
    gap: 2,
  },
  activeLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  sectionHeader: {
    gap: spacing.md,
  },
  sectionTitleButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sectionMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  sectionSubtitle: {
    color: colors.muted,
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  addButton: {
    minHeight: 40,
    minWidth: 112,
    paddingHorizontal: spacing.md,
  },
  fixedExpenseItem: {
    gap: spacing.md,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    color: colors.critical,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
}));

import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
  getSortedCategories,
  normalizeCategory,
} from '../domain/financial/financial.calculations';
import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_PAYDAY,
  InstallmentFixedExpense,
  MAX_PAYDAY,
  MIN_PAYDAY,
  PermanentFixedExpense,
} from '../domain/financial/financial.types';
import { colors, spacing, typography } from '../design/theme';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';

type Props = NativeStackScreenProps<RootStackParamList, 'Config'>;

const configSchema = z.object({
  monthlyIncome: z.number().int().positive('Informe uma renda maior que zero.'),
  permanentExpenses: z.array(
    z.object({
      id: z.string().min(1),
      type: z.literal('permanent'),
      name: z.string().trim().min(1, 'Informe o nome da despesa.'),
      category: z.string().trim().min(1),
      amount: z.number().int().min(0, 'Valor não pode ser negativo.'),
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
    }),
  ),
  savingGoal: z.number().int().min(0, 'Meta não pode ser negativa.'),
  payday: z
    .number()
    .int()
    .min(MIN_PAYDAY, 'Informe um dia entre 1 e 28.')
    .max(MAX_PAYDAY, 'Informe um dia entre 1 e 28.'),
});

type ConfigForm = z.infer<typeof configSchema>;

export function ConfigScreen({ navigation }: Props) {
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
      monthlyIncome: config?.monthlyIncome ?? 0,
      permanentExpenses:
        config?.fixedExpenses.filter((expense) => expense.type === 'permanent') ?? [],
      installmentExpenses:
        config?.fixedExpenses.filter((expense) => expense.type === 'installment') ?? [],
      savingGoal: config?.savingGoal ?? 0,
      payday: config?.payday ?? DEFAULT_PAYDAY,
    },
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
      monthlyIncome: values.monthlyIncome,
      savingGoal: values.savingGoal,
      payday: values.payday,
      customCategories: config?.customCategories ?? [],
      fixedExpenses: [
        ...values.permanentExpenses.map((expense) => ({
          ...expense,
          name: expense.name.trim(),
          category: normalizeCategory(expense.category),
        })),
        ...values.installmentExpenses.map((expense) => ({
          ...expense,
          name: expense.name.trim(),
          category: normalizeCategory(expense.category),
          remainingInstallments: Math.min(
            expense.remainingInstallments,
            expense.totalInstallments,
          ),
        })),
      ],
    });
    navigation.navigate(activeMonth ? 'MainTabs' : 'StartMonth');
  }

  function onSubmit(values: ConfigForm) {
    const plannedOutflow =
      calculateFixedExpensesTotal({
        fixedExpenses: [...values.permanentExpenses, ...values.installmentExpenses],
      }) + values.savingGoal;

    if (plannedOutflow > values.monthlyIncome) {
      Alert.alert(
        'Plano acima da renda',
        'Despesas fixas e meta passam da renda mensal.',
        [
          { text: 'Revisar', style: 'cancel' },
          {
            text: 'Salvar mesmo assim',
            style: 'destructive',
            onPress: () => {
              void persist(values);
            },
          },
        ],
      );
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
        <Controller
          control={control}
          name="monthlyIncome"
          render={({ field }) => (
            <CurrencyInput
              error={errors.monthlyIncome?.message}
              label="Renda mensal"
              onBlur={field.onBlur}
              onChangeValue={field.onChange}
              value={field.value}
            />
          )}
        />
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
        <Controller
          control={control}
          name="payday"
          render={({ field }) => (
            <TextInputField
              error={errors.payday?.message}
              keyboardType="number-pad"
              label="Dia do pagamento (1 a 28)"
              maxLength={2}
              onBlur={field.onBlur}
              onChangeText={(value) => field.onChange(Number(value.replace(/\D/g, '')) || 0)}
              value={field.value ? String(field.value) : ''}
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
              Cartão de crédito por ciclo
            </Text>
            <AppButton
              iconName="card-outline"
              onPress={handleAddInstallmentExpense}
              style={styles.addButton}
              title="Adicionar"
              variant="secondary"
            />
          </View>
        </View>

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

const styles = StyleSheet.create({
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
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});

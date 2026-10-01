import { Alert, StyleSheet, Text } from 'react-native';
import { useEffect, useMemo } from 'react';
import { isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { RootStackParamList } from '../navigation/types';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CurrencyInput } from '../components/CurrencyInput';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { TextInputField } from '../components/TextInputField';
import {
  getSortedCategories,
  normalizeCategory,
} from '../domain/financial/financial.calculations';
import { DEFAULT_EXPENSE_CATEGORY } from '../domain/financial/financial.types';
import { colors, spacing, typography } from '../design/theme';
import { useFinancialStore } from '../store/financial.store';
import { formatCycleLabel, formatDateInput, parseBRDateInput, toISODate } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const expenseSchema = z.object({
  amount: z.number().int().positive('Informe um valor maior que zero.'),
  category: z.string().trim().min(1),
  description: z.string().trim().min(1, 'Informe uma descricao.'),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use o formato DD/MM/AAAA.'),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export function AddExpenseScreen({ navigation, route }: Props) {
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const addExpense = useFinancialStore((state) => state.addExpense);
  const updateExpense = useFinancialStore((state) => state.updateExpense);
  const categories = getSortedCategories(config);
  const categoryOptions = categories.map((category) => ({ label: category, value: category }));
  const expenseId = route.params?.expenseId;
  const expenseToEdit = useMemo(
    () => activeMonth?.expenses.find((expense) => expense.id === expenseId) ?? null,
    [activeMonth?.expenses, expenseId],
  );
  const isEditing = Boolean(expenseId);
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      category: DEFAULT_EXPENSE_CATEGORY,
      description: '',
      date: formatDateInput(toISODate(new Date())),
    },
  });

  useEffect(() => {
    if (expenseToEdit) {
      reset({
        amount: expenseToEdit.amount,
        category: expenseToEdit.category,
        description: expenseToEdit.description,
        date: formatDateInput(expenseToEdit.date),
      });
    }
  }, [expenseToEdit, reset]);

  if (!activeMonth) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Iniciar ciclo"
          iconName="play-circle-outline"
          message="Abra um ciclo mensal antes de registrar gastos."
          onActionPress={() => navigation.navigate('StartMonth')}
          title="Nenhum ciclo ativo"
        />
      </Screen>
    );
  }

  if (isEditing && !expenseToEdit) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Voltar"
          iconName="alert-circle-outline"
          message="Nao encontramos o lancamento selecionado para edicao."
          onActionPress={() => navigation.goBack()}
          title="Lancamento nao encontrado"
        />
      </Screen>
    );
  }

  async function onSubmit(values: ExpenseForm) {
    if (!activeMonth) {
      return;
    }

    const parsedExpenseDate = parseBRDateInput(values.date);

    if (!parsedExpenseDate) {
      Alert.alert('Data invalida', 'Use uma data no formato DD/MM/AAAA.');
      return;
    }

    const expenseDate = startOfDay(parsedExpenseDate);
    const cycleStart = startOfDay(parseISO(activeMonth.startDate));
    const cycleEnd = startOfDay(parseISO(activeMonth.endDate));

    if (isBefore(expenseDate, cycleStart) || isAfter(expenseDate, cycleEnd)) {
      Alert.alert(
        'Data fora do ciclo',
        `Informe uma data entre ${formatCycleLabel(activeMonth.startDate, activeMonth.endDate)}.`,
      );
      return;
    }

    try {
      const expenseInput = {
        ...values,
        category: normalizeCategory(values.category),
        date: toISODate(parsedExpenseDate),
      };

      if (isEditing && expenseId) {
        await updateExpense(expenseId, expenseInput);
      } else {
        await addExpense(expenseInput);
      }

      navigation.goBack();
    } catch (error) {
      Alert.alert(
        isEditing ? 'Nao foi possivel atualizar' : 'Nao foi possivel salvar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>{isEditing ? 'Editar gasto' : 'Novo gasto'}</Text>
      <Card>
        <Controller
          control={control}
          name="amount"
          render={({ field }) => (
            <CurrencyInput
              error={errors.amount?.message}
              label="Valor"
              onBlur={field.onBlur}
              onChangeValue={field.onChange}
              value={field.value}
            />
          )}
        />
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <SelectField
              label="Categoria"
              onChange={field.onChange}
              options={categoryOptions}
              value={field.value}
            />
          )}
        />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextInputField
              autoCapitalize="sentences"
              error={errors.description?.message}
              label="Descricao"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="Almoco"
              value={field.value}
            />
          )}
        />
        <Controller
          control={control}
          name="date"
          render={({ field }) => (
            <TextInputField
              error={errors.date?.message}
              label="Data"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder="24/04/2026"
              value={field.value}
            />
          )}
        />
      </Card>
      <AppButton
        iconName={isEditing ? 'save-outline' : 'add-circle-outline'}
        isLoading={isSubmitting}
        onPress={handleSubmit(onSubmit)}
        title={isEditing ? 'Salvar alteracoes' : 'Salvar gasto'}
      />
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
});

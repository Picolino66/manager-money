import { Alert, StyleSheet, Text } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { zodResolver } from '@hookform/resolvers/zod';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { RootStackParamList } from '../navigation/types';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CardLimitNotice, confirmCardLimit } from '../components/CardLimitNotice';
import { CurrencyInput } from '../components/CurrencyInput';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { TextInputField } from '../components/TextInputField';
import {
  calculateFirstCycleKey,
  cycleKeyFromStartDate,
  cycleKeyOffset,
  MAX_CARD_INSTALLMENTS,
  splitInstallments,
  statementDueDate,
  statementKeyForDate,
} from '../domain/financial/credit-card';
import { getSortedCategories, normalizeCategory } from '../domain/financial/financial.calculations';
import { selectActiveCreditCards, selectCardLimitUsage } from '../application/selectors';
import { DEFAULT_EXPENSE_CATEGORY } from '../domain/financial/financial.types';
import { colors, spacing, typography } from '../design/theme';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import { describeFirstInstallment } from './cardText';
import {
  formatCycleLabel,
  formatDateInput,
  formatShortDate,
  parseBRDateInput,
  toISODate,
} from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

const expenseSchema = z.object({
  amount: z.number().int().positive('Informe um valor maior que zero.'),
  category: z.string().trim().min(1),
  // Opcional à vista; obrigatória no crédito (validada no envio, o domínio exige).
  description: z.string().trim(),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Use o formato DD/MM/AAAA.'),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

export function AddExpenseScreen({ navigation, route }: Props) {
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const addExpense = useFinancialStore((state) => state.addExpense);
  const updateExpense = useFinancialStore((state) => state.updateExpense);
  const deleteExpense = useFinancialStore((state) => state.deleteExpense);
  const addCardPurchase = useFinancialStore((state) => state.addCardPurchase);
  const doc = useFinancialStore((state) => state.doc);
  // BR-FIN-028: cartão desativado some do formulário de compra.
  const creditCards = selectActiveCreditCards(doc);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit'>('cash');
  const [cardId, setCardId] = useState<string | null>(null);
  const [installmentsText, setInstallmentsText] = useState('1');
  const categories = getSortedCategories(config);
  const categoryOptions = categories.map((category) => ({ label: category, value: category }));
  const expenseId = route.params?.expenseId;
  const expenseToEdit = useMemo(
    () => activeMonth?.expenses.find((expense) => expense.id === expenseId) ?? null,
    [activeMonth?.expenses, expenseId],
  );
  const isEditing = Boolean(expenseId);
  const isCredit = !isEditing && paymentMethod === 'credit';
  const selectedCard = creditCards.find((card) => card.id === cardId) ?? creditCards[0] ?? null;
  const installments = Number(installmentsText.replace(/\D/g, '')) || 0;
  const {
    control,
    handleSubmit,
    reset,
    setError,
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

  // useWatch é seguro para o React Compiler (watch() não pode ser memoizado).
  const watchedAmount = useWatch({ control, name: 'amount' });
  const watchedDateText = useWatch({ control, name: 'date' });

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
          message="Não encontramos o lançamento selecionado para edição."
          onActionPress={() => navigation.goBack()}
          title="Lançamento não encontrado"
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
      Alert.alert('Data inválida', 'Use uma data no formato DD/MM/AAAA.');
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

    if (isCredit) {
      if (!selectedCard) {
        Alert.alert('Nenhum cartão', 'Cadastre um cartão antes de registrar compras no crédito.');
        return;
      }

      if (installments < 1 || installments > MAX_CARD_INSTALLMENTS) {
        Alert.alert('Parcelas inválidas', `Informe de 1 a ${MAX_CARD_INSTALLMENTS} parcelas.`);
        return;
      }

      if (!values.description) {
        setError('description', { message: 'Informe uma descrição.' });
        return;
      }

      // BR-FIN-026: passar do limite só gera aviso; a pessoa decide continuar.
      if (!(await confirmCardLimit(selectCardLimitUsage(doc, selectedCard.id), values.amount))) {
        return;
      }

      try {
        await addCardPurchase({
          cardId: selectedCard.id,
          description: values.description,
          category: normalizeCategory(values.category),
          totalAmount: values.amount,
          installments,
          date: toISODate(parsedExpenseDate),
        });
        navigation.goBack();
      } catch (error) {
        Alert.alert(
          'Não foi possível salvar',
          error instanceof Error ? error.message : 'Tente novamente.',
        );
      }

      return;
    }

    try {
      const category = normalizeCategory(values.category);
      const expenseInput = {
        ...values,
        // Sem descrição, o histórico mostra a categoria.
        description: values.description || category,
        category,
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
        isEditing ? 'Não foi possível atualizar' : 'Não foi possível salvar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  }

  function handleDelete() {
    if (!expenseId) {
      return;
    }

    Alert.alert('Excluir gasto?', 'Esta ação não pode ser desfeita.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          deleteExpense(expenseId)
            .then(() => navigation.goBack())
            .catch((error: unknown) => {
              Alert.alert(
                'Não foi possível excluir',
                error instanceof Error ? error.message : 'Tente novamente.',
              );
            });
        },
      },
    ]);
  }

  const watchedDate = parseBRDateInput(watchedDateText);
  const firstCycleKey =
    isCredit && selectedCard && watchedDate && config
      ? calculateFirstCycleKey(
          watchedDate,
          selectedCard,
          config.payday,
          cycleKeyFromStartDate(activeMonth.startDate),
        )
      : null;
  const cyclesAhead = firstCycleKey
    ? cycleKeyOffset(cycleKeyFromStartDate(activeMonth.startDate), firstCycleKey)
    : 0;
  const installmentValues =
    isCredit && watchedAmount > 0 && installments >= 1 && installments <= MAX_CARD_INSTALLMENTS
      ? splitInstallments(watchedAmount, installments)
      : [];
  const statementDue =
    isCredit && selectedCard && watchedDate
      ? formatShortDate(
          toISODate(
            statementDueDate(
              statementKeyForDate(watchedDate, selectedCard.closingDay),
              selectedCard,
            ),
          ),
        )
      : null;
  const limitUsage = isCredit && selectedCard ? selectCardLimitUsage(doc, selectedCard.id) : null;

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
              label={isCredit ? 'Valor total (com juros)' : 'Valor'}
              onBlur={field.onBlur}
              onChangeValue={field.onChange}
              value={field.value}
            />
          )}
        />
        {!isEditing ? (
          <SelectField
            label="Forma de pagamento"
            onChange={(value) => setPaymentMethod(value === 'credit' ? 'credit' : 'cash')}
            options={[
              { label: 'À vista (Pix, dinheiro ou débito)', value: 'cash' },
              { label: 'Cartão de crédito', value: 'credit' },
            ]}
            value={paymentMethod}
          />
        ) : null}
        {isCredit && creditCards.length === 0 ? (
          <>
            <Text style={styles.hint}>Cadastre um cartão para registrar compras no crédito.</Text>
            <AppButton
              iconName="card-outline"
              onPress={() => navigation.navigate('Cards')}
              title="Cadastrar cartão"
              variant="secondary"
            />
          </>
        ) : null}
        {isCredit && selectedCard ? (
          <>
            <SelectField
              label="Cartão"
              onChange={setCardId}
              options={creditCards.map((card) => ({ label: card.name, value: card.id }))}
              value={selectedCard.id}
            />
            <TextInputField
              keyboardType="number-pad"
              label="Parcelas"
              maxLength={2}
              onChangeText={setInstallmentsText}
              value={installmentsText}
            />
            <CardLimitNotice amount={watchedAmount} usage={limitUsage} />
            {installmentValues.length > 0 ? (
              <Text style={styles.hint}>
                {installments}x de {formatCurrency(installmentValues[0] ?? 0)}
                {statementDue ? ` · entra na fatura que vence ${statementDue}` : ''} ·{' '}
                {describeFirstInstallment(cyclesAhead)}. O valor informado já deve incluir os juros.
              </Text>
            ) : null}
          </>
        ) : null}
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
              label="Descrição"
              onBlur={field.onBlur}
              onChangeText={field.onChange}
              placeholder={isCredit ? 'Ex.: notebook' : 'Opcional · ex.: almoço'}
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
        title={
          isEditing ? 'Salvar alterações' : isCredit ? 'Salvar compra no crédito' : 'Salvar gasto'
        }
      />
      {isEditing ? (
        <AppButton
          iconName="trash-outline"
          onPress={handleDelete}
          title="Excluir gasto"
          variant="danger"
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
});

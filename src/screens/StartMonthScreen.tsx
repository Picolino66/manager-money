import { Alert, StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { calculateNextCycleStartDate } from '../application/cycle.use-cases';
import {
  buildFinancialCycleDates,
  calculateDailyLimit,
  calculateFixedExpenseAmount,
  calculateFixedExpensesTotal,
  calculateInitialAvailableAmount,
  calculatePreviousMonthDebt,
  calculateRemainingDays,
} from '../domain/financial/financial.calculations';
import { colors, spacing, typography } from '../design/theme';
import { selectCardCharges } from '../application/selectors';
import { cycleKeyFromStartDate } from '../domain/financial/credit-card';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import { formatCycleLabel } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'StartMonth'>;

export function StartMonthScreen({ navigation }: Props) {
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const months = useFinancialStore((state) => state.months);
  const startFinancialCycle = useFinancialStore((state) => state.startFinancialCycle);
  const doc = useFinancialStore((state) => state.doc);

  if (!config) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Configurar"
          iconName="settings-outline"
          message="Defina a base financeira antes de abrir um ciclo mensal."
          onActionPress={() => navigation.navigate('Config')}
          title="Configuração pendente"
        />
      </Screen>
    );
  }

  if (activeMonth) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Voltar ao dashboard"
          iconName="checkmark-circle-outline"
          message="Existe um ciclo mensal ativo em andamento."
          onActionPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
          title="Ciclo já iniciado"
        />
      </Screen>
    );
  }

  const cycleDates = buildFinancialCycleDates(calculateNextCycleStartDate(doc, new Date()), config.payday);
  const previousClosedMonth = months[0];
  const previousMonthDebt = calculatePreviousMonthDebt(previousClosedMonth);
  const fixedExpensesTotal = calculateFixedExpensesTotal(config);
  const cardCharges = selectCardCharges(doc, cycleKeyFromStartDate(cycleDates.startDate));
  const initialAvailableAmount = calculateInitialAvailableAmount(config, previousMonthDebt, { cardCharges });
  const remainingDays = calculateRemainingDays(
    {
      id: 'preview',
      ...cycleDates,
      startedAt: cycleDates.receivedAt,
      status: 'active',
      initialAvailableAmount,
      previousMonthDebt,
      expenses: [],
    },
    new Date(),
  );
  const dailyLimit = calculateDailyLimit(initialAvailableAmount, remainingDays);

  async function handleStartMonth() {
    try {
      await startFinancialCycle();
      navigation.navigate('MainTabs', { screen: 'Dashboard' });
    } catch (error) {
      Alert.alert(
        'Não foi possível iniciar o ciclo',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Abrir ciclo</Text>
      <Card>
        <MetricRow label="Renda mensal" value={formatCurrency(config.monthlyIncome)} />
        <MetricRow label="Despesas fixas (a pagar no ciclo)" value={formatCurrency(fixedExpensesTotal)} />
        {config.fixedExpenses.map((expense) => (
          <MetricRow
            key={expense.id}
            label={
              expense.type === 'installment'
                ? `${expense.name} - ${expense.category} (${expense.remainingInstallments}/${expense.totalInstallments})`
                : `${expense.name} - ${expense.category}`
            }
            value={formatCurrency(calculateFixedExpenseAmount(expense))}
          />
        ))}
        <MetricRow label="Meta de economia" value={formatCurrency(config.savingGoal)} />
        <MetricRow label="Faturas de cartão" value={formatCurrency(cardCharges)} />
        <MetricRow
          label="Dívida herdada"
          tone={previousMonthDebt > 0 ? 'negative' : 'default'}
          value={formatCurrency(previousMonthDebt)}
        />
        <MetricRow label="Saldo disponível" value={formatCurrency(initialAvailableAmount)} />
        <MetricRow
          label="Período"
          value={formatCycleLabel(cycleDates.startDate, cycleDates.endDate)}
        />
        <MetricRow label="Dias do ciclo" value={String(remainingDays)} />
        <MetricRow label="Limite diário inicial" value={formatCurrency(dailyLimit)} />
      </Card>
      <AppButton iconName="play-circle-outline" onPress={() => void handleStartMonth()} title="Iniciar ciclo" />
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

import { StyleSheet, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
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
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import { formatCycleLabel } from '../utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'StartMonth'>;

export function StartMonthScreen({ navigation }: Props) {
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const months = useFinancialStore((state) => state.months);
  const startFinancialCycle = useFinancialStore((state) => state.startFinancialCycle);
  const cycleDates = buildFinancialCycleDates();

  if (!config) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Configurar"
          iconName="settings-outline"
          message="Defina a base financeira antes de abrir um ciclo mensal."
          onActionPress={() => navigation.navigate('Config')}
          title="Configuracao pendente"
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
          title="Ciclo ja iniciado"
        />
      </Screen>
    );
  }

  const previousClosedMonth = [...months]
    .filter((item) => item.status === 'closed')
    .sort((left, right) => right.endDate.localeCompare(left.endDate))[0];
  const previousMonthDebt = calculatePreviousMonthDebt(previousClosedMonth);
  const fixedExpensesTotal = calculateFixedExpensesTotal(config);
  const initialAvailableAmount = calculateInitialAvailableAmount(config, previousMonthDebt);
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
    await startFinancialCycle();
    navigation.navigate('MainTabs', { screen: 'Dashboard' });
  }

  return (
    <Screen>
      <Text style={styles.title}>Abrir ciclo</Text>
      <Card>
        <MetricRow label="Renda mensal" value={formatCurrency(config.monthlyIncome)} />
        <MetricRow label="Despesas fixas" value={formatCurrency(fixedExpensesTotal)} />
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
        <MetricRow
          label="Divida herdada"
          tone={previousMonthDebt > 0 ? 'negative' : 'default'}
          value={formatCurrency(previousMonthDebt)}
        />
        <MetricRow label="Saldo disponivel" value={formatCurrency(initialAvailableAmount)} />
        <MetricRow
          label="Periodo"
          value={formatCycleLabel(cycleDates.startDate, cycleDates.endDate)}
        />
        <MetricRow label="Dias do ciclo" value={String(remainingDays)} />
        <MetricRow label="Limite diario inicial" value={formatCurrency(dailyLimit)} />
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

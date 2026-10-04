import { Alert, Text } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { openCycle } from '@manager-money/core/application/cycle.use-cases';
import {
  calculateDailyLimit,
  calculateFixedExpenseAmount,
  calculateRemainingDays,
} from '@manager-money/core/domain/financial/financial.calculations';
import { spacing, typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import {
  selectActiveCycle,
  selectCycleAdjustments,
  selectPendingFixedExpenses,
} from '@manager-money/core/application/selectors';
import { LocalState } from '@manager-money/core/application/state';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatCycleLabel } from '@manager-money/core/utils/date';

type Props = NativeStackScreenProps<RootStackParamList, 'StartMonth'>;

/**
 * Prévia fiel do ciclo: roda o mesmo caso de uso de abertura sobre uma cópia do documento (puro,
 * nada é gravado). Assim fixas reservadas, parcelas que avançam e faturas batem com o ciclo real.
 */
function previewCycle(doc: LocalState, now: Date) {
  try {
    const preview = openCycle(doc, { now, newId: (prefix) => `${prefix}-preview` });
    const cycle = selectActiveCycle(preview);

    return cycle
      ? {
          cycle,
          adjustments: selectCycleAdjustments(preview, cycle),
          pendingFixed: selectPendingFixedExpenses(preview, cycle.id),
        }
      : null;
  } catch {
    return null;
  }
}

export function StartMonthScreen({ navigation }: Props) {
  const styles = useStyles();
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
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

  const now = new Date();
  const preview = previewCycle(doc, now);

  if (!preview) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Revisar configuração"
          iconName="alert-circle-outline"
          message="Não foi possível calcular o próximo ciclo. Revise a configuração."
          onActionPress={() => navigation.navigate('Config')}
          title="Configuração incompleta"
        />
      </Screen>
    );
  }

  const { cycle, adjustments, pendingFixed } = preview;
  const remainingDays = calculateRemainingDays({ ...cycle, expenses: [] }, now);
  const dailyLimit = calculateDailyLimit(cycle.initialAvailableAmount, remainingDays);

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
        <MetricRow
          label="Renda mensal (fontes ativas)"
          value={formatCurrency(config.monthlyIncome)}
        />
        <MetricRow
          label="− Despesas fixas reservadas"
          value={formatCurrency(adjustments.pendingFixedExpenses)}
        />
        {pendingFixed.map((expense) => (
          <MetricRow
            indent
            key={expense.id}
            label={
              expense.type === 'installment'
                ? `${expense.name} - ${expense.category} (${expense.remainingInstallments}/${expense.totalInstallments})`
                : `${expense.name} - ${expense.category}`
            }
            value={formatCurrency(calculateFixedExpenseAmount(expense))}
          />
        ))}
        <MetricRow label="− Meta de economia" value={formatCurrency(config.savingGoal)} />
        <MetricRow
          label="− Faturas de cartão do ciclo"
          value={formatCurrency(adjustments.cardCharges)}
        />
        <MetricRow
          label="− Dívida herdada"
          tone={cycle.previousMonthDebt > 0 ? 'negative' : 'default'}
          value={formatCurrency(cycle.previousMonthDebt)}
        />
        <MetricRow
          label="= Saldo disponível"
          tone={cycle.initialAvailableAmount < 0 ? 'negative' : 'default'}
          value={formatCurrency(cycle.initialAvailableAmount)}
        />
        <MetricRow label="Período" value={formatCycleLabel(cycle.startDate, cycle.endDate)} />
        <MetricRow label="Dias do ciclo" value={String(remainingDays)} />
        <MetricRow label="Limite diário inicial" value={formatCurrency(dailyLimit)} />
        <Text style={styles.hint}>
          As despesas fixas ficam reservadas até você pagá-las; pagas no crédito, passam a pesar
          pela fatura do cartão.
        </Text>
      </Card>
      <AppButton
        iconName="play-circle-outline"
        onPress={() => void handleStartMonth()}
        title="Iniciar ciclo"
      />
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  hint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
}));

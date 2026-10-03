import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { FixedExpensesCard } from '../components/FixedExpensesCard';
import { MetricRow } from '../components/MetricRow';
import { PayFixedExpenseModal } from '../components/PayFixedExpenseModal';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList } from '../navigation/types';
import { colors, spacing, typography } from '../design/theme';
import {
  canCloseActiveCycle,
  canReceiveIncomeEarlyNow,
} from '../application/cycle.use-cases';
import {
  buildDashboardSummary,
  calculateFixedExpenseAmount,
  calculateFixedExpensesTotal,
  describeCloseCycleBlock,
} from '../domain/financial/financial.calculations';
import { PayFixedExpenseInput } from '../application/payment.use-cases';
import { selectCycleAdjustments, selectCyclePayments } from '../application/selectors';
import { FixedPaymentRecord, isLive } from '../application/state';
import { DayStatus, FixedExpense } from '../domain/financial/financial.types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import { clampIsoDate, toISODate } from '../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const heroStatusColors: Record<DayStatus, { backgroundColor: string; borderColor: string }> = {
  healthy: { backgroundColor: colors.healthySoft, borderColor: colors.healthy },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  critical: { backgroundColor: colors.criticalSoft, borderColor: colors.critical },
  negative: { backgroundColor: colors.negativeSoft, borderColor: colors.negative },
};

export function DashboardScreen() {
  const navigation = useNavigation<Navigation>();
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const closeActiveMonth = useFinancialStore((state) => state.closeActiveMonth);
  const receiveIncomeEarly = useFinancialStore((state) => state.receiveIncomeEarly);
  const payFixedExpense = useFinancialStore((state) => state.payFixedExpense);
  const undoFixedPayment = useFinancialStore((state) => state.undoFixedPayment);
  const doc = useFinancialStore((state) => state.doc);
  const today = new Date();
  const showReceiveEarly = canReceiveIncomeEarlyNow(doc, today);
  const canClose = canCloseActiveCycle(doc, today);
  const [payingExpense, setPayingExpense] = useState<FixedExpense | null>(null);
  const adjustments = activeMonth ? selectCycleAdjustments(doc, activeMonth) : null;
  const cyclePayments = activeMonth ? selectCyclePayments(doc, activeMonth.id) : [];
  const installmentsByPurchaseId = Object.fromEntries(
    doc.cardPurchases.filter(isLive).map((purchase) => [purchase.id, purchase.installments]),
  );

  const summary = useMemo(() => {
    if (!activeMonth) {
      return null;
    }

    return buildDashboardSummary(activeMonth);
  }, [activeMonth]);

  const fixedMetrics = useMemo(() => {
    if (!config) {
      return null;
    }

    const fixedExpensesTotal = calculateFixedExpensesTotal(config);

    return [
      ['Renda mensal', formatCurrency(config.monthlyIncome)],
      ['Despesas fixas', formatCurrency(fixedExpensesTotal)],
      ['Meta de economia', formatCurrency(config.savingGoal)],
    ] as const;
  }, [config]);

  function handleConfirmPayment(input: Omit<PayFixedExpenseInput, 'fixedExpenseId'>) {
    const expense = payingExpense;

    if (!expense) {
      return Promise.resolve();
    }

    return payFixedExpense({ ...input, fixedExpenseId: expense.id }).then(
      () => setPayingExpense(null),
      (error: unknown) => {
        Alert.alert(
          'Não foi possível registrar o pagamento',
          error instanceof Error ? error.message : 'Tente novamente.',
        );
      },
    );
  }

  function handleUndoPayment(payment: FixedPaymentRecord) {
    Alert.alert('Desfazer pagamento?', `${payment.name} voltará a ficar pendente.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desfazer',
        style: 'destructive',
        onPress: () => {
          void undoFixedPayment(payment.id).catch((error: unknown) => {
            Alert.alert(
              'Não foi possível desfazer',
              error instanceof Error ? error.message : 'Tente novamente.',
            );
          });
        },
      },
    ]);
  }

  function handleCloseMonth() {
    Alert.alert('Fechar ciclo', 'O ciclo ativo será movido para o histórico.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Fechar',
        style: 'destructive',
        onPress: () => {
          void closeActiveMonth().catch((error) => {
            Alert.alert(
              'Não foi possível fechar o ciclo',
              error instanceof Error ? error.message : 'Tente novamente.',
            );
          });
        },
      },
    ]);
  }

  function handleReceiveIncomeEarly() {
    Alert.alert(
      'Já recebi',
      'O ciclo atual será fechado e um novo ciclo será aberto a partir de hoje.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            void receiveIncomeEarly().catch((error) => {
              Alert.alert(
                'Não foi possível abrir o ciclo',
                error instanceof Error ? error.message : 'Tente novamente.',
              );
            });
          },
        },
      ],
    );
  }

  if (!config) {
    return (
      <Screen>
        <Header />
        <EmptyState
          actionLabel="Configurar"
          iconName="settings-outline"
          message="Informe renda, despesas fixas e meta mensal."
          onActionPress={() => navigation.navigate('Config')}
          title="Configuração inicial"
        />
      </Screen>
    );
  }

  if (!activeMonth || !summary) {
    return (
      <Screen>
        <Header />
        <Card>
          <Text style={styles.sectionTitle}>Base financeira</Text>
          {fixedMetrics?.map(([label, value]) => (
            <MetricRow key={label} label={label} value={value} />
          ))}
        </Card>
        <EmptyState
          actionLabel="Iniciar ciclo"
          iconName="play-circle-outline"
          message="Crie o ciclo mensal para liberar o limite diário."
          onActionPress={() => navigation.navigate('StartMonth')}
          title="Nenhum ciclo ativo"
        />
        <AppButton
          iconName="settings-outline"
          onPress={() => navigation.navigate('Config')}
          title="Editar configuração"
          variant="secondary"
        />
      </Screen>
    );
  }

  const heroColors = heroStatusColors[summary.dayStatus];

  return (
    <Screen>
      <Header cycleLabel={summary.cycleLabel} />

      <Card style={[styles.heroCard, heroColors]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Ainda pode gastar</Text>
          <StatusBadge status={summary.dayStatus} />
        </View>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>
          {formatCurrency(summary.todayBalance)}
        </Text>
        <View style={styles.heroMetrics}>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Você já gastou</Text>
            <Text style={styles.heroMetricValue}>{formatCurrency(summary.todaySpent)}</Text>
          </View>
          <View style={styles.heroMetric}>
            <Text style={styles.heroMetricLabel}>Hoje você pode gastar</Text>
            <Text style={styles.heroMetricValue}>{formatCurrency(summary.currentDailyLimit)}</Text>
          </View>
        </View>
      </Card>

      <View style={styles.actionsGrid}>
        <AppButton
          iconName="add-circle-outline"
          onPress={() => navigation.navigate('AddExpense')}
          style={styles.gridButton}
          title="Registrar"
        />
        <AppButton
          iconName="cash-outline"
          onPress={() => navigation.navigate('Incomes')}
          style={styles.gridButton}
          title="Renda"
          variant="secondary"
        />
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Resumo do ciclo</Text>
        <MetricRow label="Saldo inicial" value={formatCurrency(summary.initialAvailableAmount)} />
        <MetricRow label="Saldo restante" value={formatCurrency(summary.remainingAvailableAmount)} />
        <MetricRow label="Total gasto" value={formatCurrency(summary.totalSpent)} />
        <MetricRow label="Dias restantes" value={String(summary.remainingDays)} />
      </Card>

      <FixedExpensesCard
        expenses={config.fixedExpenses}
        installmentsByPurchaseId={installmentsByPurchaseId}
        onPay={setPayingExpense}
        onUndo={handleUndoPayment}
        payments={cyclePayments}
      />

      <Card>
        <Text style={styles.sectionTitle}>Plano do ciclo</Text>
        <MetricRow label="Renda mensal" value={fixedMetrics?.[0][1] ?? ''} />
        <MetricRow label="Rendas avulsas" value={formatCurrency(adjustments?.extraIncome ?? 0)} />
        <MetricRow label="Despesas fixas pagas" value={formatCurrency(adjustments?.paidFixedExpenses ?? 0)} />
        <MetricRow label="Meta de economia" value={fixedMetrics?.[2][1] ?? ''} />
        <MetricRow label="Faturas de cartão" value={formatCurrency(adjustments?.cardCharges ?? 0)} />
        <MetricRow label="Dívida herdada" value={formatCurrency(activeMonth.previousMonthDebt)} />
      </Card>

      {showReceiveEarly ? (
        <AppButton
          iconName="cash-outline"
          onPress={handleReceiveIncomeEarly}
          title="Já recebi"
          variant="secondary"
        />
      ) : null}

      {canClose ? (
        <Text style={styles.cycleEndedText}>
          O período deste ciclo terminou. Feche-o para começar o próximo.
        </Text>
      ) : (
        <Text style={styles.closeHint}>{describeCloseCycleBlock(activeMonth)}</Text>
      )}
      <AppButton
        disabled={!canClose}
        iconName="checkmark-done-outline"
        onPress={handleCloseMonth}
        title="Fechar ciclo"
        variant="danger"
      />

      {payingExpense ? (
        <PayFixedExpenseModal
          amount={calculateFixedExpenseAmount(payingExpense)}
          cards={doc.creditCards.filter(isLive)}
          cycleStartDate={activeMonth.startDate}
          name={payingExpense.name}
          onClose={() => setPayingExpense(null)}
          onConfirm={handleConfirmPayment}
          onRegisterCard={() => {
            setPayingExpense(null);
            navigation.navigate('Cards');
          }}
          payday={config.payday}
          paymentDate={clampIsoDate(toISODate(today), activeMonth.startDate, activeMonth.endDate)}
        />
      ) : null}
    </Screen>
  );
}

function Header({ cycleLabel }: { cycleLabel?: string }) {
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{cycleLabel ?? 'Manager Money'}</Text>
      <Text style={styles.title}>Limite diário</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  heroCard: {
    borderWidth: 1,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heroLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  heroValue: {
    color: colors.ink,
    fontSize: typography.metric,
    fontWeight: '900',
  },
  heroMetrics: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroMetric: {
    flex: 1,
    gap: spacing.xs,
  },
  heroMetricLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  heroMetricValue: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '900',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  gridButton: {
    flex: 1,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  closeHint: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  cycleEndedText: {
    color: colors.warning,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

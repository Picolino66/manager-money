import { useMemo, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { CyclePlanCard } from '../components/CyclePlanCard';
import { EmptyState } from '../components/EmptyState';
import { FixedExpensesCard } from '../components/FixedExpensesCard';
import { MetricRow } from '../components/MetricRow';
import { PayFixedExpenseModal } from '../components/PayFixedExpenseModal';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { RootStackParamList } from '../navigation/types';
import { spacing, ThemeColors, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import {
  canCloseActiveCycle,
  canReceiveIncomeEarlyNow,
} from '@manager-money/core/application/cycle.use-cases';
import {
  buildDashboardSummary,
  calculateFixedExpenseAmount,
  calculateFixedExpensesTotal,
  describeCloseCycleBlock,
} from '@manager-money/core/domain/financial/financial.calculations';
import { PayFixedExpenseInput } from '@manager-money/core/application/payment.use-cases';
import {
  selectActiveCreditCards,
  selectCardLimitUsage,
  selectCycleAdjustments,
  selectCyclePayments,
  selectCreditSnapshot,
  selectRecurringIssues,
} from '@manager-money/core/application/selectors';
import { FixedPaymentRecord, isLive } from '@manager-money/core/application/state';
import { DayStatus, FixedExpense } from '@manager-money/core/domain/financial/financial.types';
import { useFinancialStore } from '../store/financial.store';
import { describeCycleStatements } from '@manager-money/core/application/card-view';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { clampIsoDate, toISODate } from '@manager-money/core/utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const heroStatusColors = (
  colors: ThemeColors,
): Record<DayStatus, { backgroundColor: string; borderColor: string }> => ({
  healthy: { backgroundColor: colors.healthySoft, borderColor: colors.healthy },
  warning: { backgroundColor: colors.warningSoft, borderColor: colors.warning },
  critical: { backgroundColor: colors.criticalSoft, borderColor: colors.critical },
  negative: { backgroundColor: colors.negativeSoft, borderColor: colors.negative },
});

export function DashboardScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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
  const activeCards = selectActiveCreditCards(doc);
  const cardLimits = Object.fromEntries(
    activeCards.map((card) => [card.id, selectCardLimitUsage(doc, card.id)]),
  );

  const summary = useMemo(() => {
    if (!activeMonth) {
      return null;
    }

    return buildDashboardSummary(activeMonth);
  }, [activeMonth]);

  // BR-FIN-037: limite disponível e gasto na fatura vigente, somados nos cartões ativos.
  const credit = useMemo(() => selectCreditSnapshot(doc, new Date()), [doc]);

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
      <Screen refreshable>
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
      <Screen refreshable>
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

  const heroColors = heroStatusColors(colors)[summary.dayStatus];

  return (
    <Screen refreshable>
      <Header cycleLabel={summary.cycleLabel} />

      <Card style={[styles.heroCard, heroColors]}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>Ainda pode gastar hoje</Text>
          <StatusBadge status={summary.dayStatus} />
        </View>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.heroValue}>
          {formatCurrency(summary.todayBalance)}
        </Text>
        <View style={styles.heroMetrics}>
          <HeroMetric label="Já gastou hoje" value={formatCurrency(summary.todaySpent)} />
          <HeroMetric
            label="Disponível no ciclo"
            negative={summary.remainingAvailableAmount < 0}
            value={formatCurrency(summary.remainingAvailableAmount)}
          />
          <HeroMetric
            label="Disponível no crédito"
            negative={credit.availableLimit !== null && credit.availableLimit < 0}
            value={credit.availableLimit === null ? '—' : formatCurrency(credit.availableLimit)}
          />
          <HeroMetric label="Gasto no saldo" value={formatCurrency(summary.totalSpent)} />
          <HeroMetric
            hint={describeCycleStatements(credit.statements)}
            label="Gasto no crédito (fatura do ciclo)"
            value={formatCurrency(credit.cycleStatementsAmount)}
          />
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
        <MetricRow label="Dias restantes" value={String(summary.remainingDays)} />
        <MetricRow label="Meta de economia (guardada)" value={formatCurrency(config.savingGoal)} />
      </Card>

      <FixedExpensesCard
        expenses={config.fixedExpenses}
        installmentsByPurchaseId={installmentsByPurchaseId}
        issues={selectRecurringIssues(doc, activeMonth.id)}
        onPay={setPayingExpense}
        onUndo={handleUndoPayment}
        payments={cyclePayments}
      />

      {adjustments ? (
        <CyclePlanCard
          adjustments={adjustments}
          initialAvailableAmount={activeMonth.initialAvailableAmount}
          monthlyIncome={config.monthlyIncome}
          previousMonthDebt={activeMonth.previousMonthDebt}
          savingGoal={config.savingGoal}
        />
      ) : null}

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
          cardLimits={cardLimits}
          cards={activeCards}
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
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text style={styles.eyebrow}>{cycleLabel ?? 'Manager Money'}</Text>
      <Text style={styles.title}>Limite diário</Text>
    </View>
  );
}

function HeroMetric({
  label,
  value,
  negative = false,
  hint,
}: {
  label: string;
  value: string;
  negative?: boolean;
  hint?: string;
}) {
  const styles = useStyles();

  return (
    <View style={styles.heroMetric}>
      <Text style={styles.heroMetricLabel}>{label}</Text>
      <Text style={[styles.heroMetricValue, negative ? styles.heroMetricNegative : null]}>
        {value}
      </Text>
      {hint ? <Text style={styles.heroMetricHint}>{hint}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  heroMetric: {
    flexBasis: '45%',
    flexGrow: 1,
    gap: spacing.xs,
  },
  heroMetricHint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  heroMetricNegative: {
    color: colors.negative,
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
}));

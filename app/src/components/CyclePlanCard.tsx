import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { CycleAdjustments } from '@manager-money/core/domain/financial/financial.calculations';
import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { Card } from './Card';
import { MetricRow } from './MetricRow';

type CyclePlanCardProps = {
  /** Renda das fontes ativas (BR-FIN-018). */
  monthlyIncome: MoneyCents;
  savingGoal: MoneyCents;
  previousMonthDebt: MoneyCents;
  initialAvailableAmount: MoneyCents;
  adjustments: Required<CycleAdjustments>;
};

/**
 * Como o saldo do ciclo foi montado (BR-FIN-004/005): renda − fixas reservadas (pagas à vista +
 * pendentes) − meta − faturas do ciclo − juros/multas de faturas − fatura pendente do ciclo
 * anterior (BR-FIN-034) − dívida herdada. Nasce recolhido.
 */
export function CyclePlanCard({
  monthlyIncome,
  savingGoal,
  previousMonthDebt,
  initialAvailableAmount,
  adjustments,
}: CyclePlanCardProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [isExpanded, setIsExpanded] = useState(false);
  const reservedFixed = adjustments.paidFixedExpenses + adjustments.pendingFixedExpenses;

  return (
    <Card>
      <Pressable
        accessibilityLabel="Mostrar ou ocultar o plano do ciclo"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((value) => !value)}
        style={styles.header}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>Plano do ciclo</Text>
          <Text style={styles.summary}>Saldo inicial {formatCurrency(initialAvailableAmount)}</Text>
        </View>
        <Ionicons
          color={colors.muted}
          name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={22}
        />
      </Pressable>
      {isExpanded ? (
        <>
          <MetricRow label="Renda mensal (fontes ativas)" value={formatCurrency(monthlyIncome)} />
          {adjustments.extraIncome > 0 ? (
            <MetricRow label="+ Rendas avulsas" value={formatCurrency(adjustments.extraIncome)} />
          ) : null}
          <MetricRow label="− Despesas fixas reservadas" value={formatCurrency(reservedFixed)} />
          <MetricRow
            indent
            label="Pagas à vista"
            value={formatCurrency(adjustments.paidFixedExpenses)}
          />
          <MetricRow
            indent
            label="Pendentes (reservadas)"
            value={formatCurrency(adjustments.pendingFixedExpenses)}
          />
          <MetricRow label="− Meta de economia" value={formatCurrency(savingGoal)} />
          <MetricRow
            label="− Faturas de cartão do ciclo"
            value={formatCurrency(adjustments.cardCharges)}
          />
          {adjustments.statementInterest > 0 ? (
            <MetricRow
              label="− Juros/multas de faturas"
              tone="negative"
              value={formatCurrency(adjustments.statementInterest)}
            />
          ) : null}
          {adjustments.carriedStatementDebt > 0 ? (
            <MetricRow
              label="− Fatura pendente do ciclo anterior"
              tone="negative"
              value={formatCurrency(adjustments.carriedStatementDebt)}
            />
          ) : null}
          {previousMonthDebt > 0 ? (
            <MetricRow
              label="− Dívida herdada"
              tone="negative"
              value={formatCurrency(previousMonthDebt)}
            />
          ) : null}
          <MetricRow
            label="= Saldo inicial do ciclo"
            tone={initialAvailableAmount < 0 ? 'negative' : 'default'}
            value={formatCurrency(initialAvailableAmount)}
          />
          <Text style={styles.hint}>
            Fixas pagas no crédito saem da reserva e entram pela fatura do cartão.
          </Text>
        </>
      ) : null}
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  summary: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
}));

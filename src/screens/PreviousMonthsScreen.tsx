import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { MainTabParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { colors, typography } from '../design/theme';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency, formatSignedCurrency } from '../utils/currency';
import { formatCycleLabel } from '../utils/date';

type Props = BottomTabScreenProps<MainTabParamList, 'PreviousMonths'>;

export function PreviousMonthsScreen({ navigation }: Props) {
  const months = useFinancialStore((state) => state.months);
  const closedMonths = useMemo(
    () =>
      [...months]
        .filter((month) => month.status === 'closed')
        .sort((left, right) => right.endDate.localeCompare(left.endDate)),
    [months],
  );

  if (closedMonths.length === 0) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Ir para hoje"
          iconName="archive-outline"
          message="Ciclos fechados ficam salvos aqui."
          onActionPress={() => navigation.navigate('Dashboard')}
          title="Sem ciclos anteriores"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Ciclos anteriores</Text>
      {closedMonths.map((month) => {
        const finalBalance = month.finalBalance ?? 0;

        return (
          <Card key={month.id}>
            <Text style={styles.monthTitle}>{formatCycleLabel(month.startDate, month.endDate)}</Text>
            <MetricRow
              label="Resultado"
              tone={finalBalance < 0 ? 'negative' : finalBalance > 0 ? 'positive' : 'default'}
              value={formatSignedCurrency(finalBalance)}
            />
            <MetricRow label="Saldo inicial" value={formatCurrency(month.initialAvailableAmount)} />
            <MetricRow label="Gastos registrados" value={String(month.expenses.length)} />
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  monthTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
});

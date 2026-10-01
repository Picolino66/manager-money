import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import {
  calculateDayBalance,
  calculateTodaySpent,
  normalizeCategory,
} from '../domain/financial/financial.calculations';
import { Expense } from '../domain/financial/financial.types';
import { colors, spacing, typography } from '../design/theme';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import { formatDateLabel } from '../utils/date';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'DailyHistory'>,
  NativeStackScreenProps<RootStackParamList>
>;

type DayGroup = {
  date: string;
  expenses: Expense[];
};

export function DailyHistoryScreen({ navigation }: Props) {
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const groups = useMemo<DayGroup[]>(() => {
    if (!activeMonth) {
      return [];
    }

    const grouped = activeMonth.expenses.reduce<Record<string, Expense[]>>((accumulator, expense) => {
      accumulator[expense.date] = [...(accumulator[expense.date] ?? []), expense];
      return accumulator;
    }, {});

    return Object.entries(grouped)
      .map(([date, expenses]) => ({ date, expenses }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [activeMonth]);

  function toggleDay(date: string) {
    setExpandedDays((current) => ({
      ...current,
      [date]: !current[date],
    }));
  }

  if (!activeMonth) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Iniciar ciclo"
          iconName="calendar-outline"
          message="O historico diario aparece depois que um ciclo mensal e iniciado."
          onActionPress={() => navigation.navigate('StartMonth')}
          title="Sem ciclo ativo"
        />
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        <Text style={styles.title}>Historico diario</Text>
        <EmptyState
          actionLabel="Registrar gasto"
          iconName="receipt-outline"
          message="Nenhum gasto registrado neste ciclo."
          onActionPress={() => navigation.navigate('AddExpense')}
          title="Historico vazio"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Historico diario</Text>
      {groups.map((group) => {
        const date = parseISO(group.date);
        const total = calculateTodaySpent(group.expenses, date);
        const balance = calculateDayBalance(activeMonth, date);
        const isExpanded = expandedDays[group.date] ?? false;

        return (
          <Card key={group.date}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Alternar detalhes de ${formatDateLabel(group.date)}`}
              onPress={() => toggleDay(group.date)}
              style={styles.groupHeaderButton}
            >
              <View style={styles.groupHeader}>
                <Text style={styles.groupTitle}>{formatDateLabel(group.date)}</Text>
                <View style={styles.groupHeaderMeta}>
                  <Text style={styles.groupTotal}>{formatCurrency(total)}</Text>
                  <Ionicons
                    color={colors.muted}
                    name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={20}
                  />
                </View>
              </View>
              <Text style={styles.groupSubtitle}>
                {isExpanded ? 'Toque para recolher' : 'Toque para expandir'}
              </Text>
            </Pressable>

            {isExpanded ? (
              <>
                {group.expenses.map((expense) => (
                  <Pressable
                    key={expense.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar gasto ${expense.description}`}
                    onPress={() => navigation.navigate('AddExpense', { expenseId: expense.id })}
                    style={styles.expenseRow}
                  >
                    <View style={styles.expenseTextContainer}>
                      <Text style={styles.expenseDescription}>{expense.description}</Text>
                      <Text style={styles.expenseCategory}>
                        {normalizeCategory(expense.category)}
                      </Text>
                    </View>
                    <View style={styles.expenseActions}>
                      <Text style={styles.expenseAmount}>{formatCurrency(expense.amount)}</Text>
                      <Ionicons color={colors.primary} name="pencil-outline" size={18} />
                      <Text style={styles.expenseEditLabel}>Editar</Text>
                    </View>
                  </Pressable>
                ))}
                <View style={styles.divider} />
                <MetricRow
                  label="Saldo do dia"
                  tone={balance < 0 ? 'negative' : 'positive'}
                  value={formatCurrency(balance)}
                />
              </>
            ) : null}
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
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  groupHeaderButton: {
    gap: spacing.xs,
  },
  groupHeaderMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  groupTotal: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  groupSubtitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  expenseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  expenseTextContainer: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.md,
  },
  expenseDescription: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  expenseCategory: {
    color: colors.muted,
    fontSize: 12,
  },
  expenseActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  expenseAmount: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  expenseEditLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
});

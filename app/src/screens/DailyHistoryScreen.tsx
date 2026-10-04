import { useMemo, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { parseISO } from 'date-fns';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { HistoryFilterModal } from '../components/HistoryFilterModal';
import { Screen } from '../components/Screen';
import {
  EMPTY_PAID_HISTORY_FILTER,
  filterPaidHistory,
  PAID_HISTORY_LABELS,
  PAID_HISTORY_MEANS_LABELS,
  PaidHistoryFilter,
  PaidHistoryItem,
  PaidHistoryType,
  selectPaidHistory,
  sumPaidHistory,
} from '@manager-money/core/application/paid-history';
import { calculateDayBalance } from '@manager-money/core/domain/financial/financial.calculations';
import { spacing, typography } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatDateLabel } from '@manager-money/core/utils/date';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'DailyHistory'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** Remover: gasto e compra são excluídos; fixa, parcelado e lançamento de fatura são desfeitos. */
const REMOVAL: Record<
  PaidHistoryType,
  { noun: string; action: string; title: string; effect: string }
> = {
  expense: {
    noun: 'gasto',
    action: 'Excluir',
    title: 'Excluir gasto?',
    effect: 'sairá do ciclo ativo.',
  },
  card: {
    noun: 'compra',
    action: 'Excluir',
    title: 'Excluir compra?',
    effect: '(todas as parcelas) será removida das faturas e o limite volta a ficar livre.',
  },
  fixed: {
    noun: 'pagamento',
    action: 'Desfazer',
    title: 'Desfazer pagamento?',
    effect: 'volta a ficar pendente no ciclo. Se foi no crédito, a compra no cartão também sai.',
  },
  installment: {
    noun: 'pagamento',
    action: 'Desfazer',
    title: 'Desfazer pagamento?',
    effect: 'volta a ficar pendente no ciclo. Se foi no crédito, a compra no cartão também sai.',
  },
  statement: {
    noun: 'lançamento',
    action: 'Desfazer',
    title: 'Desfazer lançamento da fatura?',
    effect: 'será desfeito: o limite volta a ficar comprometido e os encargos saem do orçamento.',
  },
};

type DayGroup = {
  date: string;
  items: PaidHistoryItem[];
};

export function DailyHistoryScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const doc = useFinancialStore((state) => state.doc);
  const deleteExpense = useFinancialStore((state) => state.deleteExpense);
  const deleteCardPurchase = useFinancialStore((state) => state.deleteCardPurchase);
  const undoFixedPayment = useFinancialStore((state) => state.undoFixedPayment);
  const undoStatementPayment = useFinancialStore((state) => state.undoStatementPayment);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<PaidHistoryFilter>(EMPTY_PAID_HISTORY_FILTER);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Tudo que foi pago no ciclo ativo: gasto à vista, cartão, fixas, parcelados e fatura.
  const cycleItems = useMemo(
    () =>
      activeMonth ? selectPaidHistory(doc).filter((item) => item.cycleId === activeMonth.id) : [],
    [activeMonth, doc],
  );
  const categories = useMemo(
    () => [...new Set(cycleItems.map((item) => item.category))].sort((a, b) => a.localeCompare(b)),
    [cycleItems],
  );
  const hasFilter = JSON.stringify({ ...filter, cycleId: null }) !== JSON.stringify(EMPTY_PAID_HISTORY_FILTER);

  const groups = useMemo<DayGroup[]>(() => {
    const grouped = filterPaidHistory(cycleItems, filter).reduce<Record<string, PaidHistoryItem[]>>(
      (accumulator, item) => {
        accumulator[item.date] = [...(accumulator[item.date] ?? []), item];
        return accumulator;
      },
      {},
    );

    return Object.entries(grouped)
      .map(([date, items]) => ({ date, items }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [cycleItems, filter]);

  const header = (
    <View style={styles.headerRow}>
      <Text style={styles.title}>Histórico diário</Text>
      <Pressable
        accessibilityLabel={hasFilter ? 'Filtros (ativos)' : 'Filtros'}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setIsFilterOpen(true)}
      >
        <Ionicons
          color={hasFilter ? colors.primary : colors.muted}
          name={hasFilter ? 'funnel' : 'funnel-outline'}
          size={24}
        />
      </Pressable>
    </View>
  );
  const filterModal = isFilterOpen ? (
    <HistoryFilterModal
      categories={categories}
      filter={filter}
      onApply={(next) => {
        setFilter(next);
        setIsFilterOpen(false);
      }}
      onClose={() => setIsFilterOpen(false)}
    />
  ) : null;

  function editItem(item: PaidHistoryItem) {
    if (item.type === 'expense') {
      navigation.navigate('AddExpense', { expenseId: item.id });
      return;
    }

    // Compra no cartão: a edição fica no detalhe do cartão.
    const purchase = doc.cardPurchases.find((record) => record.id === item.id);

    if (purchase) {
      navigation.navigate('CardDetail', { cardId: purchase.cardId });
    }
  }

  function removeItem(item: PaidHistoryItem) {
    const removal = REMOVAL[item.type];
    const run = () => {
      switch (item.type) {
        case 'expense':
          return deleteExpense(item.sourceId);
        case 'card':
          return deleteCardPurchase(item.sourceId);
        case 'statement':
          return undoStatementPayment(item.sourceId);
        default:
          return undoFixedPayment(item.sourceId);
      }
    };

    Alert.alert(removal.title, `${item.name} de ${formatCurrency(item.amount)} ${removal.effect}`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: removal.action,
        style: 'destructive',
        onPress: () => {
          run().catch((error: unknown) =>
            Alert.alert(
              `Não foi possível ${removal.action.toLowerCase()}`,
              error instanceof Error ? error.message : 'Tente novamente.',
            ),
          );
        },
      },
    ]);
  }

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
          message="O histórico diário aparece depois que um ciclo mensal é iniciado."
          onActionPress={() => navigation.navigate('StartMonth')}
          title="Sem ciclo ativo"
        />
      </Screen>
    );
  }

  if (groups.length === 0 && hasFilter) {
    return (
      <Screen>
        {header}
        <EmptyState
          actionLabel="Limpar filtros"
          iconName="funnel-outline"
          message="Nenhum item corresponde aos filtros."
          onActionPress={() => setFilter(EMPTY_PAID_HISTORY_FILTER)}
          title="Nada encontrado"
        />
        {filterModal}
      </Screen>
    );
  }

  if (groups.length === 0) {
    return (
      <Screen>
        <Text style={styles.title}>Histórico diário</Text>
        <EmptyState
          actionLabel="Registrar gasto"
          iconName="receipt-outline"
          message="Nada foi pago neste ciclo ainda."
          onActionPress={() => navigation.navigate('AddExpense')}
          title="Histórico vazio"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {groups.map((group) => {
        const date = parseISO(group.date);
        const total = sumPaidHistory(group.items);
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
                {group.items.map((item) => (
                  <View key={item.id} style={styles.expenseRow}>
                    <View style={styles.expenseTextContainer}>
                      <Text style={styles.expenseDescription}>{item.name}</Text>
                      <Text style={styles.expenseCategory}>
                        {PAID_HISTORY_MEANS_LABELS[item.means]} · {PAID_HISTORY_LABELS[item.type]} ·{' '}
                        {item.category}
                      </Text>
                    </View>
                    <View style={styles.expenseActions}>
                      <Text style={styles.expenseAmount}>{formatCurrency(item.amount)}</Text>
                      {item.editable ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Editar ${REMOVAL[item.type].noun} ${item.name}`}
                          hitSlop={8}
                          onPress={() => editItem(item)}
                        >
                          <Ionicons color={colors.primary} name="pencil-outline" size={20} />
                        </Pressable>
                      ) : null}
                      {item.deletable ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${REMOVAL[item.type].action} ${REMOVAL[item.type].noun} ${item.name}`}
                          hitSlop={8}
                          onPress={() => removeItem(item)}
                        >
                          <Ionicons color={colors.critical} name="trash-outline" size={20} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
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
      {filterModal}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
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
  divider: {
    backgroundColor: colors.border,
    height: 1,
  },
}));

import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { isAfter, isBefore, parseISO, startOfDay } from 'date-fns';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { MetricRow } from '../components/MetricRow';
import { Screen } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { TextInputField } from '../components/TextInputField';
import {
  calculateFixedExpenseAmount,
  getSortedCategories,
  normalizeCategory,
} from '../domain/financial/financial.calculations';
import { DEFAULT_EXPENSE_CATEGORY } from '../domain/financial/financial.types';
import { colors, radius, spacing, typography } from '../design/theme';
import { MainTabParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { formatCurrency } from '../utils/currency';
import { formatDateInput, parseBRDateInput, toISODate } from '../utils/date';

type Props = BottomTabScreenProps<MainTabParamList, 'Categories'>;

const ALL_CATEGORIES = 'Todas';

type CategoryTotal = {
  category: string;
  total: number;
};

type CategorizedItemType = 'expense' | 'fixed' | 'installment';

type CategorizedItem = {
  id: string;
  type: CategorizedItemType;
  name: string;
  category: string;
  amount: number;
  date?: string;
};

const itemTypeLabels: Record<CategorizedItemType, string> = {
  expense: 'Gasto',
  fixed: 'Fixo',
  installment: 'Parcelamento',
};

const itemTypeFilterOptions: { label: string; type: CategorizedItemType }[] = [
  { label: 'Gasto', type: 'expense' },
  { label: 'Parcelado', type: 'installment' },
  { label: 'Fixo', type: 'fixed' },
];

function parseFilterDate(date: string) {
  const parsedDate = parseBRDateInput(date);

  return parsedDate ? startOfDay(parsedDate) : null;
}

export function CategoriesScreen({ navigation }: Props) {
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const months = useFinancialStore((state) => state.months);
  const addCategory = useFinancialStore((state) => state.addCategory);
  const categories = getSortedCategories(config);
  const categoryOptions = useMemo(
    () => [ALL_CATEGORIES, ...categories].map((category) => ({ label: category, value: category })),
    [categories],
  );
  const [startDate, setStartDate] = useState(
    formatDateInput(activeMonth?.startDate ?? toISODate(new Date())),
  );
  const [endDate, setEndDate] = useState(
    formatDateInput(activeMonth?.endDate ?? toISODate(new Date())),
  );
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [visibleItemTypes, setVisibleItemTypes] = useState<Record<CategorizedItemType, boolean>>({
    expense: true,
    installment: false,
    fixed: false,
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  const allItems = useMemo<CategorizedItem[]>(
    () => {
      const expenseItems = [
        ...(activeMonth?.expenses ?? []),
        ...months.flatMap((month) => month.expenses),
      ].map((expense) => ({
        id: expense.id,
        type: 'expense' as const,
        name: expense.description,
        category: normalizeCategory(expense.category),
        amount: expense.amount,
        date: expense.date,
      }));

      const plannedItems =
        config?.fixedExpenses.reduce<CategorizedItem[]>((items, expense) => {
          const amount = calculateFixedExpenseAmount(expense);

          if (amount <= 0) {
            return items;
          }

          items.push({
            id: expense.id,
            type: expense.type === 'installment' ? 'installment' : 'fixed',
            name: expense.name,
            category: normalizeCategory(expense.category),
            amount,
          });

          return items;
        }, []) ?? [];

      return [...expenseItems, ...plannedItems];
    },
    [activeMonth, config, months],
  );

  const filteredItems = useMemo(() => {
    const start = parseFilterDate(startDate);
    const end = parseFilterDate(endDate);

    if (!start || !end || isAfter(start, end)) {
      return [];
    }

    const hasActiveCycleInRange =
      activeMonth !== null &&
      !isAfter(startOfDay(parseISO(activeMonth.startDate)), end) &&
      !isBefore(startOfDay(parseISO(activeMonth.endDate)), start);

    return allItems.filter((item) => {
      const matchesType = visibleItemTypes[item.type];
      const isWithinRange = item.date
        ? !isBefore(startOfDay(parseISO(item.date)), start) &&
          !isAfter(startOfDay(parseISO(item.date)), end)
        : hasActiveCycleInRange;
      const matchesCategory =
        selectedCategory === ALL_CATEGORIES ||
        normalizeCategory(item.category) === selectedCategory;

      return matchesType && isWithinRange && matchesCategory;
    });
  }, [activeMonth, allItems, endDate, selectedCategory, startDate, visibleItemTypes]);

  const categoryTotals = useMemo<CategoryTotal[]>(() => {
    const totals = filteredItems.reduce<Record<string, number>>((result, item) => {
      result[item.category] = (result[item.category] ?? 0) + item.amount;

      return result;
    }, {});

    return Object.entries(totals)
      .map(([category, total]) => ({ category, total }))
      .sort((left, right) => right.total - left.total);
  }, [filteredItems]);

  const totalSpent = useMemo(
    () => filteredItems.reduce((total, item) => total + item.amount, 0),
    [filteredItems],
  );
  const maxCategoryTotal = categoryTotals[0]?.total ?? 0;

  async function handleCreateCategory() {
    const normalizedCategory = normalizeCategory(newCategoryName);

    if (normalizedCategory === DEFAULT_EXPENSE_CATEGORY) {
      Alert.alert('Categoria inválida', 'Informe um nome diferente de Outros.');
      return;
    }

    if (categories.includes(normalizedCategory)) {
      Alert.alert('Categoria existente', 'Essa categoria já está cadastrada.');
      return;
    }

    await addCategory(normalizedCategory);
    setNewCategoryName('');
    setSelectedCategory(normalizedCategory);
  }

  function toggleItemType(type: CategorizedItemType) {
    setVisibleItemTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  }

  if (!config) {
    return (
      <Screen>
        <EmptyState
          actionLabel="Configurar"
          iconName="settings-outline"
          message="Configure a base financeira antes de analisar categorias."
          onActionPress={() => navigation.navigate('Dashboard')}
          title="Configuração pendente"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Categorias</Text>
        <Text style={styles.subtitle}>Gastos por período e categoria</Text>
      </View>

      <Card>
        <Text style={styles.sectionTitle}>Criar categoria</Text>
        <TextInputField
          autoCapitalize="sentences"
          label="Nome"
          onChangeText={setNewCategoryName}
          placeholder="Ex: Viagem"
          value={newCategoryName}
        />
        <AppButton
          iconName="add-outline"
          onPress={() => void handleCreateCategory()}
          title="Criar categoria"
          variant="secondary"
        />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Filtros</Text>
        <View style={styles.dateGrid}>
          <TextInputField
            label="Início"
            onChangeText={setStartDate}
            placeholder="07/04/2026"
            value={startDate}
          />
          <TextInputField
            label="Fim"
            onChangeText={setEndDate}
            placeholder="06/05/2026"
            value={endDate}
          />
        </View>
        <SelectField
          label="Categoria"
          onChange={setSelectedCategory}
          options={categoryOptions}
          value={selectedCategory}
        />
        <View style={styles.typeFilters}>
          {itemTypeFilterOptions.map((option) => {
            const isSelected = visibleItemTypes[option.type];

            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                key={option.type}
                onPress={() => toggleItemType(option.type)}
                style={styles.typeFilterButton}
              >
                <Ionicons
                  color={isSelected ? colors.primary : colors.muted}
                  name={isSelected ? 'checkbox-outline' : 'square-outline'}
                  size={22}
                />
                <Text style={styles.typeFilterText}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Resumo</Text>
        <MetricRow label="Total gasto" value={formatCurrency(totalSpent)} />
        <MetricRow label="Itens" value={String(filteredItems.length)} />
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Gráfico</Text>
        {categoryTotals.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum item encontrado para os filtros.</Text>
        ) : null}
        {categoryTotals.map((item) => {
          const percentage = maxCategoryTotal > 0 ? item.total / maxCategoryTotal : 0;

          return (
            <View key={item.category} style={styles.chartRow}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartLabel}>{item.category}</Text>
                <Text style={styles.chartValue}>{formatCurrency(item.total)}</Text>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { flex: percentage }]} />
                <View style={{ flex: 1 - percentage }} />
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <Text style={styles.sectionTitle}>Itens</Text>
        {filteredItems.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum item no período.</Text>
        ) : null}
        {filteredItems
          .slice()
          .sort((left, right) => (right.date ?? '').localeCompare(left.date ?? ''))
          .map((item) => (
            <MetricRow
              key={`${item.type}-${item.id}`}
              label={`${itemTypeLabels[item.type]}: ${item.name} - ${normalizeCategory(item.category)}`}
              value={formatCurrency(item.amount)}
            />
          ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs,
  },
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  dateGrid: {
    gap: spacing.md,
  },
  typeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  typeFilterButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  typeFilterText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chartRow: {
    gap: spacing.sm,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  chartLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  chartValue: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  barTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: colors.primary,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
});

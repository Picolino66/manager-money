import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { startOfDay } from 'date-fns';

import { Card } from '../../components/Card';
import { MetricRow } from '../../components/MetricRow';
import { SelectField } from '../../components/SelectField';
import { TextInputField } from '../../components/TextInputField';
import {
  getSortedCategories,
  normalizeCategory,
} from '@manager-money/core/domain/financial/financial.calculations';
import {
  CATEGORIZED_ITEM_LABELS,
  CategorizedItemType,
  filterCategorizedItems,
  filterCategorizedItemsByType,
  selectCategorizedItems,
  selectCycleCategorizedItems,
  sumCategorizedItems,
  summarizeByCategory,
} from '@manager-money/core/application/category-analysis';
import { isLive } from '@manager-money/core/application/state';
import { radius, spacing, typography } from '../../design/theme';
import { makeStyles, useTheme } from '../../design/useTheme';
import { useFinancialStore } from '../../store/financial.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import {
  formatCycleLabel,
  formatDateInput,
  maskDateInput,
  parseBRDateInput,
  toISODate,
} from '@manager-money/core/utils/date';

const ALL_CATEGORIES = 'Todas';
const FREE_PERIOD = 'periodo';

const itemTypeLabels = CATEGORIZED_ITEM_LABELS;

const itemTypeFilterOptions: { label: string; type: CategorizedItemType }[] = [
  { label: 'Gasto', type: 'expense' },
  { label: 'Cartão', type: 'card' },
  { label: 'Parcelado', type: 'installment' },
  { label: 'Fixo', type: 'fixed' },
];

function parseFilterDate(date: string) {
  const parsedDate = parseBRDateInput(date);

  return parsedDate ? startOfDay(parsedDate) : null;
}

/**
 * Aba Categorias dos Relatórios (RF-09, BR-FIN-039). Base "Ciclo": o que pesou no ciclo do salário
 * (gastos, fixas à vista e as parcelas das faturas que vencem nele). "Período livre": pela data, com
 * a compra no cartão pelo valor total.
 */
export function CategoriesReport() {
  const { colors } = useTheme();
  const styles = useStyles();
  const config = useFinancialStore((state) => state.config);
  const activeMonth = useFinancialStore((state) => state.activeMonth);
  const doc = useFinancialStore((state) => state.doc);
  const cycles = useMemo(
    () =>
      doc.cycles
        .filter(isLive)
        .sort((left, right) => right.startDate.localeCompare(left.startDate)),
    [doc],
  );
  const [base, setBase] = useState(activeMonth?.id ?? cycles[0]?.id ?? FREE_PERIOD);
  const baseOptions = [
    ...cycles.map((cycle) => ({
      label: `Ciclo ${formatCycleLabel(cycle.startDate, cycle.endDate)}${cycle.status === 'active' ? ' (atual)' : ''}`,
      value: cycle.id,
    })),
    { label: 'Período livre', value: FREE_PERIOD },
  ];
  const byCycle = base !== FREE_PERIOD;
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
    card: true,
    installment: false,
    fixed: false,
  });
  const filteredItems = useMemo(() => {
    const category = selectedCategory === ALL_CATEGORIES ? null : selectedCategory;

    return byCycle
      ? filterCategorizedItemsByType(selectCycleCategorizedItems(doc, base), {
          category,
          types: visibleItemTypes,
        })
      : filterCategorizedItems(selectCategorizedItems(doc), {
          start: parseFilterDate(startDate),
          end: parseFilterDate(endDate),
          category,
          types: visibleItemTypes,
        });
  }, [base, byCycle, doc, endDate, selectedCategory, startDate, visibleItemTypes]);

  const categoryTotals = useMemo(() => summarizeByCategory(filteredItems), [filteredItems]);

  const totalSpent = useMemo(() => sumCategorizedItems(filteredItems), [filteredItems]);
  const maxCategoryTotal = categoryTotals[0]?.total ?? 0;

  function toggleItemType(type: CategorizedItemType) {
    setVisibleItemTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  }

  return (
    <>
      <Text style={styles.subtitle}>
        {byCycle
          ? 'O que pesou no ciclo: gastos, fixas à vista e as parcelas das faturas que vencem nele.'
          : 'Pela data: compra no cartão pelo valor total, na data da compra; fixas, quando pagas.'}
      </Text>

      <Card>
        <Text style={styles.sectionTitle}>Filtros</Text>
        <SelectField label="Base" onChange={setBase} options={baseOptions} value={base} />
        {byCycle ? null : (
          <View style={styles.dateGrid}>
            <TextInputField
              keyboardType="number-pad"
              label="Início"
              maxLength={10}
              onChangeText={(text) => setStartDate(maskDateInput(text))}
              placeholder="DD/MM/AAAA"
              value={startDate}
            />
            <TextInputField
              keyboardType="number-pad"
              label="Fim"
              maxLength={10}
              onChangeText={(text) => setEndDate(maskDateInput(text))}
              placeholder="DD/MM/AAAA"
              value={endDate}
            />
          </View>
        )}
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
                accessibilityLabel={`Mostrar itens do tipo ${option.label}`}
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
          .sort((left, right) => right.date.localeCompare(left.date))
          .map((item) => (
            <MetricRow
              key={`${item.type}-${item.id}`}
              label={`${itemTypeLabels[item.type]}: ${item.name} - ${normalizeCategory(item.category)}`}
              value={formatCurrency(item.amount)}
            />
          ))}
      </Card>
    </>
  );
}

const useStyles = makeStyles((colors) => ({
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
}));

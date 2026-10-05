import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { MetricRow } from '../../components/MetricRow';
import { SelectField } from '../../components/SelectField';
import {
  CycleSpending,
  selectCycleSpending,
  selectCycleSpendingRange,
} from '@manager-money/core/application/selectors';
import { cycleKeyFromStartDate } from '@manager-money/core/domain/financial/credit-card';
import { spacing, typography } from '../../design/theme';
import { makeStyles } from '../../design/useTheme';
import { useFinancialStore } from '../../store/financial.store';
import { formatCurrency, formatSignedCurrency } from '@manager-money/core/utils/currency';
import {
  formatCycleLabel,
  formatMonthLabel,
  formatShortDate,
} from '@manager-money/core/utils/date';

const PHASE_BADGE: Record<
  CycleSpending['phase'],
  { label: string; tone: 'info' | 'neutral' | 'positive' | 'warning' } | null
> = {
  active: { label: 'Ciclo atual', tone: 'info' },
  closed: { label: 'Fechado', tone: 'neutral' },
  future: { label: 'Previsto', tone: 'warning' },
  empty: null,
};

function monthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, '0'),
    label: formatMonthLabel(2000, index + 1).split('/')[0]!,
  }));
}

function CycleSpendingCard({ spending }: { spending: CycleSpending }) {
  const styles = useStyles();
  const badge = PHASE_BADGE[spending.phase];
  const planned = spending.phase === 'future';

  if (spending.isEmpty) {
    return (
      <EmptyState
        iconName="file-tray-outline"
        message="Não há gastos nem faturas neste ciclo."
        title="Sem dados neste ciclo"
      />
    );
  }

  return (
    <Card>
      <View style={styles.headerRow}>
        <Text style={styles.monthTitle}>
          {spending.startDate && spending.endDate
            ? formatCycleLabel(spending.startDate, spending.endDate)
            : formatMonthLabel(
                Number(spending.cycleKey.slice(0, 4)),
                Number(spending.cycleKey.slice(5, 7)),
              )}
        </Text>
        {badge ? <Badge label={badge.label} tone={badge.tone} /> : null}
      </View>
      <MetricRow
        label={planned ? 'Total previsto' : 'Total do ciclo'}
        value={formatCurrency(spending.total)}
      />

      {spending.expenses.length > 0 ? (
        <View style={styles.section}>
          <MetricRow label="Gastos do dia a dia" value={formatCurrency(spending.expensesTotal)} />
          {spending.expenses.map((expense) => (
            <MetricRow
              indent
              key={expense.id}
              label={`${formatShortDate(expense.date)} · ${expense.description || expense.category}`}
              value={formatCurrency(expense.amount)}
            />
          ))}
        </View>
      ) : null}

      {spending.fixedPaid.length > 0 ? (
        <View style={styles.section}>
          <MetricRow label="Fixas pagas à vista" value={formatCurrency(spending.fixedPaidTotal)} />
          {spending.fixedPaid.map((payment) => (
            <MetricRow
              indent
              key={payment.id}
              label={payment.name}
              value={formatCurrency(payment.amount)}
            />
          ))}
        </View>
      ) : null}

      {spending.fixedPlanned.length > 0 ? (
        <View style={styles.section}>
          <MetricRow
            label={planned ? 'Fixas previstas' : 'Fixas pendentes'}
            value={formatCurrency(spending.fixedPlannedTotal)}
          />
          {spending.fixedPlanned.map((item) => (
            <MetricRow indent key={item.id} label={item.name} value={formatCurrency(item.amount)} />
          ))}
        </View>
      ) : null}

      {spending.statements.map((statement) => (
        <View key={`${statement.cardId}:${statement.statementKey}`} style={styles.section}>
          <MetricRow
            label={`Fatura ${statement.cardName} · vence ${formatShortDate(statement.dueDate)}`}
            value={formatCurrency(statement.total)}
          />
          {statement.items.map((item) => (
            <MetricRow
              indent
              key={item.id}
              label={
                item.installmentLabel
                  ? `${item.description} (${item.installmentLabel})`
                  : item.description
              }
              value={formatCurrency(item.amount)}
            />
          ))}
        </View>
      ))}

      {spending.statementCharges > 0 ? (
        <View style={styles.section}>
          <MetricRow
            label="Juros e multas de faturas"
            value={formatCurrency(spending.statementCharges)}
          />
        </View>
      ) : null}
    </Card>
  );
}

/**
 * Aba Ciclos dos Relatórios (ADR-024): o que pesou em cada ciclo do salário — gastos, fixas e as
 * faturas que vencem nele (BR-FIN-025/039) — e o resultado dos ciclos fechados.
 */
export function CyclesReport() {
  const styles = useStyles();
  const months = useFinancialStore((state) => state.months);
  const doc = useFinancialStore((state) => state.doc);
  const now = new Date();
  const range = selectCycleSpendingRange(doc, now);
  const [selectedKey, setSelectedKey] = useState(range.current);
  const [selectedYear, selectedMonth] = selectedKey.split('-') as [string, string];
  const years = Array.from(
    { length: Number(range.max.slice(0, 4)) - Number(range.min.slice(0, 4)) + 1 },
    (_, index) => String(Number(range.min.slice(0, 4)) + index),
  );
  const spending = selectCycleSpending(doc, selectedKey, now);
  const closedMonths = useMemo(
    () =>
      [...months]
        .filter((month) => month.status === 'closed')
        .sort((left, right) => right.endDate.localeCompare(left.endDate)),
    [months],
  );

  function handleChange(year: string, month: string) {
    const key = `${year}-${month}`;

    setSelectedKey(key < range.min ? range.min : key > range.max ? range.max : key);
  }

  return (
    <>
      <View style={styles.filters}>
        <View style={styles.filter}>
          <SelectField
            label="Mês"
            onChange={(month) => handleChange(selectedYear, month)}
            options={monthOptions()}
            value={selectedMonth}
          />
        </View>
        <View style={styles.filter}>
          <SelectField
            label="Ano"
            onChange={(year) => handleChange(year, selectedMonth)}
            options={years.map((year) => ({ value: year, label: year }))}
            value={selectedYear}
          />
        </View>
      </View>

      <CycleSpendingCard spending={spending} />

      {closedMonths.length === 0 ? (
        <Text style={styles.hint}>Ciclos fechados ficam salvos aqui.</Text>
      ) : (
        <>
          <Text style={styles.subtitle}>Ciclos anteriores</Text>
          {closedMonths.map((month) => {
            const finalBalance = month.finalBalance ?? 0;

            return (
              <Card key={month.id}>
                <Text style={styles.monthTitle}>
                  {formatCycleLabel(month.startDate, month.endDate)}
                </Text>
                <MetricRow
                  label="Resultado"
                  tone={finalBalance < 0 ? 'negative' : finalBalance > 0 ? 'positive' : 'default'}
                  value={formatSignedCurrency(finalBalance)}
                />
                <MetricRow
                  label="Saldo inicial"
                  value={formatCurrency(month.initialAvailableAmount)}
                />
                <MetricRow
                  label="Faturas do ciclo"
                  value={formatCurrency(
                    selectCycleSpending(doc, cycleKeyFromStartDate(month.startDate), now).cardTotal,
                  )}
                />
                <MetricRow label="Gastos registrados" value={String(month.expenses.length)} />
              </Card>
            );
          })}
        </>
      )}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
  subtitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  filter: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  section: {
    gap: spacing.xs,
  },
  monthTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
}));

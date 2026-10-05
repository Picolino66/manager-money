import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { Badge, BadgeTone } from '../../components/Badge';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { MetricRow } from '../../components/MetricRow';
import { SelectField } from '../../components/SelectField';
import { formatMonthKey, STATEMENT_STATUS_LABEL } from '@manager-money/core/application/card-text';
import {
  selectCreditReport,
  selectCreditReportYears,
} from '@manager-money/core/application/credit-report';
import { selectCreditCards } from '@manager-money/core/application/selectors';
import { isLive } from '@manager-money/core/application/state';
import { StatementStatus } from '@manager-money/core/domain/financial/credit-card';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatCycleLabel, formatShortDate } from '@manager-money/core/utils/date';
import { radius, spacing, typography } from '../../design/theme';
import { makeStyles } from '../../design/useTheme';
import { useFinancialStore } from '../../store/financial.store';

const ALL = '';

const STATUS_TONE: Record<StatementStatus, BadgeTone> = {
  open: 'info',
  closed: 'warning',
  overdue: 'critical',
  partial: 'warning',
  paid: 'positive',
};

/**
 * Aba Crédito dos Relatórios (BR-FIN-039): as faturas pelo ciclo do cartão — abertura, fechamento,
 * vencimento e o ciclo do salário em que cada uma pesa —, com o total por mês de fechamento.
 */
export function CreditReport() {
  const styles = useStyles();
  const doc = useFinancialStore((state) => state.doc);
  const [now] = useState(() => new Date());
  const [cardId, setCardId] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const cards = useMemo(() => selectCreditCards(doc), [doc]);
  const years = useMemo(() => selectCreditReportYears(doc, now), [doc, now]);
  const report = useMemo(
    () => selectCreditReport(doc, now, { cardId: cardId || null, year: year || null }),
    [doc, now, cardId, year],
  );
  const cycles = doc.cycles.filter(isLive);
  const lastEnd = cycles.reduce((max, cycle) => (cycle.endDate > max ? cycle.endDate : max), '');
  const maxMonth = Math.max(0, ...report.months.map((month) => month.amount + month.charges));

  function cycleLabel(cycleId: string | null, dueDate: string) {
    const cycle = cycles.find((item) => item.id === cycleId);

    if (cycle) return formatCycleLabel(cycle.startDate, cycle.endDate);

    return dueDate > lastEnd ? 'Ciclo a abrir' : '—';
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        iconName="card-outline"
        message="Cadastre um cartão na aba Cartões para acompanhar as faturas aqui."
        title="Nenhum cartão"
      />
    );
  }

  return (
    <>
      <Text style={styles.subtitle}>
        Cada fatura vai da abertura ao fechamento do cartão e pesa no ciclo do salário em que vence.
      </Text>
      <View style={styles.filters}>
        <View style={styles.filter}>
          <SelectField
            label="Cartão"
            onChange={setCardId}
            options={[
              { label: 'Todos', value: ALL },
              ...cards.map((card) => ({ label: card.name, value: card.id })),
            ]}
            value={cardId}
          />
        </View>
        <View style={styles.filter}>
          <SelectField
            label="Ano"
            onChange={setYear}
            options={[
              { label: 'Todos', value: ALL },
              ...years.map((item) => ({ label: item, value: item })),
            ]}
            value={year}
          />
        </View>
      </View>

      {report.statements.length === 0 ? (
        <EmptyState
          iconName="file-tray-outline"
          message="Nenhuma fatura com parcelas para os filtros."
          title="Nenhuma fatura"
        />
      ) : (
        <>
          <Card>
            <Text style={styles.sectionTitle}>Resumo</Text>
            <MetricRow label="Total das faturas" value={formatCurrency(report.totals.amount)} />
            <MetricRow label="Juros e multas" value={formatCurrency(report.totals.charges)} />
            <MetricRow label="Pago" value={formatCurrency(report.totals.paid)} />
            <MetricRow label="Em aberto" value={formatCurrency(report.totals.remaining)} />
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Por mês de fechamento</Text>
            {report.months.map((month) => {
              const total = month.amount + month.charges;
              const share = maxMonth > 0 ? total / maxMonth : 0;

              return (
                <View key={month.key} style={styles.chartRow}>
                  <View style={styles.chartHeader}>
                    <Text style={styles.chartLabel}>{formatMonthKey(month.key)}</Text>
                    <Text style={styles.chartValue}>{formatCurrency(total)}</Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { flex: share }]} />
                    <View style={{ flex: 1 - share }} />
                  </View>
                </View>
              );
            })}
          </Card>

          {report.statements.map((statement) => (
            <Card key={`${statement.cardId}:${statement.key}`}>
              <View style={styles.headerRow}>
                <Text style={styles.statementTitle}>
                  Fatura {formatMonthKey(statement.key)} · {statement.cardName}
                </Text>
                <Badge
                  label={STATEMENT_STATUS_LABEL[statement.status]}
                  tone={STATUS_TONE[statement.status]}
                />
              </View>
              <Text style={styles.hint}>
                {formatShortDate(statement.openDate)} a {formatShortDate(statement.closingDate)} ·
                vence {formatShortDate(statement.dueDate)}
              </Text>
              <MetricRow
                label="Pesa no ciclo"
                value={cycleLabel(statement.cycleId, statement.dueDate)}
              />
              <MetricRow
                label="Valor"
                value={formatCurrency(statement.amount + statement.charges)}
              />
              <MetricRow label="Pago" value={formatCurrency(statement.paid)} />
            </Card>
          ))}
        </>
      )}
    </>
  );
}

const useStyles = makeStyles((colors) => ({
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
  statementTitle: {
    color: colors.ink,
    flex: 1,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
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
}));

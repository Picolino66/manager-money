import { StyleSheet, Text, View } from 'react-native';

import { UpcomingCommitment } from '../application/selectors';
import { colors, radius, spacing, typography } from '../design/theme';
import { formatCurrency } from '../utils/currency';
import { formatShortDate } from '../utils/date';
import { Card } from './Card';

type UpcomingCommitmentsCardProps = {
  commitments: UpcomingCommitment[];
  /** Ids (`cartão:fatura`) das faturas com pagamento parcial: o valor é o restante (BR-FIN-033). */
  partialStatementIds?: ReadonlySet<string>;
};

function describeCommitment(item: UpcomingCommitment, partial: boolean): string {
  if (item.kind === 'statement') {
    return `${item.label}${partial ? ' (restante)' : ''} · ${item.overdue ? 'venceu' : 'vence'} ${formatShortDate(item.dueDate)}`;
  }

  return `${item.label} · fixa pendente`;
}

/** SPEC-018: o que ainda vai sair neste ciclo (faturas e fixas pendentes). */
export function UpcomingCommitmentsCard({
  commitments,
  partialStatementIds,
}: UpcomingCommitmentsCardProps) {
  return (
    <Card>
      <Text style={styles.title}>Próximos compromissos</Text>
      {commitments.length === 0 ? (
        <Text style={styles.empty}>Nenhuma fatura ou despesa fixa pendente neste ciclo.</Text>
      ) : (
        <>
          {commitments.map((item) => {
            const overdue = item.kind === 'statement' && item.overdue;
            const description = describeCommitment(
              item,
              item.kind === 'statement' && (partialStatementIds?.has(item.id) ?? false),
            );

            return (
              <View
                accessibilityLabel={`${description}, ${formatCurrency(item.amount)}${
                  overdue ? ', vencida' : ''
                }`}
                key={`${item.kind}-${item.id}`}
                style={[styles.row, overdue && styles.rowOverdue]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.label}>{description}</Text>
                  {overdue ? <Text style={styles.overdue}>Vencida</Text> : null}
                </View>
                <Text style={[styles.amount, overdue && styles.amountOverdue]}>
                  {formatCurrency(item.amount)}
                </Text>
              </View>
            );
          })}
          <Text style={styles.hint}>
            Fixas pendentes já estão reservadas no saldo; cada fatura pesa no ciclo em que vence.
          </Text>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  empty: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowOverdue: {
    backgroundColor: colors.criticalSoft,
    borderColor: colors.critical,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  overdue: {
    color: colors.critical,
    fontSize: 12,
    fontWeight: '900',
  },
  amount: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '900',
  },
  amountOverdue: {
    color: colors.critical,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});

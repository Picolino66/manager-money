import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, spacing, typography } from '../design/theme';
import { CycleProjection } from '../domain/financial/projection';
import { formatCurrency } from '../utils/currency';
import { formatMonthLabel } from '../utils/date';
import { Card } from './Card';
import { MetricRow } from './MetricRow';

type ProjectionCardProps = {
  projections: CycleProjection[];
};

function cycleLabel(cycleKey: string): string {
  const [year, month] = cycleKey.split('-').map(Number);

  return `Ciclo de ${formatMonthLabel(year ?? 0, month ?? 1)}`;
}

/**
 * SPEC-018 / BR-FIN-031: "Quanto do meu dinheiro futuro já está comprometido?". Mostra o livre de
 * cada próximo ciclo; ao tocar, abre renda, meta, fixas e cartões.
 */
export function ProjectionCard({ projections }: ProjectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (projections.length === 0) {
    return null;
  }

  return (
    <Card>
      <Pressable
        accessibilityLabel="Mostrar ou ocultar detalhes dos próximos ciclos"
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={() => setIsExpanded((value) => !value)}
        style={styles.header}
      >
        <View style={styles.headerText}>
          <Text style={styles.title}>Próximos ciclos</Text>
          <Text style={styles.subtitle}>Quanto do seu dinheiro futuro já está comprometido</Text>
        </View>
        <Ionicons
          color={colors.muted}
          name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={22}
        />
      </Pressable>
      {projections.map((projection) => (
        <View key={projection.cycleKey} style={styles.cycle}>
          <Text style={styles.cycleLabel}>{cycleLabel(projection.cycleKey)}</Text>
          {isExpanded ? (
            <>
              <MetricRow indent label="Renda prevista" value={formatCurrency(projection.income)} />
              <MetricRow
                indent
                label="− Meta de economia"
                value={formatCurrency(projection.savingGoal)}
              />
              <MetricRow
                indent
                label="− Despesas fixas"
                value={formatCurrency(projection.fixedExpenses)}
              />
              <MetricRow
                indent
                label="− Faturas de cartão"
                value={formatCurrency(projection.cardCharges)}
              />
            </>
          ) : null}
          <MetricRow
            label={`${isExpanded ? '= ' : ''}Livre antes de novos gastos`}
            tone={projection.free < 0 ? 'negative' : 'default'}
            value={formatCurrency(projection.free)}
          />
        </View>
      ))}
      <Text style={styles.hint}>
        Considera só o que já é conhecido: fontes ativas, meta, fixas ativas e parcelas do cartão.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
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
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  cycle: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  cycleLabel: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});

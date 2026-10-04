import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../design/theme';
import { DayStatus } from '../domain/financial/financial.types';

const statusContent: Record<DayStatus, { label: string; backgroundColor: string; color: string }> = {
  healthy: {
    label: 'Saudável',
    backgroundColor: colors.healthySoft,
    color: colors.healthy,
  },
  warning: {
    label: 'Atenção',
    backgroundColor: colors.warningSoft,
    color: colors.warning,
  },
  critical: {
    label: 'Crítico',
    backgroundColor: colors.criticalSoft,
    color: colors.critical,
  },
  negative: {
    label: 'Negativo',
    backgroundColor: colors.negativeSoft,
    color: colors.negative,
  },
};

type StatusBadgeProps = {
  status: DayStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const content = statusContent[status];

  return (
    <View style={[styles.badge, { backgroundColor: content.backgroundColor }]}>
      <Text style={[styles.label, { color: content.color }]}>{content.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
  },
});

import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../design/theme';

export type BadgeTone = 'neutral' | 'info' | 'warning' | 'critical' | 'positive';

const toneColors: Record<BadgeTone, { backgroundColor: string; color: string }> = {
  neutral: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  info: { backgroundColor: colors.infoSoft, color: colors.info },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  critical: { backgroundColor: colors.criticalSoft, color: colors.critical },
  positive: { backgroundColor: colors.healthySoft, color: colors.healthy },
};

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

/** Selo curto de estado (ex.: "Inativo", "Vencida"). */
export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const palette = toneColors[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.label, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
});

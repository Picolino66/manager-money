import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../design/theme';
import { MoneyCents } from '../domain/financial/financial.types';

type CardLimitBarProps = {
  committed: MoneyCents;
  creditLimit: MoneyCents | null;
};

/** BR-FIN-026: barra de uso do limite do cartão (comprometido / limite total). */
export function CardLimitBar({ committed, creditLimit }: CardLimitBarProps) {
  if (creditLimit === null || creditLimit <= 0) {
    return null;
  }

  const percent = Math.round((committed / creditLimit) * 100);
  const filled = Math.min(100, Math.max(0, percent));
  const isOver = committed > creditLimit;
  const barColor =
    isOver || percent >= 90 ? colors.critical : percent >= 70 ? colors.warning : colors.primary;

  return (
    <View style={styles.wrapper}>
      <View
        accessibilityLabel="Uso do limite do cartão"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: filled }}
        style={styles.track}
      >
        <View style={[styles.fill, { backgroundColor: barColor, width: `${filled}%` }]} />
      </View>
      <Text style={[styles.caption, isOver && styles.captionOver]}>
        {isOver ? 'Acima do limite do cartão' : `${percent}% do limite comprometido`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 8,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: radius.sm,
    height: '100%',
  },
  caption: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  captionOver: {
    color: colors.critical,
  },
});

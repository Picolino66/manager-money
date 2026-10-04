import { Text, View } from 'react-native';

import { spacing } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';

type MetricRowProps = {
  label: string;
  value: string;
  tone?: 'default' | 'positive' | 'negative';
  indent?: boolean;
};

export function MetricRow({ label, value, tone = 'default', indent = false }: MetricRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const valueColor =
    tone === 'positive' ? colors.healthy : tone === 'negative' ? colors.negative : colors.ink;

  return (
    <View style={[styles.row, indent && styles.indented]}>
      <Text style={[styles.label, indent && styles.indentedLabel]}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  indented: {
    paddingLeft: spacing.md,
  },
  label: {
    color: colors.muted,
    flex: 1,
    fontSize: 14,
  },
  indentedLabel: {
    fontSize: 13,
  },
  value: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
}));

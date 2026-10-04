import { PropsWithChildren } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';

import { radius, spacing } from '../design/theme';
import { makeStyles } from '../design/useTheme';

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ children, style }: CardProps) {
  const styles = useStyles();
  return <View style={[styles.card, style]}>{children}</View>;
}

const useStyles = makeStyles((colors) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
}));

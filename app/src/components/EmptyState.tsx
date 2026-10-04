import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../design/theme';
import { AppButton } from './AppButton';
import { Card } from './Card';

type IconName = ComponentProps<typeof Ionicons>['name'];

type EmptyStateProps = {
  iconName: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export function EmptyState({
  iconName,
  title,
  message,
  actionLabel,
  onActionPress,
}: EmptyStateProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.iconCircle}>
        <Ionicons color={colors.primary} name={iconName} size={26} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onActionPress ? (
        <AppButton iconName="arrow-forward-outline" onPress={onActionPress} title={actionLabel} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  message: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});

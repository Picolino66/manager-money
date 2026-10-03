import { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '../design/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  iconName?: IconName;
  disabled?: boolean;
  isLoading?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
};

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  iconName,
  disabled = false,
  isLoading = false,
  accessibilityLabel,
  style,
}: AppButtonProps) {
  const isDisabled = disabled || isLoading;
  const variantStyle = buttonVariants[variant];
  const textStyle = textVariants[variant];

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={textStyle.color} />
      ) : (
        <View style={styles.content}>
          {iconName ? <Ionicons color={textStyle.color} name={iconName} size={18} /> : null}
          <Text style={[styles.text, textStyle]} numberOfLines={1}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.52,
  },
  pressed: {
    opacity: 0.82,
  },
});

const buttonVariants = StyleSheet.create({
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: colors.negative,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const textVariants = StyleSheet.create({
  primary: {
    color: '#ffffff',
  },
  secondary: {
    color: colors.ink,
  },
  danger: {
    color: '#ffffff',
  },
  ghost: {
    color: colors.primary,
  },
});

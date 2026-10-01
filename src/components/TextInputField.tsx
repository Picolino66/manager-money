import { Text, TextInput, TextInputProps, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../design/theme';

type TextInputFieldProps = {
  label: string;
  error?: string;
} & TextInputProps;

export function TextInputField({ label, error, style, ...props }: TextInputFieldProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.disabled}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    minHeight: 52,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
  },
  inputError: {
    borderColor: colors.critical,
  },
  error: {
    color: colors.critical,
    fontSize: 13,
  },
});

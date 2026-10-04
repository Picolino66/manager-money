import { Text, TextInput, TextInputProps, View } from 'react-native';

import { radius, spacing } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';

type TextInputFieldProps = {
  label: string;
  error?: string;
} & TextInputProps;

export function TextInputField({ label, error, style, ...props }: TextInputFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityHint={error}
        accessibilityLabel={label}
        placeholderTextColor={colors.disabled}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
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
}));

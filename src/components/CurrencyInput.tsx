import { Text, TextInput, TextInputProps, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '../design/theme';
import { MoneyCents } from '../domain/financial/financial.types';
import { formatCurrencyInput, parseCurrencyInputToCents } from '../utils/currency';

type CurrencyInputProps = {
  label: string;
  value: MoneyCents;
  onChangeValue: (value: MoneyCents) => void;
  error?: string;
  placeholder?: string;
} & Pick<TextInputProps, 'onBlur'>;

export function CurrencyInput({
  label,
  value,
  onChangeValue,
  error,
  placeholder = 'R$ 0,00',
  onBlur,
}: CurrencyInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType="numeric"
        onBlur={onBlur}
        onChangeText={(text) => onChangeValue(parseCurrencyInputToCents(text))}
        placeholder={placeholder}
        placeholderTextColor={colors.disabled}
        style={[styles.input, error ? styles.inputError : null]}
        value={formatCurrencyInput(value)}
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
    fontSize: 18,
    fontWeight: '700',
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

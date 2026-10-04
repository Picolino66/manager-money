import { Pressable, Text, View } from 'react-native';

import { radius, spacing, ThemePreference } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { useThemeStore } from '../store/theme.store';

const options: { label: string; value: ThemePreference }[] = [
  { label: 'Sistema', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Escuro', value: 'dark' },
];

/** Escolha do tema do aparelho (ADR-021); não é sincronizada. */
export function ThemePreferenceSelector() {
  const styles = useStyles();
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);

  return (
    <View accessibilityLabel="Tema" accessibilityRole="radiogroup" style={styles.group}>
      {options.map((option) => {
        const selected = option.value === preference;

        return (
          <Pressable
            accessibilityLabel={`Tema ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => void setPreference(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  group: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  option: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  optionSelected: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  labelSelected: {
    color: colors.ink,
  },
}));

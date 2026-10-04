export type ColorScheme = 'light' | 'dark';

/** Preferência do usuário: seguir o sistema ou fixar um tema (ADR-021). */
export type ThemePreference = 'system' | ColorScheme;

export const lightColors = {
  background: '#f7f8fa',
  surface: '#ffffff',
  surfaceMuted: '#eef2f3',
  ink: '#111827',
  text: '#24303f',
  muted: '#697586',
  border: '#dbe1e7',
  primary: '#1f7a5a',
  primaryDark: '#15543f',
  primarySoft: '#dff3ea',
  onPrimary: '#ffffff',
  healthy: '#18864f',
  healthySoft: '#daf5e7',
  warning: '#a86500',
  warningSoft: '#fff1c7',
  critical: '#c0392b',
  criticalSoft: '#fde0dc',
  negative: '#7f1d1d',
  negativeSoft: '#f7c9c9',
  onNegative: '#ffffff',
  info: '#2f5d8c',
  infoSoft: '#dbeafe',
  disabled: '#aab4c0',
  overlay: 'rgba(17, 24, 39, 0.5)',
  overlaySoft: 'rgba(17, 24, 39, 0.38)',
};

export type ThemeColors = { [Key in keyof typeof lightColors]: string };

/** Mesmas chaves do tema claro; pares texto/fundo com contraste ≥ 4,5 (WCAG AA). */
export const darkColors: ThemeColors = {
  background: '#0f1419',
  surface: '#171e26',
  surfaceMuted: '#212a34',
  ink: '#f2f5f8',
  text: '#d5dce4',
  muted: '#97a3b2',
  border: '#2e3843',
  primary: '#4cc398',
  primaryDark: '#8fe0be',
  primarySoft: '#173b2f',
  onPrimary: '#06281c',
  healthy: '#5ccf94',
  healthySoft: '#15372a',
  warning: '#f2b84f',
  warningSoft: '#3b2d0f',
  critical: '#f4887b',
  criticalSoft: '#45211d',
  negative: '#ffb0b0',
  negativeSoft: '#561d1f',
  onNegative: '#3a0b0b',
  info: '#8fbdea',
  infoSoft: '#1a3049',
  disabled: '#5d6977',
  overlay: 'rgba(0, 0, 0, 0.6)',
  overlaySoft: 'rgba(0, 0, 0, 0.45)',
};

export const themeColors: Record<ColorScheme, ThemeColors> = {
  light: lightColors,
  dark: darkColors,
};

/** Resolve o tema efetivo; sem informação do sistema, usa o claro. */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 8,
} as const;

export const typography = {
  title: 28,
  sectionTitle: 20,
  body: 16,
  small: 13,
  metric: 40,
} as const;

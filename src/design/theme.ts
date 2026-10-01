export const colors = {
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
  healthy: '#18864f',
  healthySoft: '#daf5e7',
  warning: '#a86500',
  warningSoft: '#fff1c7',
  critical: '#c0392b',
  criticalSoft: '#fde0dc',
  negative: '#7f1d1d',
  negativeSoft: '#f7c9c9',
  info: '#2f5d8c',
  infoSoft: '#dbeafe',
  disabled: '#aab4c0',
} as const;

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

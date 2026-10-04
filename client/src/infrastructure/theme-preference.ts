/** Preferência de tema do navegador (ADR-021). Único uso de localStorage do client além da sessão. */
export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCE_KEY = 'manager-money:theme-preference';

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_PREFERENCE_KEY);
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') localStorage.removeItem(THEME_PREFERENCE_KEY);
    else localStorage.setItem(THEME_PREFERENCE_KEY, preference);
  } catch {
    // Navegador sem armazenamento: a escolha vale só nesta aba.
  }
}

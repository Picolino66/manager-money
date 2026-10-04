import { darkColors, isThemePreference, lightColors, resolveColorScheme } from './theme';

describe('tema claro/escuro (ADR-021)', () => {
  it('as duas paletas têm exatamente as mesmas chaves', () => {
    expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
  });

  it('"Sistema" segue o esquema do aparelho e cai no claro sem informação', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(resolveColorScheme('system', null)).toBe('light');
    expect(resolveColorScheme('system', undefined)).toBe('light');
  });

  it('preferência fixa ignora o sistema', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });

  it('valida a preferência', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('sepia')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});

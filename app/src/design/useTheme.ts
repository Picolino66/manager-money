import { StyleSheet, useColorScheme } from 'react-native';

import { useThemeStore } from '../store/theme.store';
import { ColorScheme, resolveColorScheme, ThemeColors, themeColors } from './theme';

export type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
};

/** Tema efetivo: preferência do aparelho (Sistema/Claro/Escuro) + esquema do sistema. */
export function useTheme(): Theme {
  const preference = useThemeStore((state) => state.preference);
  const scheme = resolveColorScheme(preference, useColorScheme());

  return { scheme, colors: themeColors[scheme] };
}

/**
 * Cria um hook de estilos dependente do tema. Os estilos são gerados uma vez por paleta
 * (no máximo duas) e reaproveitados entre renders e instâncias.
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T>>(
  factory: (colors: ThemeColors) => T,
): () => T {
  const cache = new Map<ThemeColors, T>();

  return function useStyles() {
    const { colors } = useTheme();
    let styles = cache.get(colors);

    if (!styles) {
      styles = StyleSheet.create(factory(colors));
      cache.set(colors, styles);
    }

    return styles;
  };
}

import { create } from 'zustand';

import {
  readThemePreference,
  ThemePreference,
  writeThemePreference,
} from '../infrastructure/theme-preference';

export type ColorScheme = 'light' | 'dark';

type ThemeState = {
  preference: ThemePreference;
  scheme: ColorScheme;
  setPreference: (preference: ThemePreference) => void;
  /** Liga o tema ao sistema e ao <html data-theme>. Devolve a função de limpeza. */
  init: () => () => void;
};

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemScheme(): ColorScheme {
  return typeof window !== 'undefined' && window.matchMedia?.(DARK_QUERY).matches
    ? 'dark'
    : 'light';
}

export function resolveScheme(preference: ThemePreference, system: ColorScheme): ColorScheme {
  return preference === 'system' ? system : preference;
}

function apply(scheme: ColorScheme) {
  document.documentElement.dataset.theme = scheme;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'system',
  scheme: 'light',

  setPreference(preference) {
    writeThemePreference(preference);
    const scheme = resolveScheme(preference, systemScheme());
    apply(scheme);
    set({ preference, scheme });
  },

  init() {
    const preference = readThemePreference();
    const scheme = resolveScheme(preference, systemScheme());
    apply(scheme);
    set({ preference, scheme });

    const media = window.matchMedia?.(DARK_QUERY);
    if (!media) return () => undefined;

    const onChange = () => {
      if (get().preference !== 'system') return;
      const next = systemScheme();
      apply(next);
      set({ scheme: next });
    };
    media.addEventListener('change', onChange);

    return () => media.removeEventListener('change', onChange);
  },
}));

import { create } from 'zustand';

import { ThemePreference } from '../design/theme';
import { logger } from '../infrastructure/monitoring/logger';
import { themePreferenceStorage } from '../infrastructure/storage/theme-preference';

type ThemeState = {
  preference: ThemePreference;
  loadPreference: () => Promise<void>;
  /** Aplica na hora; falha ao gravar não desfaz a escolha (vale até reabrir o app). */
  setPreference: (preference: ThemePreference) => Promise<void>;
};

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',

  async loadPreference() {
    set({ preference: await themePreferenceStorage.load() });
  },

  async setPreference(preference) {
    set({ preference });
    try {
      await themePreferenceStorage.save(preference);
    } catch (error) {
      logger.error(error);
    }
  },
}));

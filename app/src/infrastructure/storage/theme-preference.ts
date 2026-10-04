import AsyncStorage from '@react-native-async-storage/async-storage';

import { isThemePreference, ThemePreference } from '../../design/theme';
import { logger } from '../monitoring/logger';

/**
 * Preferência de tema do aparelho (ADR-021). Fica fora do documento sincronizado: não é dado
 * financeiro, não vai para a nuvem e não exige migração do documento local.
 */
export const THEME_PREFERENCE_KEY = '@manager-money/theme-preference';

export const themePreferenceStorage = {
  async load(): Promise<ThemePreference> {
    try {
      const raw = await AsyncStorage.getItem(THEME_PREFERENCE_KEY);
      return isThemePreference(raw) ? raw : 'system';
    } catch (error) {
      logger.error(error);
      return 'system';
    }
  },

  async save(preference: ThemePreference): Promise<void> {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, preference);
  },
};

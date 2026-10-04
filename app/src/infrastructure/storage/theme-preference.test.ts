import AsyncStorage from '@react-native-async-storage/async-storage';

import { STATE_STORAGE_KEY } from './local-store';
import { THEME_PREFERENCE_KEY, themePreferenceStorage } from './theme-preference';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('themePreferenceStorage (ADR-021)', () => {
  it('sem valor salvo usa "system"', async () => {
    await expect(themePreferenceStorage.load()).resolves.toBe('system');
  });

  it('salva e lê a preferência em chave própria, fora do documento sincronizado', async () => {
    await themePreferenceStorage.save('dark');
    await expect(themePreferenceStorage.load()).resolves.toBe('dark');
    expect(await AsyncStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
    expect(THEME_PREFERENCE_KEY).not.toBe(STATE_STORAGE_KEY);
    expect(await AsyncStorage.getItem(STATE_STORAGE_KEY)).toBeNull();
  });

  it('valor inválido volta para "system"', async () => {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, 'sepia');
    await expect(themePreferenceStorage.load()).resolves.toBe('system');
  });

  it('falha de leitura não quebra o app', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('io'));
    await expect(themePreferenceStorage.load()).resolves.toBe('system');
  });
});

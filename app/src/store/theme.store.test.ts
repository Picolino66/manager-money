import AsyncStorage from '@react-native-async-storage/async-storage';

import { THEME_PREFERENCE_KEY } from '../infrastructure/storage/theme-preference';
import { useThemeStore } from './theme.store';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  useThemeStore.setState({ preference: 'system' });
});

describe('useThemeStore (ADR-021)', () => {
  it('carrega a preferência salva no aparelho', async () => {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, 'light');
    await useThemeStore.getState().loadPreference();
    expect(useThemeStore.getState().preference).toBe('light');
  });

  it('aplica e persiste a escolha', async () => {
    await useThemeStore.getState().setPreference('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(await AsyncStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
  });

  it('falha ao gravar mantém a escolha aplicada', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('io'));
    await useThemeStore.getState().setPreference('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
  });
});

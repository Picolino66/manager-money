import AsyncStorage from '@react-native-async-storage/async-storage';

import { encryptedSessionStorage } from './session-storage';

const mockSecure = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockSecure.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockSecure.delete(key)),
}));
jest.mock('expo-crypto', () => ({
  getRandomBytes: (size: number) => Uint8Array.from({ length: size }, (_, index) => (index * 37 + 11) % 256),
}));

describe('encryptedSessionStorage (ADR-006)', () => {
  beforeEach(async () => {
    mockSecure.clear();
    await AsyncStorage.clear();
  });

  it('ida e volta, sem texto puro no AsyncStorage', async () => {
    const session = JSON.stringify({ access_token: 'token-super-secreto', refresh_token: 'r' });
    await encryptedSessionStorage.setItem('sb-session', session);
    const stored = await AsyncStorage.getItem('sb-session');
    expect(stored).not.toContain('token-super-secreto');
    expect(mockSecure.get('sb-session')).toHaveLength(64);
    expect(await encryptedSessionStorage.getItem('sb-session')).toBe(session);
  });

  it('sem chave ou sem valor retorna null; remove apaga os dois', async () => {
    expect(await encryptedSessionStorage.getItem('nada')).toBeNull();
    await encryptedSessionStorage.setItem('k', 'v');
    await encryptedSessionStorage.removeItem('k');
    expect(await AsyncStorage.getItem('k')).toBeNull();
    expect(mockSecure.has('k')).toBe(false);
  });
});

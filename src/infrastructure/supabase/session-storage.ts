import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

/**
 * Armazenamento da sessão Supabase (ADR-006): o valor fica cifrado com AES-256-CTR no
 * AsyncStorage e a chave aleatória fica no SecureStore (Keychain/Keystore). Necessário porque
 * a sessão excede o limite de ~2 KB por item do SecureStore.
 */
export const encryptedSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const [encrypted, keyHex] = await Promise.all([
      AsyncStorage.getItem(key),
      SecureStore.getItemAsync(key),
    ]);

    if (!encrypted || !keyHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
    return aesjs.utils.utf8.fromBytes(cipher.decrypt(aesjs.utils.hex.toBytes(encrypted)));
  },

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = getRandomBytes(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encrypted = cipher.encrypt(aesjs.utils.utf8.toBytes(value));

    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    await AsyncStorage.setItem(key, aesjs.utils.hex.fromBytes(encrypted));
  },

  async removeItem(key: string): Promise<void> {
    await Promise.all([AsyncStorage.removeItem(key), SecureStore.deleteItemAsync(key)]);
  },
};

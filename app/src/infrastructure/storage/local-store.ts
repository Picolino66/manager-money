import AsyncStorage from '@react-native-async-storage/async-storage';

import { createEmptyState, LocalState } from '@manager-money/core/application/state';
import { logger } from '../monitoring/logger';
import { LEGACY_STORAGE_KEYS, LegacySnapshot, migrateDocument, migrateV1ToV2 } from './migrations';
import { parseLocalState } from './schema';

export const STATE_STORAGE_KEY = '@manager-money/state';

export type LoadResult =
  | { status: 'ok'; state: LocalState; migrated: boolean }
  | { status: 'corrupted'; raw: string; error: string };

async function readLegacySnapshot(): Promise<LegacySnapshot | null> {
  const entries = await AsyncStorage.multiGet(Object.values(LEGACY_STORAGE_KEYS));
  const raw = Object.fromEntries(entries) as Record<string, string | null>;
  const parse = (key: string) => (raw[key] ? JSON.parse(raw[key] as string) : null);
  const snapshot: LegacySnapshot = {
    config: parse(LEGACY_STORAGE_KEYS.config),
    months: parse(LEGACY_STORAGE_KEYS.months),
    activeMonth: parse(LEGACY_STORAGE_KEYS.activeMonth),
  };

  return snapshot.config || snapshot.months || snapshot.activeMonth ? snapshot : null;
}

/**
 * Persistência local em documento único (ADR-003). Cada `save` é um único `setItem`,
 * portanto atômico: nunca existe estado parcial após um crash (DEF-002).
 */
export const localStore = {
  async load(now: Date = new Date()): Promise<LoadResult> {
    const raw = await AsyncStorage.getItem(STATE_STORAGE_KEY);

    if (raw) {
      try {
        const document = JSON.parse(raw);

        const migratedDocument = migrateDocument(document, now);

        if (migratedDocument) {
          const state = parseLocalState(migratedDocument);
          await localStore.save(state);
          logger.event('storage.migrate', { ok: true, count: state.expenses.length });
          return { status: 'ok', state, migrated: true };
        }

        return { status: 'ok', state: parseLocalState(document), migrated: false };
      } catch (error) {
        // DEF-004: documento inválido nunca é sobrescrito automaticamente.
        logger.event('storage.load', { ok: false, code: 'invalid-document' });
        return { status: 'corrupted', raw, error: error instanceof Error ? error.message : String(error) };
      }
    }

    let legacy: LegacySnapshot | null;

    try {
      legacy = await readLegacySnapshot();
    } catch (error) {
      logger.event('storage.load', { ok: false, code: 'invalid-legacy' });
      const legacyRaw = JSON.stringify(
        Object.fromEntries(await AsyncStorage.multiGet(Object.values(LEGACY_STORAGE_KEYS))),
      );
      return { status: 'corrupted', raw: legacyRaw, error: error instanceof Error ? error.message : String(error) };
    }

    if (!legacy) {
      return { status: 'ok', state: createEmptyState(), migrated: false };
    }

    const state = parseLocalState(migrateV1ToV2(legacy, now));
    await localStore.save(state);
    // As chaves v1 só saem depois da gravação v2 bem-sucedida (SPEC-004).
    await AsyncStorage.multiRemove(Object.values(LEGACY_STORAGE_KEYS));
    logger.event('storage.migrate', { ok: true, count: state.expenses.length });

    return { status: 'ok', state, migrated: true };
  },

  async save(state: LocalState): Promise<void> {
    await AsyncStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
  },

  /** Conteúdo bruto para exportação de recuperação (tela de erro). */
  async readRaw(): Promise<string | null> {
    return AsyncStorage.getItem(STATE_STORAGE_KEY);
  },
};

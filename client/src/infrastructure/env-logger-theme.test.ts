import { readPublicEnv } from './env';
import { logger, setLogSink } from './monitoring/logger';
import {
  readThemePreference,
  THEME_PREFERENCE_KEY,
  writeThemePreference,
} from './theme-preference';

describe('readPublicEnv', () => {
  it('exige URL e anon key', () => {
    expect(
      readPublicEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' }),
    ).toEqual({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'k' });
    expect(readPublicEnv({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull();
    expect(readPublicEnv({})).toBeNull();
  });
});

describe('logger', () => {
  it('descarta campos fora da lista permitida (sem e-mail, token ou valores)', () => {
    const sink = vi.fn();
    setLogSink(sink);
    logger.event('web.save', { ok: true, count: 2, email: 'a@b.c', amount: 1000, token: 't' });
    logger.error(new TypeError('dado sensível'), { table: 'expenses', description: 'Mercado' });
    logger.error('texto');

    expect(sink).toHaveBeenNthCalledWith(1, 'event', 'web.save', { ok: true, count: 2 });
    expect(sink).toHaveBeenNthCalledWith(2, 'error', 'TypeError', { table: 'expenses' });
    expect(sink).toHaveBeenNthCalledWith(3, 'error', 'unknown', {});
  });
});

describe('preferência de tema', () => {
  beforeEach(() => localStorage.clear());

  it('lê e grava só valores válidos', () => {
    expect(readThemePreference()).toBe('system');
    writeThemePreference('light');
    expect(readThemePreference()).toBe('light');
    localStorage.setItem(THEME_PREFERENCE_KEY, 'roxo');
    expect(readThemePreference()).toBe('system');
  });

  it('navegador sem armazenamento não quebra', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readThemePreference()).toBe('system');
    expect(() => writeThemePreference('dark')).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});

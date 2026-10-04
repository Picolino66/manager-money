import { THEME_PREFERENCE_KEY } from '../infrastructure/theme-preference';
import { resolveScheme, useThemeStore } from './theme.store';

function mockSystem(dark: boolean) {
  const listeners: (() => void)[] = [];
  const media = {
    matches: dark,
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn(() => media) as unknown as typeof window.matchMedia;
  return {
    change(next: boolean) {
      media.matches = next;
      listeners.forEach((listener) => listener());
    },
    media,
  };
}

beforeEach(() => localStorage.clear());

describe('theme.store', () => {
  it('resolve o tema efetivo', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
  });

  it('padrão "Sistema" segue o navegador e reage à mudança', () => {
    const system = mockSystem(true);
    const stop = useThemeStore.getState().init();

    expect(useThemeStore.getState()).toMatchObject({ preference: 'system', scheme: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');
    system.change(false);
    expect(document.documentElement.dataset.theme).toBe('light');
    stop();
    expect(system.media.removeEventListener).toHaveBeenCalled();
  });

  it('escolha manual é salva no navegador e ignora o sistema', () => {
    const system = mockSystem(false);
    useThemeStore.getState().init();
    useThemeStore.getState().setPreference('dark');

    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe('dark');
    system.change(false);
    expect(document.documentElement.dataset.theme).toBe('dark');

    useThemeStore.getState().init();
    expect(useThemeStore.getState().preference).toBe('dark');
    useThemeStore.getState().setPreference('system');
    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBeNull();
  });
});

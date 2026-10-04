import { create } from 'zustand';

import { AuthFailure } from '../infrastructure/auth';
import { logger } from '../infrastructure/monitoring/logger';
import { authErrorMessage } from '../lib/messages';
import { useDataStore } from './data.store';
import { getDependencies } from './dependencies';

export type SessionStatus = 'loading' | 'unconfigured' | 'signed-out' | 'signed-in';

type SessionState = {
  status: SessionStatus;
  userId: string | null;
  /** Aviso mostrado no login (ex.: sessão expirada). */
  notice: string | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Sessão perdida (refresh falhou): volta ao login com aviso. */
  expire: () => Promise<void>;
  clearNotice: () => void;
};

export const EXPIRED_NOTICE = 'Sua sessão expirou. Entre de novo para continuar.';

let signingOut = false;

function toMessage(error: unknown): string {
  return authErrorMessage(error instanceof AuthFailure ? error.code : 'unknown');
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  userId: null,
  notice: null,

  init() {
    const deps = getDependencies();

    if (!deps) {
      set({ status: 'unconfigured' });
      return () => undefined;
    }

    const unsubscribe = deps.auth.onChange((change) => {
      if (change.event === 'signed-out') {
        const wasSignedIn = get().status === 'signed-in';
        useDataStore.getState().reset();
        set({
          status: 'signed-out',
          userId: null,
          // Saída que não foi pedida pelo usuário = sessão expirada/revogada.
          notice: wasSignedIn && !signingOut ? EXPIRED_NOTICE : get().notice,
        });
        if (wasSignedIn && !signingOut) logger.event('auth.expired', { ok: false });
        return;
      }

      if (change.user && change.user.userId !== get().userId) {
        useDataStore.getState().reset();
        set({ status: 'signed-in', userId: change.user.userId });
      }
    });

    deps.auth.currentUser().then(
      (user) =>
        set(
          user
            ? { status: 'signed-in', userId: user.userId }
            : { status: 'signed-out', userId: null },
        ),
      () => set({ status: 'signed-out', userId: null }),
    );

    return unsubscribe;
  },

  async signIn(email, password) {
    const deps = getDependencies();
    if (!deps) throw new Error(authErrorMessage('unknown'));

    try {
      const user = await deps.auth.signIn(email, password);
      useDataStore.getState().reset();
      set({ status: 'signed-in', userId: user.userId, notice: null });
    } catch (error) {
      throw new Error(toMessage(error));
    }
  },

  async signUp(email, password) {
    const deps = getDependencies();
    if (!deps) throw new Error(authErrorMessage('unknown'));

    try {
      const user = await deps.auth.signUp(email, password);
      useDataStore.getState().reset();
      set({ status: 'signed-in', userId: user.userId, notice: null });
    } catch (error) {
      throw new Error(toMessage(error));
    }
  },

  async signOut() {
    const deps = getDependencies();
    signingOut = true;

    try {
      await deps?.auth.signOut();
    } catch {
      // Mesmo sem rede, a sessão local é encerrada e o estado é descartado.
    } finally {
      signingOut = false;
      useDataStore.getState().reset();
      set({ status: 'signed-out', userId: null, notice: null });
    }
  },

  async expire() {
    const deps = getDependencies();
    signingOut = true;

    try {
      await deps?.auth.signOut();
    } catch {
      // Sessão já inválida no servidor.
    } finally {
      signingOut = false;
      logger.event('auth.expired', { ok: false });
      useDataStore.getState().reset();
      set({ status: 'signed-out', userId: null, notice: EXPIRED_NOTICE });
    }
  },

  clearNotice() {
    set({ notice: null });
  },
}));

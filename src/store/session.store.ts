import NetInfo from '@react-native-community/netinfo';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { logger } from '../infrastructure/monitoring/logger';
import { isSupabaseConfigured, supabase } from '../infrastructure/supabase/client';
import { SupabaseRemote } from '../infrastructure/sync/supabase-remote';
import {
  linkKeepingLocal,
  linkUsingRemote,
  planFirstLogin,
  unlinkAccount,
} from '../infrastructure/sync/sync-engine';
import { SyncRemote } from '../infrastructure/sync/types';
import { useFinancialStore } from './financial.store';

export type SessionStatus = 'disabled' | 'loading' | 'signed-out' | 'signed-in';

type SessionState = {
  status: SessionStatus;
  email: string | null;
  userId: string | null;
  /** Primeiro login com dados locais e na nuvem: aguardando escolha (BR-ACC-002). */
  awaitingFirstLoginChoice: boolean;
  init: () => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resolveFirstLogin: (choice: 'keep-local' | 'use-remote') => Promise<void>;
  signOut: (eraseLocalData: boolean) => Promise<void>;
  deleteAccount: () => Promise<void>;
};

let client: SupabaseClient | null = supabase;
let remoteFactory: (client: SupabaseClient) => SyncRemote = (c) => new SupabaseRemote(c);
let triggersInstalled = false;

/** Injeção para testes. */
export function configureSessionDependencies(deps: {
  client: SupabaseClient | null;
  remoteFactory?: (client: SupabaseClient) => SyncRemote;
}) {
  client = deps.client;
  if (deps.remoteFactory) remoteFactory = deps.remoteFactory;
}

function requireClient(): SupabaseClient {
  if (!client) throw new Error('Sincronização indisponível nesta versão.');
  return client;
}

function friendlyAuthError(message: string): string {
  if (/expired|invalid|token/i.test(message)) return 'Código inválido ou expirado.';
  if (/rate|too many|seconds/i.test(message)) return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  return 'Não foi possível concluir. Verifique a conexão e tente novamente.';
}

function installSyncTriggers() {
  if (triggersInstalled || !client) return;
  triggersInstalled = true;
  const auth = client.auth;

  // Recomendação Supabase para React Native: refresh de token só em primeiro plano.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void auth.startAutoRefresh();
      useFinancialStore.getState().scheduleSync(0);
    } else {
      void auth.stopAutoRefresh();
    }
  });

  NetInfo.addEventListener((network) => {
    if (network.isConnected) useFinancialStore.getState().scheduleSync(0);
  });
}

export const useSessionStore = create<SessionState>((set, get) => {
  async function linkAfterLogin(userId: string) {
    const financial = useFinancialStore.getState();
    const remote = remoteFactory(requireClient());
    const linkedUser = financial.doc.sync.userId;

    if (linkedUser === userId) {
      financial.setSyncRemote(remote);
      return;
    }

    const plan = await planFirstLogin(financial.doc, remote);

    if (plan === 'choose') {
      set({ awaitingFirstLoginChoice: true });
      return;
    }

    await financial.replaceDocument((doc) =>
      plan === 'upload' ? linkKeepingLocal(doc, userId) : linkUsingRemote(userId),
    );
    financial.setSyncRemote(remote);
  }

  return {
    status: isSupabaseConfigured ? 'loading' : 'disabled',
    email: null,
    userId: null,
    awaitingFirstLoginChoice: false,

    async init() {
      if (!client) {
        set({ status: 'disabled' });
        return;
      }

      installSyncTriggers();
      const { data } = await client.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        set({ status: 'signed-out' });
        return;
      }

      set({ status: 'signed-in', userId: user.id, email: user.email ?? null });
      await linkAfterLogin(user.id).catch((error) => logger.error(error));
    },

    async sendCode(email) {
      const { error } = await requireClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });

      if (error) throw new Error(friendlyAuthError(error.message));
    },

    async verifyCode(email, code) {
      const { data, error } = await requireClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code.trim(),
        type: 'email',
      });
      const user = data.user;

      if (error || !user) {
        logger.event('auth.login', { ok: false });
        throw new Error(friendlyAuthError(error?.message ?? 'invalid'));
      }

      logger.event('auth.login', { ok: true });
      set({ status: 'signed-in', userId: user.id, email: user.email ?? null });
      await linkAfterLogin(user.id);
    },

    async resolveFirstLogin(choice) {
      const userId = get().userId;
      if (!userId) return;

      const financial = useFinancialStore.getState();
      const remote = remoteFactory(requireClient());

      if (choice === 'keep-local') {
        await remote.markAllDeleted(new Date().toISOString());
        await financial.replaceDocument((doc) => linkKeepingLocal(doc, userId));
      } else {
        await financial.replaceDocument(() => linkUsingRemote(userId));
      }

      set({ awaitingFirstLoginChoice: false });
      financial.setSyncRemote(remote);
    },

    async signOut(eraseLocalData) {
      const financial = useFinancialStore.getState();
      financial.setSyncRemote(null);
      await requireClient().auth.signOut({ scope: 'local' });
      await financial.replaceDocument((doc) => unlinkAccount(doc, eraseLocalData));
      logger.event('auth.logout', { ok: true });
      set({ status: 'signed-out', userId: null, email: null, awaitingFirstLoginChoice: false });
    },

    async deleteAccount() {
      const financial = useFinancialStore.getState();
      const remote = remoteFactory(requireClient());

      try {
        await remote.deleteAccount();
      } catch (error) {
        logger.event('account.delete', { ok: false });
        throw new Error('Não foi possível excluir a conta agora. Nada foi apagado. Tente novamente.', {
          cause: error,
        });
      }

      logger.event('account.delete', { ok: true });
      financial.setSyncRemote(null);
      await requireClient().auth.signOut({ scope: 'local' });
      await financial.replaceDocument((doc) => unlinkAccount(doc, false));
      set({ status: 'signed-out', userId: null, email: null, awaitingFirstLoginChoice: false });
    },
  };
});

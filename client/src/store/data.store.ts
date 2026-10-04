import { create } from 'zustand';

import { DomainError } from '@manager-money/core/application/errors';
import { LocalState, UseCaseContext } from '@manager-money/core/application/state';
import { markAllClean } from '@manager-money/core/contract/dirty';
import { SyncError } from '@manager-money/core/contract/types';

import { logger } from '../infrastructure/monitoring/logger';
import { loadUserState, SaveError, saveChanges } from '../infrastructure/repository';
import { loadErrorMessage, saveErrorMessage } from '../lib/messages';
import { getDependencies } from './dependencies';
import { useSessionStore } from './session.store';

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error';

/** Erro de ação já traduzido para a tela. O estado mostrado não contém a mudança recusada. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionError';
  }
}

/** Caso de uso do núcleo já com os parâmetros da tela: `(estado, ctx) → próximo estado`. */
export type UseCase = (state: LocalState, ctx: UseCaseContext) => LocalState;

type DataState = {
  status: DataStatus;
  /** Estado do usuário em memória (nunca persistido no navegador). */
  doc: LocalState | null;
  loadError: string | null;
  saving: boolean;
  load: () => Promise<void>;
  /** Recarrega → aplica o caso de uso do núcleo → grava só o que mudou (ADR-020). */
  run: (action: UseCase) => Promise<void>;
  reset: () => void;
};

function requireContext() {
  const deps = getDependencies();
  const userId = useSessionStore.getState().userId;

  if (!deps || !userId) throw new ActionError('Entre na sua conta para continuar.');

  return { deps, userId };
}

let generation = 0;

export const useDataStore = create<DataState>((set, get) => {
  /** Descarta respostas de uma sessão anterior (logout/troca de conta durante a rede). */
  async function fetchState() {
    const { deps, userId } = requireContext();
    const ticket = generation;
    const doc = await loadUserState(deps.remote, userId, deps.context());

    if (ticket !== generation) throw new ActionError('A sessão mudou durante o carregamento.');

    return doc;
  }

  async function handleAuthLoss() {
    const deps = getDependencies();
    const refreshed = deps ? await deps.auth.refresh() : false;
    if (!refreshed) await useSessionStore.getState().expire();
    return refreshed;
  }

  return {
    status: 'idle',
    doc: null,
    loadError: null,
    saving: false,

    async load() {
      set({ status: 'loading', loadError: null });

      try {
        set({ status: 'ready', doc: await fetchState(), loadError: null });
      } catch (error) {
        const code = error instanceof SyncError ? error.code : 'unknown';
        if (code === 'auth' && (await handleAuthLoss())) return get().load();
        if (!(error instanceof SyncError) && !(error instanceof ActionError)) logger.error(error);
        set({ status: 'error', loadError: loadErrorMessage(code) });
      }
    },

    async run(action) {
      const { deps, userId } = requireContext();
      set({ saving: true });

      try {
        // O servidor é a verdade do web: parte sempre do estado mais recente (inclui o mobile).
        let fresh: LocalState;
        try {
          fresh = await fetchState();
        } catch (error) {
          if (error instanceof SyncError) {
            if (error.code === 'auth') await handleAuthLoss();
            throw new ActionError(saveErrorMessage(error.code, false));
          }
          throw error;
        }
        set({ doc: fresh, status: 'ready' });

        let next: LocalState;
        try {
          next = action(fresh, deps.context());
        } catch (error) {
          if (error instanceof DomainError) throw new ActionError(error.message);
          throw error;
        }

        try {
          await saveChanges(deps.remote, next, userId);
        } catch (error) {
          if (!(error instanceof SaveError)) throw error;

          if (error.code === 'auth') {
            await handleAuthLoss();
          } else if (error.code === 'conflict-active-cycle' || error.partial) {
            if (error.code === 'conflict-active-cycle')
              logger.event('web.conflict', { table: 'cycles' });
            // O servidor pode ter mudado: mostra o estado real, nunca a mudança recusada.
            await get().load();
          }

          throw new ActionError(saveErrorMessage(error.code, error.partial));
        }

        set({ doc: markAllClean(next) });
      } catch (error) {
        if (error instanceof ActionError) throw error;
        logger.error(error);
        throw new ActionError(saveErrorMessage('unknown', false));
      } finally {
        set({ saving: false });
      }
    },

    reset() {
      generation += 1;
      set({ status: 'idle', doc: null, loadError: null, saving: false });
    },
  };
});

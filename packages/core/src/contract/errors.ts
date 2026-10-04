import { SyncError } from './types';

/** Erro do PostgREST/Postgres no formato mínimo usado pelos clientes (sem importar o Supabase). */
export type RemoteErrorLike = { code: string; message: string };

/** Classifica erros do Supabase nos códigos do contrato (contracts.md §3 — Erros tratados). */
export function mapSupabaseError(error: RemoteErrorLike): SyncError {
  if (error.code === '23505' && error.message.includes('cycles_one_active_per_user')) {
    return new SyncError('conflict-active-cycle', error.message);
  }

  if (error.code === '42501' || error.code === 'PGRST301' || error.code === 'PGRST303') {
    return new SyncError('auth', error.message);
  }

  if (/network|fetch|timeout/i.test(error.message)) {
    return new SyncError('network', error.message);
  }

  return new SyncError('unknown', error.message);
}

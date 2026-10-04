import { format, parseISO } from 'date-fns';

import { SessionStatus } from '../store/session.store';

type SyncStatusInput = {
  sessionStatus: SessionStatus;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncAt: string | null;
  lastError: string | null;
};

/** Texto de status de sincronização exibido em Ajustes e Conta (SPEC-006, U9). */
export function describeSyncStatus(input: SyncStatusInput): string {
  if (input.sessionStatus === 'disabled') return 'Indisponível nesta versão';
  if (input.sessionStatus !== 'signed-in') return 'Somente neste aparelho';
  if (input.isSyncing) return 'Sincronizando…';
  if (input.lastError === 'auth') return 'Sessão expirada — entre novamente';
  if (input.lastError === 'network') return 'Sem conexão — tentaremos de novo';
  if (input.lastError) return 'Falha ao sincronizar — tentaremos de novo';
  if (input.pendingChanges > 0) {
    return input.pendingChanges === 1
      ? '1 alteração pendente'
      : `${input.pendingChanges} alterações pendentes`;
  }
  if (input.lastSyncAt) return `Sincronizado às ${format(parseISO(input.lastSyncAt), 'HH:mm')}`;
  return 'Aguardando a primeira sincronização';
}

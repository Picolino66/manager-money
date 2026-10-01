import { describeSyncStatus } from './syncStatus';

const base = { sessionStatus: 'signed-in' as const, isSyncing: false, pendingChanges: 0, lastSyncAt: null, lastError: null };

describe('describeSyncStatus', () => {
  it.each([
    [{ sessionStatus: 'disabled' as const }, 'Indisponível nesta versão'],
    [{ sessionStatus: 'signed-out' as const }, 'Somente neste aparelho'],
    [{ isSyncing: true }, 'Sincronizando…'],
    [{ lastError: 'auth' }, 'Sessão expirada — entre novamente'],
    [{ lastError: 'network' }, 'Sem conexão — tentaremos de novo'],
    [{ lastError: 'unknown' }, 'Falha ao sincronizar — tentaremos de novo'],
    [{ pendingChanges: 1 }, '1 alteração pendente'],
    [{ pendingChanges: 3 }, '3 alterações pendentes'],
    [{}, 'Aguardando a primeira sincronização'],
  ])('%o → %s', (input, expected) => {
    expect(describeSyncStatus({ ...base, ...input })).toBe(expected);
  });

  it('mostra o horário da última sincronização', () => {
    expect(describeSyncStatus({ ...base, lastSyncAt: '2026-10-10T14:32:00' })).toBe('Sincronizado às 14:32');
  });
});

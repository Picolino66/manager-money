import { LocalState } from './state';
import { toISODate } from '../utils/date';

/**
 * Conteúdo exportado (app e web): o documento sem nenhum dado de sessão (BR-ACC-004). Só a data da
 * última sincronização permanece.
 */
export function buildExportPayload(state: LocalState, now: Date = new Date()): string {
  const { sync, ...data } = state;

  return JSON.stringify(
    {
      app: 'manager-money',
      exportedAt: now.toISOString(),
      ...data,
      sync: { lastSyncAt: sync.lastSyncAt },
    },
    null,
    2,
  );
}

export function exportFileName(now: Date = new Date()): string {
  return `manager-money-${toISODate(now)}.json`;
}

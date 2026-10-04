import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { LocalState } from '@manager-money/core/application/state';
import { toISODate } from '@manager-money/core/utils/date';

/** Conteúdo exportado: documento v2 sem nenhum dado de sessão (BR-ACC-004). */
export function buildExportPayload(state: LocalState, now: Date = new Date()): string {
  const { sync, ...data } = state;

  return JSON.stringify(
    { app: 'manager-money', exportedAt: now.toISOString(), ...data, sync: { lastSyncAt: sync.lastSyncAt } },
    null,
    2,
  );
}

export function exportFileName(now: Date = new Date()): string {
  return `manager-money-${toISODate(now)}.json`;
}

/** Grava o JSON no cache e abre o compartilhamento nativo. */
export async function shareJson(fileName: string, content: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(content);

  try {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('O compartilhamento não está disponível neste aparelho.');
    }

    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exportar dados' });
  } finally {
    // O arquivo contém dados financeiros: não fica no cache depois do compartilhamento.
    file.delete();
  }
}

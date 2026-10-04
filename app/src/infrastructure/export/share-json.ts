import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export { buildExportPayload, exportFileName } from '@manager-money/core/application/export-data';

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

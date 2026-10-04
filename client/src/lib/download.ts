/**
 * Entrega um texto como arquivo para download. O arquivo vive só no `Blob` (nada de armazenamento
 * do navegador) e o endereço temporário é liberado logo após o clique.
 */
export function downloadTextFile(fileName: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

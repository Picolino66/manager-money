import { Download } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';

import { buildExportPayload, exportFileName } from '@manager-money/core/application/export-data';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { downloadTextFile } from '@/lib/download';
import { useDataStore } from '@/store/data.store';

/**
 * Exportar dados (BR-ACC-004): o mesmo JSON do app, sem dados de sessão, montado a partir do que
 * foi lido do servidor. Só lê; nunca grava.
 */
export function ExportPage() {
  const doc = useDataStore((state) => state.doc);

  if (!doc) return null;

  function handleExport() {
    if (!doc) return;
    const now = new Date();

    downloadTextFile(exportFileName(now), buildExportPayload(doc, now), 'application/json');
    toast.success('Arquivo gerado.');
  }

  return (
    <>
      <PageHeader title="Exportar dados" />
      <Card className="max-w-2xl">
        <p className="text-sm text-text">
          Baixe um arquivo JSON com todos os seus dados: configuração, ciclos, gastos, cartões,
          faturas e rendas. O arquivo não inclui dados de login.
        </p>
        <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
          O arquivo contém suas informações financeiras sem proteção. Guarde-o em local seguro e não
          o compartilhe com quem você não confia.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={handleExport}>
            <Download aria-hidden className="h-4 w-4" /> Baixar arquivo JSON
          </Button>
          <Link to="/ajustes" className="text-sm text-primary underline">
            Voltar aos ajustes
          </Link>
        </div>
      </Card>
    </>
  );
}

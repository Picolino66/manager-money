import { ReactNode } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { Button } from '@/components/ui/button';

function Centered({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        <p className="text-sm text-muted">{message}</p>
        {children}
      </div>
    </main>
  );
}

export function NotFoundPage() {
  return (
    <Centered title="Página não encontrada" message="O endereço não existe ou foi movido.">
      <Button asChild>
        <Link to="/">Ir para a visão geral</Link>
      </Button>
    </Centered>
  );
}

/** Erro inesperado de renderização ou de rota: mensagem simples, sem detalhes técnicos. */
export function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <Centered
      title="Algo deu errado"
      message="Recarregue a página. Seus dados estão salvos no servidor."
    >
      <Button onClick={() => window.location.reload()}>Recarregar</Button>
    </Centered>
  );
}

export function UnconfiguredPage() {
  return (
    <Centered
      title="Configuração ausente"
      message="Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em client/.env (veja client/.env.example) e reinicie o servidor."
    />
  );
}

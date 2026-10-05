import { Navigate, useLocation, useParams } from 'react-router';

/**
 * Endereço antigo → novo, mantendo favoritos e links (inclusive a busca, ex.: `?novo=1`). `:id` no
 * destino recebe o parâmetro da rota antiga. `/gastos` virou `/historico`; `/ciclos` e `/analise`
 * foram para Relatórios; `/ajustes/cartoes` virou `/cartoes` (ADR-024).
 */
export function LegacyRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  const { id = '' } = useParams();

  return <Navigate to={`${to.replace(':id', id)}${search}`} replace />;
}

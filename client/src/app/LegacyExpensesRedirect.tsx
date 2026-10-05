import { Navigate, useLocation } from 'react-router';

/** `/gastos` virou `/historico`: mantém favoritos e links antigos (inclusive `?novo=1`). */
export function LegacyExpensesRedirect() {
  const { search } = useLocation();

  return <Navigate to={`/historico${search}`} replace />;
}

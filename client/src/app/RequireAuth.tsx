import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

import { selectConfig } from '@manager-money/core/application/selectors';

import { PageSkeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { useDataStore } from '@/store/data.store';
import { useSessionStore } from '@/store/session.store';

import { UnconfiguredPage } from './StatusPages';

export const ONBOARDING_PATH = '/comecar';

/**
 * Guarda de rota (UX, não segurança: a proteção real é a RLS). Sem sessão → login; com sessão →
 * carrega o estado do usuário; conta sem configuração → onboarding (CLIENT-009A).
 */
export function RequireAuth() {
  const status = useSessionStore((state) => state.status);
  const location = useLocation();

  if (status === 'loading') return <PageSkeleton />;
  if (status === 'unconfigured') return <UnconfiguredPage />;
  if (status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <DataGate />;
}

function DataGate() {
  const status = useDataStore((state) => state.status);
  const doc = useDataStore((state) => state.doc);
  const loadError = useDataStore((state) => state.loadError);
  const load = useDataStore((state) => state.load);
  const { pathname } = useLocation();

  useEffect(() => {
    if (status === 'idle') void load();
  }, [status, load]);

  if (!doc) {
    if (status === 'error' && loadError) {
      return (
        <div className="mx-auto max-w-xl p-6">
          <ErrorState message={loadError} onRetry={() => void load()} />
        </div>
      );
    }
    return <PageSkeleton />;
  }

  const needsOnboarding = selectConfig(doc) === null;

  if (pathname === ONBOARDING_PATH) {
    return needsOnboarding ? <Outlet /> : <Navigate to="/" replace />;
  }

  return needsOnboarding ? <Navigate to={ONBOARDING_PATH} replace /> : <Outlet />;
}

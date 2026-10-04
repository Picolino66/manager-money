import { createBrowserRouter } from 'react-router';

import { AppShell } from './app/AppShell';
import { ONBOARDING_PATH, RequireAuth } from './app/RequireAuth';
import { NotFoundPage, RouteErrorPage } from './app/StatusPages';

/** Rotas em português (client-web-plan → Rotas). Telas carregadas sob demanda. */
export const routes = [
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('./features/auth/LoginPage')).LoginPage }),
  },
  {
    path: '/privacidade',
    lazy: async () => ({ Component: (await import('./features/legal/PrivacyPage')).PrivacyPage }),
  },
  {
    element: <RequireAuth />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: ONBOARDING_PATH,
        lazy: async () => ({
          Component: (await import('./features/onboarding/OnboardingPage')).OnboardingPage,
        }),
      },
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            lazy: async () => ({
              Component: (await import('./features/overview/OverviewPage')).OverviewPage,
            }),
          },
          {
            path: 'gastos',
            lazy: async () => ({
              Component: (await import('./features/expenses/ExpensesPage')).ExpensesPage,
            }),
          },
          {
            path: 'ciclos',
            lazy: async () => ({
              Component: (await import('./features/cycles/CyclesPage')).CyclesPage,
            }),
          },
          {
            path: 'ciclos/:id',
            lazy: async () => ({
              Component: (await import('./features/cycles/CycleDetailPage')).CycleDetailPage,
            }),
          },
          {
            path: 'ajustes',
            lazy: async () => ({
              Component: (await import('./features/settings/SettingsPage')).SettingsPage,
            }),
          },
          {
            path: 'ajustes/configuracao',
            lazy: async () => ({
              Component: (await import('./features/settings/ConfigPage')).ConfigPage,
            }),
          },
          {
            path: 'ajustes/exportar',
            lazy: async () => ({
              Component: (await import('./features/settings/ExportPage')).ExportPage,
            }),
          },
          {
            path: 'ajustes/cartoes',
            lazy: async () => ({
              Component: (await import('./features/cards/CardsPage')).CardsPage,
            }),
          },
          {
            path: 'ajustes/cartoes/:id',
            lazy: async () => ({
              Component: (await import('./features/cards/CardDetailPage')).CardDetailPage,
            }),
          },
          {
            path: 'analise',
            lazy: async () => ({
              Component: (await import('./features/analysis/AnalysisPage')).AnalysisPage,
            }),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

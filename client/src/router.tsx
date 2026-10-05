import { createBrowserRouter, Navigate } from 'react-router';

import { AppShell } from './app/AppShell';
import { ONBOARDING_PATH, RequireAuth } from './app/RequireAuth';
import { LegacyRedirect } from './app/LegacyRedirect';
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
          { path: 'gastos', element: <LegacyRedirect to="/historico" /> },
          {
            path: 'historico',
            lazy: async () => ({
              Component: (await import('./features/expenses/ExpensesPage')).ExpensesPage,
            }),
          },
          {
            path: 'cartoes',
            lazy: async () => ({
              Component: (await import('./features/cards/CardsPage')).CardsPage,
            }),
          },
          {
            path: 'cartoes/:id',
            lazy: async () => ({
              Component: (await import('./features/cards/CardDetailPage')).CardDetailPage,
            }),
          },
          {
            path: 'cartoes/:id/compras-anteriores',
            lazy: async () => ({
              Component: (await import('./features/cards/CardDebtPage')).CardDebtPage,
            }),
          },
          {
            path: 'relatorios',
            lazy: async () => ({
              Component: (await import('./features/reports/ReportsLayout')).ReportsLayout,
            }),
            children: [
              { index: true, element: <Navigate to="ciclos" replace /> },
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
                path: 'categorias',
                lazy: async () => ({
                  Component: (await import('./features/analysis/AnalysisPage')).AnalysisPage,
                }),
              },
              {
                path: 'credito',
                lazy: async () => ({
                  Component: (await import('./features/reports/CreditReportPage')).CreditReportPage,
                }),
              },
            ],
          },
          // Endereços antigos (ADR-024).
          { path: 'ciclos', element: <LegacyRedirect to="/relatorios/ciclos" /> },
          { path: 'ciclos/:id', element: <LegacyRedirect to="/relatorios/ciclos/:id" /> },
          { path: 'analise', element: <LegacyRedirect to="/relatorios/categorias" /> },
          { path: 'ajustes/cartoes', element: <LegacyRedirect to="/cartoes" /> },
          { path: 'ajustes/cartoes/:id', element: <LegacyRedirect to="/cartoes/:id" /> },
          {
            path: 'ajustes/cartoes/:id/compras-anteriores',
            element: <LegacyRedirect to="/cartoes/:id/compras-anteriores" />,
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
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

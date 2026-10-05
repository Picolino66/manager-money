import { NavLink, Outlet } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { cn } from '@/lib/cn';

const TABS = [
  { to: '/relatorios/ciclos', label: 'Ciclos' },
  { to: '/relatorios/categorias', label: 'Categorias' },
  { to: '/relatorios/credito', label: 'Crédito' },
] as const;

/**
 * Relatórios (ADR-024): olhar para trás. Ciclos (ciclo do salário), Categorias (para onde foi o
 * dinheiro) e Crédito (faturas pelo ciclo do cartão). A lista de lançamentos fica só no Histórico.
 */
export function ReportsLayout() {
  return (
    <>
      <PageHeader
        title="Relatórios"
        description="Como foram os ciclos, para onde foi o dinheiro e como andam as faturas."
      />
      <nav aria-label="Relatórios" className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary-dark'
                  : 'border-transparent text-muted hover:text-ink',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}

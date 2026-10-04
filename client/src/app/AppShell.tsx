import { useState } from 'react';
import {
  ChartPie,
  History,
  LayoutDashboard,
  Loader2,
  Menu,
  ReceiptText,
  Settings,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router';

import { selectActiveCycle } from '@manager-money/core/application/selectors';
import { formatCycleLabel } from '@manager-money/core/utils/date';

import { AccountMenu } from '@/components/AccountMenu';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import { useDataStore } from '@/store/data.store';

const NAV = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/gastos', label: 'Histórico', icon: ReceiptText, end: false },
  { to: '/ciclos', label: 'Ciclos', icon: History, end: false },
  { to: '/analise', label: 'Análise', icon: ChartPie, end: false },
  { to: '/ajustes', label: 'Ajustes', icon: Settings, end: false },
] as const;

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary-dark' : 'text-text hover:bg-surface-muted',
            )
          }
        >
          <Icon aria-hidden className="h-4 w-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="mb-6 flex items-center gap-2 px-3">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-on-primary"
      >
        M
      </span>
      <span className="text-base font-semibold text-ink">Manager Money</span>
    </div>
  );
}

/** Layout de desktop: sidebar fixa ≥ 1024px; abaixo disso, drawer (client-web-plan → UI/UX). */
export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const doc = useDataStore((state) => state.doc);
  const saving = useDataStore((state) => state.saving);
  const cycle = doc ? selectActiveCycle(doc) : null;

  return (
    <div className="flex min-h-full">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
      >
        Pular para o conteúdo
      </a>
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface px-3 py-5 lg:block">
        <Brand />
        <Navigation />
      </aside>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen} title="Navegação">
        <Brand />
        <Navigation onNavigate={() => setDrawerOpen(false)} />
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir navegação"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu aria-hidden className="h-5 w-5" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm text-muted">
            {cycle ? (
              <>
                Ciclo ativo:{' '}
                <span className="font-medium text-ink">
                  {formatCycleLabel(cycle.startDate, cycle.endDate)}
                </span>
              </>
            ) : (
              'Nenhum ciclo ativo'
            )}
          </p>
          <span aria-live="polite" className="flex items-center gap-1.5 text-xs text-muted">
            {saving ? (
              <>
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                Salvando…
              </>
            ) : null}
          </span>
          <AccountMenu />
        </header>
        <main id="conteudo" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { ChevronRight, Download, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router';

import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui/card';

const ITEMS = [
  {
    to: '/ajustes/configuracao',
    icon: SlidersHorizontal,
    title: 'Configuração financeira',
    subtitle: 'Renda, meta, dia do pagamento e despesas fixas',
  },
  {
    to: '/ajustes/exportar',
    icon: Download,
    title: 'Exportar dados',
    subtitle: 'Arquivo JSON com todos os seus dados',
  },
  {
    to: '/privacidade',
    icon: ShieldCheck,
    title: 'Política de privacidade',
    subtitle: 'Como seus dados são tratados',
  },
] as const;

/**
 * Mesmos atalhos da tela Ajustes do app (sem "Conta e sincronização": o web não sincroniza). Cartões
 * saíram daqui para o menu principal (ADR-024).
 */
export function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Configuração, exportação e privacidade. Os cartões ficam no menu Cartões."
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {ITEMS.map(({ to, icon: Icon, title, subtitle }) => (
          <li key={to}>
            <Link to={to} className="block rounded-lg hover:bg-surface-muted/60">
              <Card className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-soft text-primary-dark"
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{title}</span>
                  <span className="block text-sm text-muted">{subtitle}</span>
                </span>
                <ChevronRight aria-hidden className="h-4 w-4 text-muted" />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

import { describeCycleStatements } from '@manager-money/core/application/card-view';
import {
  describeCycleDeficit,
  describeSpendableToday,
} from '@manager-money/core/application/spendable-today';
import { ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatShortDate } from '@manager-money/core/utils/date';

import { DayStatusBadge } from '@/components/DayStatusBadge';
import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { buildOverview } from '@/lib/overview';
import { useDataStore } from '@/store/data.store';

import { BalanceChartCard, CreditChartCard } from './ChartCards';

function Kpi({
  label,
  children,
  sub,
  hint,
}: {
  label: string;
  children: ReactNode;
  /** Valor secundário logo abaixo do principal. */
  sub?: ReactNode;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold text-ink">{children}</p>
      {sub ? <p className="text-sm text-ink">{sub}</p> : null}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

/** Visão geral do ciclo ativo, somente leitura (P0). */
export function OverviewPage() {
  const doc = useDataStore((state) => state.doc);
  const [now] = useState(() => new Date());
  const view = useMemo(() => (doc ? buildOverview(doc, now) : null), [doc, now]);

  if (!doc || !view) return null;

  if (view.kind !== 'active') {
    return (
      <>
        <PageHeader title="Visão geral" />
        <EmptyState
          title="Nenhum ciclo ativo"
          message="O último ciclo foi fechado. Abra o próximo ciclo no app para voltar a acompanhar o limite diário aqui."
          action={
            <Button asChild variant="secondary">
              <Link to="/relatorios/ciclos">Ver ciclos anteriores</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { summary } = view;
  const spendable = describeSpendableToday(summary);

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Ciclo ${summary.cycleLabel} · ${summary.remainingDays} dia(s) restante(s)`}
        actions={
          <Button asChild>
            <Link to="/historico?novo=1">Registrar gasto</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted">Ainda pode gastar hoje</p>
            <DayStatusBadge status={summary.dayStatus} />
          </div>
          <p className="text-2xl font-semibold text-ink">
            <Money value={spendable.amount} />
          </p>
          {spendable.cycleDeficit !== null ? (
            <p className="text-xs font-medium text-negative">
              {describeCycleDeficit(spendable.cycleDeficit, view.cycleEnd)}
            </p>
          ) : null}
          <p className="text-xs text-muted">
            Já gastou hoje <Money value={summary.todaySpent} />
          </p>
        </Card>
        <Kpi
          label="Gasto no saldo"
          hint={`Gastos do dia a dia. Fixas pagas: ${formatCurrency(view.balance.fixedPaid)} (já reservadas). Meta guardada: ${formatCurrency(view.savingGoal)}`}
        >
          <Money value={summary.totalSpent} />
        </Kpi>
        <Kpi
          label="Disponível no ciclo"
          sub={
            <>
              Saldo em conta <Money value={view.balance.balance} className="font-semibold" />
            </>
          }
          hint="Já descontados fixas pendentes, faturas e a meta. O saldo em conta não desconta reservados nem a meta."
        >
          <Money value={summary.remainingAvailableAmount} />
        </Kpi>
        <Kpi label="Gasto no crédito" hint={describeCycleStatements(view.credit.statements)}>
          <Money value={view.credit.cycleStatementsAmount} />
        </Kpi>
        <Kpi
          label="Disponível no crédito"
          hint={
            view.credit.availableLimit === null
              ? 'Nenhum cartão ativo com limite informado.'
              : view.credit.cardsWithoutLimit > 0
                ? `Soma dos limites informados; ${view.credit.cardsWithoutLimit} cartão(ões) sem limite ficou(aram) de fora.`
                : 'Limite dos cartões ativos menos o que já está comprometido.'
          }
        >
          {view.credit.availableLimit === null ? '—' : <Money value={view.credit.availableLimit} />}
        </Kpi>
      </div>

      {view.notStarted ? (
        <Card className="mt-4">
          <CardTitle>Saldo e crédito</CardTitle>
          <p className="mt-3 text-sm text-muted">O ciclo ainda não começou.</p>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <BalanceChartCard doc={doc} cycleId={view.cycleId} now={now} />
          <CreditChartCard doc={doc} now={now} />
        </div>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardTitle>Compromissos reservados</CardTitle>
          {view.commitments.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nenhuma fixa pendente nem fatura a pagar neste ciclo.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {view.commitments.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{item.label}</span>
                    <span className="text-xs text-muted">
                      {item.kind === 'statement'
                        ? `Fatura · vence ${formatShortDate(item.dueDate)}`
                        : 'Despesa fixa pendente'}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {item.kind === 'statement' && item.overdue ? (
                      <Badge tone="critical">Vencida</Badge>
                    ) : null}
                    <Money value={item.amount} />
                  </span>
                </li>
              ))}
              <li className="flex justify-between py-2 text-sm font-semibold text-ink">
                <span>Total</span>
                <Money value={view.commitmentsTotal} />
              </li>
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Limite dos cartões</CardTitle>
            <Link to="/cartoes" className="text-sm text-primary underline">
              Ver cartões
            </Link>
          </div>
          {view.cards.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nenhum cartão ativo. O limite do cartão nunca conta como dinheiro disponível.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {view.cards.map((card) => (
                <li key={card.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-ink">{card.name}</span>
                  {card.usage?.available !== null && card.usage?.available !== undefined ? (
                    <span className="text-muted">
                      disponível{' '}
                      <Money value={card.usage.available} className="font-medium text-ink" />
                    </span>
                  ) : (
                    <span className="text-muted">limite não informado</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

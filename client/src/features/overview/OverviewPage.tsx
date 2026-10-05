import { ReactNode, useMemo } from 'react';
import { Link } from 'react-router';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatShortDate } from '@manager-money/core/utils/date';

import { DayStatusBadge } from '@/components/DayStatusBadge';
import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { Table, Td, Th, MoneyTd } from '@/components/ui/table';
import { formatAxisReais, moneyTicks } from '@/lib/chart';
import { buildOverview, DailyPoint } from '@/lib/overview';
import { useDataStore } from '@/store/data.store';

function Kpi({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-2xl font-semibold text-ink">{children}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}

function DailyChart({ data }: { data: DailyPoint[] }) {
  const ticks = moneyTicks(Math.max(...data.map((point) => Math.max(point.spent, point.limit))));

  return (
    <figure>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              stroke="var(--muted)"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              ticks={ticks}
              domain={[0, ticks[ticks.length - 1] ?? 0]}
              tickFormatter={formatAxisReais}
              stroke="var(--muted)"
              fontSize={12}
              width={72}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value)),
                name === 'spent' ? 'Gasto' : 'Limite previsto',
              ]}
              labelFormatter={(label) => formatShortDate(String(label))}
              contentStyle={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                color: 'var(--ink)',
              }}
            />
            <Bar
              dataKey="spent"
              name="spent"
              fill="var(--primary)"
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
            <Line
              dataKey="limit"
              name="limit"
              stroke="var(--warning)"
              strokeWidth={2}
              dot={false}
              type="step"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-primary" /> Gasto do dia
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-3 bg-warning" /> Limite previsto
        </span>
      </figcaption>
      {/* Tabela equivalente ao gráfico (acessibilidade). */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-primary">Ver dados em tabela</summary>
        <div className="mt-2">
          <Table>
            <thead>
              <tr>
                <Th>Dia</Th>
                <Th className="text-right">Gasto</Th>
                <Th className="text-right">Limite previsto</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.date}>
                  <Td>{formatShortDate(point.date)}</Td>
                  <MoneyTd>{formatCurrency(point.spent)}</MoneyTd>
                  <MoneyTd>{formatCurrency(point.limit)}</MoneyTd>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </details>
    </figure>
  );
}

/** Visão geral do ciclo ativo, somente leitura (P0). */
export function OverviewPage() {
  const doc = useDataStore((state) => state.doc);
  const view = useMemo(() => (doc ? buildOverview(doc, new Date()) : null), [doc]);

  if (!view) return null;

  if (view.kind !== 'active') {
    return (
      <>
        <PageHeader title="Visão geral" />
        <EmptyState
          title="Nenhum ciclo ativo"
          message="O último ciclo foi fechado. Abra o próximo ciclo no app para voltar a acompanhar o limite diário aqui."
          action={
            <Button asChild variant="secondary">
              <Link to="/ciclos">Ver ciclos anteriores</Link>
            </Button>
          }
        />
      </>
    );
  }

  const { summary } = view;

  return (
    <>
      <PageHeader
        title="Visão geral"
        description={`Ciclo ${summary.cycleLabel} · ${summary.remainingDays} dia(s) restante(s)`}
        actions={
          <Button asChild>
            <Link to="/gastos?novo=1">Registrar gasto</Link>
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
            <Money value={summary.todayBalance} />
          </p>
          <p className="text-xs text-muted">
            Já gastou hoje <Money value={summary.todaySpent} />
          </p>
        </Card>
        <Kpi label="Disponível no ciclo" hint="Já descontados fixas pendentes, faturas e a meta.">
          <Money value={summary.remainingAvailableAmount} />
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
        <Kpi
          label="Gasto no saldo"
          hint={`Pix, dinheiro e débito no ciclo. Meta guardada: ${formatCurrency(view.savingGoal)}`}
        >
          <Money value={summary.totalSpent} />
        </Kpi>
        <Kpi label="Gasto no crédito" hint="Fatura vigente (aberta) dos cartões ativos.">
          <Money value={view.credit.currentStatementAmount} />
        </Kpi>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardTitle>Gasto diário vs. limite</CardTitle>
          <div className="mt-4">
            {view.daily.length > 0 ? (
              <DailyChart data={view.daily} />
            ) : (
              <p className="text-sm text-muted">O ciclo ainda não começou.</p>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-4">
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
            <CardTitle>Limite dos cartões</CardTitle>
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
      </div>
    </>
  );
}

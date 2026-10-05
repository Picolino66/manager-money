import { describeCycleStatements } from '@manager-money/core/application/card-view';
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
import { formatAxisReais, moneyTicksBetween } from '@/lib/chart';
import { buildOverview } from '@/lib/overview';
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

type Series = {
  key: string;
  label: string;
  kind: 'bar' | 'line';
  color: string;
  /** Linha em degrau (limite previsto). */
  step?: boolean;
};

type ChartRow = { date: string } & Record<string, number | string | null>;

/**
 * Gráfico diário do ciclo (barras e linhas em centavos) com a tabela equivalente em "Ver dados em
 * tabela" (acessibilidade). Os valores vêm prontos do núcleo.
 */
function CycleChart({
  title,
  data,
  series,
}: {
  title: string;
  data: ChartRow[];
  series: Series[];
}) {
  const values = data.flatMap((row) =>
    series
      .map((item) => row[item.key])
      .filter((value): value is number => typeof value === 'number'),
  );
  const ticks = moneyTicksBetween(Math.min(0, ...values), Math.max(0, ...values));
  const labels = Object.fromEntries(series.map((item) => [item.key, item.label]));

  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <figure className="mt-4">
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
                domain={[ticks[0] ?? 0, ticks[ticks.length - 1] ?? 0]}
                tickFormatter={formatAxisReais}
                stroke="var(--muted)"
                fontSize={12}
                width={72}
                tickLine={false}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value)), labels[String(name)]]}
                labelFormatter={(label) => formatShortDate(String(label))}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                }}
              />
              {series.map((item) =>
                item.kind === 'bar' ? (
                  <Bar
                    key={item.key}
                    dataKey={item.key}
                    name={item.key}
                    fill={item.color}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                ) : (
                  <Line
                    key={item.key}
                    dataKey={item.key}
                    name={item.key}
                    stroke={item.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    type={item.step ? 'step' : 'monotone'}
                  />
                ),
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={item.kind === 'bar' ? 'h-2.5 w-2.5 rounded-sm' : 'h-0.5 w-3'}
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
        </figcaption>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-primary">Ver dados em tabela</summary>
          <div className="mt-2">
            <Table>
              <thead>
                <tr>
                  <Th>Dia</Th>
                  {series.map((item) => (
                    <Th key={item.key} className="text-right">
                      {item.label}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.date}>
                    <Td>{formatShortDate(row.date)}</Td>
                    {series.map((item) => {
                      const value = row[item.key];

                      return typeof value === 'number' ? (
                        <MoneyTd key={item.key}>{formatCurrency(value)}</MoneyTd>
                      ) : (
                        <Td key={item.key} className="text-right text-muted">
                          —
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </details>
      </figure>
    </Card>
  );
}

const BALANCE_SERIES: Series[] = [
  { key: 'spent', label: 'Gasto do saldo', kind: 'bar', color: 'var(--primary)' },
  { key: 'limit', label: 'Limite previsto', kind: 'line', color: 'var(--warning)', step: true },
  { key: 'available', label: 'Disponível no ciclo', kind: 'line', color: 'var(--ink)' },
];

const CREDIT_SERIES: Series[] = [
  { key: 'creditSpent', label: 'Gasto do crédito', kind: 'bar', color: 'var(--primary)' },
  { key: 'creditAvailable', label: 'Disponível de crédito', kind: 'line', color: 'var(--warning)' },
];

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
            <Money value={summary.todayBalance} />
          </p>
          <p className="text-xs text-muted">
            Já gastou hoje <Money value={summary.todaySpent} />
          </p>
        </Card>
        <Kpi
          label="Gasto no saldo"
          hint={`Pix, dinheiro e débito no ciclo. Meta guardada: ${formatCurrency(view.savingGoal)}`}
        >
          <Money value={summary.totalSpent} />
        </Kpi>
        <Kpi label="Disponível no ciclo" hint="Já descontados fixas pendentes, faturas e a meta.">
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

      {view.daily.length > 0 ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <CycleChart title="Saldo no ciclo" data={view.daily} series={BALANCE_SERIES} />
          <CycleChart title="Crédito no ciclo" data={view.creditDaily} series={CREDIT_SERIES} />
        </div>
      ) : (
        <Card className="mt-4">
          <CardTitle>Saldo e crédito no ciclo</CardTitle>
          <p className="mt-3 text-sm text-muted">O ciclo ainda não começou.</p>
        </Card>
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
    </>
  );
}

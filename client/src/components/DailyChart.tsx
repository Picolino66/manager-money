import { ReactNode } from 'react';
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

import { Card, CardTitle } from '@/components/ui/card';
import { MoneyTd, Table, Td, Th } from '@/components/ui/table';
import { ChartSeries, formatAxisReais, moneyTicksBetween } from '@/lib/chart';

export type DailyChartRow = { date: string } & Record<string, number | string | null>;

/**
 * Gráfico diário (barras e linhas em centavos) com a tabela equivalente em "Ver dados em tabela"
 * (acessibilidade). Os valores vêm prontos do núcleo; dia sem valor fica vazio ("—").
 */
export function DailyChart({
  title,
  description,
  controls,
  data,
  series,
  empty,
}: {
  title: string;
  /** Período e base mostrados (ex.: "Fatura 09/09 a 08/10, vence 15/10"). */
  description?: ReactNode;
  controls?: ReactNode;
  data: DailyChartRow[];
  series: ChartSeries[];
  /** Texto quando não há dias para mostrar. */
  empty?: string;
}) {
  const values = data.flatMap((row) =>
    series
      .map((item) => row[item.key])
      .filter((value): value is number => typeof value === 'number'),
  );
  const ticks = moneyTicksBetween(Math.min(0, ...values), Math.max(0, ...values));
  const labels = Object.fromEntries(series.map((item) => [item.key, item.label]));

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <CardTitle>{title}</CardTitle>
        {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
      </div>
      {controls}
      {data.length === 0 ? (
        <p className="text-sm text-muted">{empty ?? 'Nenhum dia no período.'}</p>
      ) : (
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
                      stackId={item.stack}
                      radius={item.stack ? undefined : [3, 3, 0, 0]}
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
      )}
    </Card>
  );
}

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
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

import { selectActiveCycle } from '@manager-money/core/application/selectors';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatCycleLabel } from '@manager-money/core/utils/date';

import { Money } from '@/components/Money';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { MoneyTd, Table, Td, Th } from '@/components/ui/table';
import { formatAxisReais, moneyTicksBetween } from '@/lib/chart';
import { buildClosedCycles, ClosedCycleRow } from '@/lib/cycles';
import { useDataStore } from '@/store/data.store';

const COMPARISON_SERIES = [
  { key: 'totalSpent', label: 'Gasto no saldo', color: 'var(--primary)' },
  { key: 'cardTotal', label: 'Faturas do ciclo', color: 'var(--warning)' },
] as const;

/** Comparação entre ciclos: gasto no saldo e faturas (barras) e resultado (linha). */
function CyclesComparison({ cycles }: { cycles: ClosedCycleRow[] }) {
  const data = [...cycles]
    .reverse()
    .map((cycle) => ({ ...cycle, label: formatCycleLabel(cycle.startDate, cycle.endDate) }));
  const values = data.flatMap((row) => [row.totalSpent, row.cardTotal, row.finalBalance]);
  const ticks = moneyTicksBetween(Math.min(0, ...values), Math.max(0, ...values));
  const labels: Record<string, string> = {
    totalSpent: 'Gasto no saldo',
    cardTotal: 'Faturas do ciclo',
    finalBalance: 'Resultado',
  };

  return (
    <Card className="mb-4">
      <CardTitle>Comparação entre ciclos</CardTitle>
      <p className="mt-1 text-xs text-muted">
        Ciclo do salário: o que saiu do saldo, as faturas que venceram no ciclo e o resultado.
      </p>
      <figure className="mt-4">
        <div className="h-64" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} />
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
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--ink)',
                }}
              />
              {COMPARISON_SERIES.map((item) => (
                <Bar
                  key={item.key}
                  dataKey={item.key}
                  name={item.key}
                  fill={item.color}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={32}
                />
              ))}
              <Line
                dataKey="finalBalance"
                name="finalBalance"
                stroke="var(--ink)"
                strokeWidth={2}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {COMPARISON_SERIES.map((item) => (
            <span key={item.key} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3" style={{ background: 'var(--ink)' }} />
            Resultado
          </span>
          <span className="sr-only">A tabela abaixo traz os mesmos valores.</span>
        </figcaption>
      </figure>
    </Card>
  );
}

/** Aba Ciclos dos Relatórios: ciclos fechados com o resultado de cada um (somente leitura). */
export function CyclesPage() {
  const doc = useDataStore((state) => state.doc);
  const closed = useMemo(() => (doc ? buildClosedCycles(doc) : []), [doc]);
  const years = useMemo(() => [...new Set(closed.map((cycle) => cycle.year))], [closed]);
  const [year, setYear] = useState('');
  const visible = year ? closed.filter((cycle) => cycle.year === year) : closed;
  const active = doc ? selectActiveCycle(doc) : null;

  return (
    <>
      {active ? (
        <Card className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Ciclo atual</p>
            <p className="font-medium text-ink">
              {formatCycleLabel(active.startDate, active.endDate)}
            </p>
          </div>
          <Link
            to={`/relatorios/ciclos/${active.id}`}
            className="inline-flex items-center gap-1 text-sm text-primary"
          >
            Ver detalhe <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
        </Card>
      ) : null}

      {closed.length === 0 ? (
        <EmptyState
          title="Nenhum ciclo fechado"
          message="Ciclos fechados aparecem aqui com o resultado de cada um."
        />
      ) : (
        <>
          <div className="mb-4 max-w-40">
            <Field label="Ano">
              {(props) => (
                <NativeSelect
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  {...props}
                >
                  <option value="">Todos</option>
                  {years.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </div>
          <CyclesComparison cycles={visible} />
          <Table>
            <caption className="sr-only">Ciclos fechados</caption>
            <thead>
              <tr>
                <Th>Ciclo</Th>
                <Th className="text-right">Saldo inicial</Th>
                <Th className="text-right">Gasto no saldo</Th>
                <Th className="text-right">Faturas do ciclo</Th>
                <Th className="text-right">Resultado</Th>
                <Th>
                  <span className="sr-only">Detalhe</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((cycle) => (
                <tr key={cycle.id} className="hover:bg-surface-muted">
                  <Td className="font-medium text-ink">
                    {formatCycleLabel(cycle.startDate, cycle.endDate)}
                  </Td>
                  <MoneyTd>
                    <Money value={cycle.initialAvailableAmount} />
                  </MoneyTd>
                  <MoneyTd>
                    <Money value={cycle.totalSpent} />
                  </MoneyTd>
                  <MoneyTd>
                    <Money value={cycle.cardTotal} />
                  </MoneyTd>
                  <MoneyTd>
                    <span className="inline-flex items-center gap-2">
                      <Badge
                        tone={
                          cycle.finalBalance < 0
                            ? 'negative'
                            : cycle.finalBalance > 0
                              ? 'healthy'
                              : 'neutral'
                        }
                      >
                        {cycle.finalBalance < 0
                          ? 'Negativo'
                          : cycle.finalBalance > 0
                            ? 'Sobrou'
                            : 'Zerado'}
                      </Badge>
                      <Money value={cycle.finalBalance} signed />
                    </span>
                  </MoneyTd>
                  <Td className="text-right">
                    <Link
                      to={`/relatorios/ciclos/${cycle.id}`}
                      className="inline-flex items-center gap-1 text-sm text-primary"
                      aria-label={`Detalhe do ciclo ${formatCycleLabel(cycle.startDate, cycle.endDate)}`}
                    >
                      Detalhe <ChevronRight aria-hidden className="h-4 w-4" />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </>
  );
}

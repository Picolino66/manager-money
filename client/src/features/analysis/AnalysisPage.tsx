import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Link } from 'react-router';

import {
  CategorizedItemType,
  filterCategorizedItems,
  filterCategorizedItemsByType,
  selectCategorizedItems,
  selectCycleCategorizedItems,
  sumCategorizedItems,
  summarizeByCategory,
} from '@manager-money/core/application/category-analysis';
import { selectActiveCycle, selectConfig } from '@manager-money/core/application/selectors';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatCycleLabel, toISODate } from '@manager-money/core/utils/date';
import { parseISO } from 'date-fns';

import { Money } from '@/components/Money';
import { formatAxisReais, moneyTicks } from '@/lib/chart';
import { listCycleOptions } from '@/lib/overview';
import { Card, CardTitle } from '@/components/ui/card';
import { DateMaskField } from '@/components/ui/date-mask-input';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { MoneyTd, Table, Td, Th } from '@/components/ui/table';
import { useDataStore } from '@/store/data.store';

const TYPE_ORDER: CategorizedItemType[] = ['expense', 'card', 'installment', 'fixed'];
const TYPE_FILTER_LABELS: Record<CategorizedItemType, string> = {
  expense: 'Gasto',
  card: 'Cartão',
  installment: 'Parcelado',
  fixed: 'Fixo',
};

const FREE_PERIOD = 'periodo';

/**
 * Aba Categorias dos Relatórios (RF-09, BR-FIN-039). Base "Ciclo": o que pesou no ciclo do salário
 * — gastos, fixas à vista e as parcelas das faturas que vencem nele. Base "Período livre": pela
 * data, com a compra no cartão pelo valor total. Os lançamentos ficam no Histórico.
 */
export function AnalysisPage() {
  const doc = useDataStore((state) => state.doc);
  const active = doc ? selectActiveCycle(doc) : null;
  const cycles = useMemo(() => (doc ? listCycleOptions(doc) : []), [doc]);
  const today = toISODate(new Date());
  const [base, setBase] = useState<string>(active?.id ?? cycles[0]?.id ?? FREE_PERIOD);
  const [from, setFrom] = useState(active?.startDate ?? today);
  const [to, setTo] = useState(active?.endDate ?? today);
  const [category, setCategory] = useState('');
  // Mesmo padrão do app: gastos e cartão ligados; parcelados e fixos opcionais.
  const [types, setTypes] = useState<Record<CategorizedItemType, boolean>>({
    expense: true,
    card: true,
    installment: false,
    fixed: false,
  });

  const byCycle = base !== FREE_PERIOD;
  const filtered = useMemo(() => {
    if (!doc) return [];
    if (byCycle) {
      return filterCategorizedItemsByType(selectCycleCategorizedItems(doc, base), {
        category: category || null,
        types,
      });
    }

    return filterCategorizedItems(selectCategorizedItems(doc), {
      start: from ? parseISO(from) : null,
      end: to ? parseISO(to) : null,
      category: category || null,
      types,
    });
  }, [doc, byCycle, base, from, to, category, types]);
  const totals = useMemo(() => summarizeByCategory(filtered), [filtered]);
  const total = sumCategorizedItems(filtered);
  const ticks = moneyTicks(totals[0]?.total ?? 0);
  const categories = getSortedCategories(doc ? selectConfig(doc) : null);
  const invalidPeriod = !byCycle && Boolean(from && to && from > to);
  const historyLink = `/historico?${new URLSearchParams({
    ...(byCycle ? { ciclo: base } : { de: from, ate: to }),
    ...(category ? { categoria: category } : {}),
  }).toString()}`;

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        {byCycle
          ? 'Base Ciclo: o que pesou no ciclo do salário — gastos, fixas à vista e as parcelas das faturas que vencem nele.'
          : 'Período livre: pela data; a compra no cartão entra pelo valor total, na data da compra.'}
      </p>

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Field label="Base">
            {(props) => (
              <NativeSelect
                value={base}
                onChange={(event) => setBase(event.target.value)}
                {...props}
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    Ciclo {formatCycleLabel(cycle.startDate, cycle.endDate)}
                    {cycle.active ? ' (atual)' : ''}
                  </option>
                ))}
                <option value={FREE_PERIOD}>Período livre</option>
              </NativeSelect>
            )}
          </Field>
          {byCycle ? null : (
            <>
              <DateMaskField label="De" value={from} onChange={setFrom} />
              <DateMaskField label="Até" value={to} onChange={setTo} />
            </>
          )}
          <Field label="Categoria">
            {(props) => (
              <NativeSelect
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                {...props}
              >
                <option value="">Todas</option>
                {categories.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Incluir</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {TYPE_ORDER.map((type) => (
                <label key={type} className="inline-flex items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--primary)]"
                    checked={types[type]}
                    onChange={() => setTypes((current) => ({ ...current, [type]: !current[type] }))}
                  />
                  {TYPE_FILTER_LABELS[type]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Card>

      {invalidPeriod ? (
        <EmptyState title="Período inválido" message="A data inicial deve ser antes da final." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Sem dados no período"
          message="Ajuste o período, a categoria ou os tipos incluídos."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardTitle>
              Total no período: <Money value={total} />
            </CardTitle>
            <figure className="mt-4">
              <div style={{ height: Math.max(160, totals.length * 44 + 40) }} aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={totals}
                    layout="vertical"
                    margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      ticks={ticks}
                      domain={[0, ticks[ticks.length - 1] ?? 0]}
                      tickFormatter={formatAxisReais}
                      stroke="var(--muted)"
                      fontSize={12}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={110}
                      stroke="var(--muted)"
                      fontSize={12}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), 'Total']}
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--ink)',
                      }}
                      cursor={{ fill: 'var(--surface-muted)' }}
                    />
                    <Bar
                      dataKey="total"
                      fill="var(--primary)"
                      radius={[0, 3, 3, 0]}
                      maxBarSize={36}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <figcaption className="sr-only">
                Gráfico de barras dos totais por categoria; a tabela ao lado traz os mesmos valores.
              </figcaption>
            </figure>
          </Card>

          <Card className="xl:col-span-2">
            <CardTitle>Por categoria</CardTitle>
            <div className="mt-3">
              <Table>
                <caption className="sr-only">Totais por categoria no período</caption>
                <thead>
                  <tr>
                    <Th>Categoria</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">%</Th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map((row) => (
                    <tr key={row.category}>
                      <Td>{row.category}</Td>
                      <MoneyTd>{formatCurrency(row.total)}</MoneyTd>
                      <Td className="tabular text-right text-muted">
                        {total > 0 ? Math.round((row.total * 100) / total) : 0}%
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-3 xl:col-span-5">
            <p className="text-sm text-muted">
              {filtered.length} lançamento(s) nesta análise. A lista completa, com edição, fica no
              Histórico.
            </p>
            <Link to={historyLink} className="text-sm text-primary underline">
              Ver lançamentos no Histórico
            </Link>
          </Card>
        </div>
      )}
    </>
  );
}

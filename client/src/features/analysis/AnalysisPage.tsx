import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  CATEGORIZED_ITEM_LABELS,
  CategorizedItemType,
  filterCategorizedItems,
  selectCategorizedItems,
  sumCategorizedItems,
  summarizeByCategory,
} from '@manager-money/core/application/category-analysis';
import { selectActiveCycle, selectConfig } from '@manager-money/core/application/selectors';
import { getSortedCategories } from '@manager-money/core/domain/financial/financial.calculations';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatDateLabel, toISODate } from '@manager-money/core/utils/date';
import { parseISO } from 'date-fns';

import { Money } from '@/components/Money';
import { formatAxisReais, moneyTicks } from '@/lib/chart';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input, NativeSelect } from '@/components/ui/input';
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

/** Gastos por categoria e período: mesma função do app (RF-09), em tela grande. */
export function AnalysisPage() {
  const doc = useDataStore((state) => state.doc);
  const active = doc ? selectActiveCycle(doc) : null;
  const today = toISODate(new Date());
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

  const items = useMemo(() => (doc ? selectCategorizedItems(doc) : []), [doc]);
  const filtered = useMemo(
    () =>
      filterCategorizedItems(items, {
        start: from ? parseISO(from) : null,
        end: to ? parseISO(to) : null,
        category: category || null,
        types,
      }),
    [items, from, to, category, types],
  );
  const totals = useMemo(() => summarizeByCategory(filtered), [filtered]);
  const total = sumCategorizedItems(filtered);
  const ticks = moneyTicks(totals[0]?.total ?? 0);
  const categories = getSortedCategories(doc ? selectConfig(doc) : null);
  const invalidPeriod = Boolean(from && to && from > to);

  return (
    <>
      <PageHeader
        title="Análise"
        description="Para onde foi o dinheiro, por categoria, no período escolhido."
      />

      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field
            label="De"
            error={invalidPeriod ? 'A data inicial deve ser antes da final.' : undefined}
          >
            {(props) => (
              <Input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                {...props}
              />
            )}
          </Field>
          <Field label="Até">
            {(props) => (
              <Input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                {...props}
              />
            )}
          </Field>
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

      {filtered.length === 0 ? (
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

          <Card className="xl:col-span-5">
            <CardTitle>Lançamentos ({filtered.length})</CardTitle>
            <div className="mt-3">
              <Table>
                <thead>
                  <tr>
                    <Th>Data</Th>
                    <Th>Tipo</Th>
                    <Th>Descrição</Th>
                    <Th>Categoria</Th>
                    <Th className="text-right">Valor</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...filtered]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((item) => (
                      <tr key={`${item.type}-${item.id}`}>
                        <Td className="whitespace-nowrap">{formatDateLabel(item.date)}</Td>
                        <Td>{CATEGORIZED_ITEM_LABELS[item.type]}</Td>
                        <Td>{item.name || '—'}</Td>
                        <Td>{item.category}</Td>
                        <MoneyTd>{formatCurrency(item.amount)}</MoneyTd>
                      </tr>
                    ))}
                </tbody>
              </Table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

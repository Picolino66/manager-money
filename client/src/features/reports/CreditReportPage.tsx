import { useMemo, useState } from 'react';
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

import { formatMonthKey, STATEMENT_STATUS_LABEL } from '@manager-money/core/application/card-text';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { formatShortDate } from '@manager-money/core/utils/date';

import { Money } from '@/components/Money';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { MoneyTd, Table, Td, Th } from '@/components/ui/table';
import { formatAxisReais, moneyTicks } from '@/lib/chart';
import { buildCreditReport } from '@/lib/credit-report';
import { STATEMENT_STATUS_TONE } from '@/lib/statement';
import { useDataStore } from '@/store/data.store';

const LABELS: Record<string, string> = {
  amount: 'Valor da fatura',
  charges: 'Juros e multas',
  paid: 'Pago',
};

function Total({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-xl font-semibold text-ink">
        <Money value={value} />
      </p>
    </Card>
  );
}

/**
 * Aba Crédito dos Relatórios (BR-FIN-039): as faturas pelo ciclo do cartão — abertura, fechamento,
 * vencimento e o ciclo do salário em que cada uma pesa. Inclui as futuras (parcelas já
 * comprometidas). Os lançamentos de cada fatura ficam no Histórico.
 */
export function CreditReportPage() {
  const doc = useDataStore((state) => state.doc);
  const [now] = useState(() => new Date());
  const [cardId, setCardId] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const view = useMemo(
    () => (doc ? buildCreditReport(doc, now, { cardId, year }) : null),
    [doc, now, cardId, year],
  );

  if (!view) return null;

  if (view.cards.length === 0) {
    return (
      <EmptyState
        title="Nenhum cartão"
        message="Cadastre um cartão em Cartões para acompanhar as faturas aqui."
      />
    );
  }

  const ticks = moneyTicks(
    Math.max(0, ...view.months.map((month) => Math.max(month.amount + month.charges, month.paid))),
  );

  return (
    <>
      <p className="mb-4 text-sm text-muted">
        Cada fatura vai da abertura ao fechamento do cartão e pesa no ciclo do salário em que vence.
      </p>

      <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
        <Field label="Cartão">
          {(props) => (
            <NativeSelect
              value={cardId ?? ''}
              onChange={(event) => setCardId(event.target.value || null)}
              {...props}
            >
              <option value="">Todos</option>
              {view.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </Field>
        <Field label="Ano">
          {(props) => (
            <NativeSelect
              value={year ?? ''}
              onChange={(event) => setYear(event.target.value || null)}
              {...props}
            >
              <option value="">Todos</option>
              {view.years.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </NativeSelect>
          )}
        </Field>
      </div>

      {view.statements.length === 0 ? (
        <EmptyState title="Nenhuma fatura" message="Nenhuma fatura com parcelas para os filtros." />
      ) : (
        <>
          <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Total label="Total das faturas" value={view.totals.amount} />
            <Total label="Juros e multas" value={view.totals.charges} />
            <Total label="Pago" value={view.totals.paid} />
            <Total label="Em aberto" value={view.totals.remaining} />
          </div>

          <Card className="mb-4">
            <CardTitle>Faturas por mês de fechamento</CardTitle>
            <figure className="mt-4">
              <div className="h-64" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={view.months.map((month) => ({
                      ...month,
                      label: formatMonthKey(month.key),
                    }))}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--muted)" fontSize={12} tickLine={false} />
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
                        LABELS[String(name)],
                      ]}
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--ink)',
                      }}
                    />
                    <Bar dataKey="amount" name="amount" stackId="fatura" fill="var(--primary)" />
                    <Bar
                      dataKey="charges"
                      name="charges"
                      stackId="fatura"
                      fill="var(--critical)"
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      dataKey="paid"
                      name="paid"
                      stroke="var(--ink)"
                      strokeWidth={2}
                      type="monotone"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <figcaption className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-primary" />
                  Valor da fatura
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-critical" />
                  Juros e multas
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-3 bg-ink" />
                  Pago
                </span>
                <span className="sr-only">A tabela abaixo traz os mesmos valores por fatura.</span>
              </figcaption>
            </figure>
          </Card>

          <Table>
            <caption className="sr-only">Faturas, {view.statements.length} no total</caption>
            <thead>
              <tr>
                <Th>Fatura</Th>
                <Th>Cartão</Th>
                <Th>Período</Th>
                <Th>Vence</Th>
                <Th>Pesa no ciclo</Th>
                <Th className="text-right">Valor</Th>
                <Th className="text-right">Pago</Th>
                <Th>Situação</Th>
                <Th>
                  <span className="sr-only">Lançamentos</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {view.statements.map((statement) => (
                <tr key={`${statement.cardId}:${statement.key}`} className="hover:bg-surface-muted">
                  <Td className="font-medium text-ink">{formatMonthKey(statement.key)}</Td>
                  <Td>{statement.cardName}</Td>
                  <Td className="whitespace-nowrap">
                    {formatShortDate(statement.openDate)} a {formatShortDate(statement.closingDate)}
                  </Td>
                  <Td>{formatShortDate(statement.dueDate)}</Td>
                  <Td className="whitespace-nowrap">{statement.cycleLabel}</Td>
                  <MoneyTd>
                    <Money value={statement.amount + statement.charges} />
                  </MoneyTd>
                  <MoneyTd>
                    <Money value={statement.paid} />
                  </MoneyTd>
                  <Td>
                    <Badge tone={STATEMENT_STATUS_TONE[statement.status]}>
                      {STATEMENT_STATUS_LABEL[statement.status]}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <Link
                      to={`/historico?cartao=${statement.cardId}&fatura=${statement.key}`}
                      className="text-sm text-primary underline"
                      aria-label={`Lançamentos da fatura ${formatMonthKey(statement.key)} de ${statement.cardName}`}
                    >
                      Lançamentos
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

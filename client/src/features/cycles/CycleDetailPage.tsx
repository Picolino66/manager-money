import { useMemo } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { formatCycleLabel, formatShortDate } from '@manager-money/core/utils/date';

import { DailyChart } from '@/components/DailyChart';
import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/states';
import { BALANCE_SERIES } from '@/lib/chart';
import { buildCycleDetail } from '@/lib/cycles';
import { useDataStore } from '@/store/data.store';

function Metric({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm text-muted">{label}</p>
      <p className="text-xl font-semibold text-ink">
        <Money value={value} signed={signed} />
      </p>
    </Card>
  );
}

/**
 * Detalhe do ciclo: resultado, saldo dia a dia, fixas, rendas e faturas que venceram nele. Os
 * lançamentos ficam no Histórico (link com o ciclo já filtrado, ADR-024).
 */
export function CycleDetailPage() {
  const { id = '' } = useParams();
  const doc = useDataStore((state) => state.doc);
  const detail = useMemo(() => (doc ? buildCycleDetail(doc, id, new Date()) : null), [doc, id]);

  const back = (
    <Link
      to="/relatorios/ciclos"
      className="mb-3 inline-flex items-center gap-1 text-sm text-primary"
    >
      <ChevronLeft aria-hidden className="h-4 w-4" /> Ciclos
    </Link>
  );

  if (!detail) {
    return (
      <>
        {back}
        <EmptyState
          title="Ciclo não encontrado"
          message="Ele pode ter sido removido em outro aparelho."
        />
      </>
    );
  }

  const { month, daily, spending } = detail;
  const closed = month.status === 'closed';

  return (
    <>
      {back}
      <PageHeader
        title={`Ciclo ${formatCycleLabel(month.startDate, month.endDate)}`}
        description={closed ? 'Ciclo fechado · somente leitura' : 'Ciclo ativo'}
        actions={<Badge tone={closed ? 'neutral' : 'info'}>{closed ? 'Fechado' : 'Ativo'}</Badge>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Saldo inicial" value={month.initialAvailableAmount} />
        <Metric label="Gasto no saldo" value={detail.totalSpent} />
        <Metric label="Dívida herdada" value={month.previousMonthDebt} />
        {closed ? (
          <Metric label="Resultado" value={month.finalBalance ?? 0} signed />
        ) : (
          <Metric label="Total do ciclo (com fixas e faturas)" value={spending.total} />
        )}
      </div>

      <div className="mt-4">
        <DailyChart
          title="Saldo no ciclo"
          description="O que saiu do saldo dia a dia, o limite previsto e o disponível ao fim de cada dia."
          controls={
            <Link
              to={`/historico?ciclo=${month.id}`}
              className="inline-flex items-center gap-1 text-sm text-primary underline"
            >
              Ver lançamentos deste ciclo no Histórico
            </Link>
          }
          data={daily}
          series={BALANCE_SERIES}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardTitle>Fixas pagas</CardTitle>
          {detail.fixedPayments.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {detail.fixedPayments.map((payment) => (
                <li key={payment.id} className="flex justify-between gap-3">
                  <span className="truncate">
                    {payment.name}{' '}
                    <span className="text-xs text-muted">· {formatShortDate(payment.paidAt)}</span>
                  </span>
                  <Money value={payment.amount + payment.interest} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Rendas avulsas</CardTitle>
          {detail.extraIncomes.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {detail.extraIncomes.map((income) => (
                <li key={income.id} className="flex justify-between gap-3">
                  <span className="truncate">{income.name}</span>
                  <Money value={income.amount} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardTitle>Faturas do ciclo</CardTitle>
          {spending.statements.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Nenhuma.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-1 text-sm">
              {spending.statements.map((statement) => (
                <li
                  key={`${statement.cardId}:${statement.statementKey}`}
                  className="flex justify-between gap-3"
                >
                  <Link
                    to={`/historico?cartao=${statement.cardId}&fatura=${statement.statementKey}`}
                    className="truncate text-primary underline"
                  >
                    {statement.cardName}{' '}
                    <span className="text-xs text-muted">
                      · vence {formatShortDate(statement.dueDate)}
                    </span>
                  </Link>
                  <Money value={statement.total} />
                </li>
              ))}
              {spending.statementCharges > 0 ? (
                <li className="flex justify-between gap-3 text-muted">
                  <span>Juros e multas</span>
                  <Money value={spending.statementCharges} />
                </li>
              ) : null}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

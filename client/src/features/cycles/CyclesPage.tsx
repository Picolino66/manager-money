import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import { selectActiveCycle } from '@manager-money/core/application/selectors';
import { formatCycleLabel } from '@manager-money/core/utils/date';

import { Money } from '@/components/Money';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/states';
import { MoneyTd, Table, Td, Th } from '@/components/ui/table';
import { buildClosedCycles } from '@/lib/cycles';
import { useDataStore } from '@/store/data.store';

/** Ciclos fechados com o resultado de cada um (somente leitura). */
export function CyclesPage() {
  const doc = useDataStore((state) => state.doc);
  const closed = useMemo(() => (doc ? buildClosedCycles(doc) : []), [doc]);
  const years = useMemo(() => [...new Set(closed.map((cycle) => cycle.year))], [closed]);
  const [year, setYear] = useState('');
  const visible = year ? closed.filter((cycle) => cycle.year === year) : closed;
  const active = doc ? selectActiveCycle(doc) : null;

  return (
    <>
      <PageHeader title="Ciclos" description="Resultado de cada ciclo fechado e detalhe por dia." />

      {active ? (
        <Card className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Ciclo atual</p>
            <p className="font-medium text-ink">
              {formatCycleLabel(active.startDate, active.endDate)}
            </p>
          </div>
          <Link
            to={`/ciclos/${active.id}`}
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
          <Table>
            <caption className="sr-only">Ciclos fechados</caption>
            <thead>
              <tr>
                <Th>Ciclo</Th>
                <Th className="text-right">Saldo inicial</Th>
                <Th className="text-right">Gasto</Th>
                <Th className="text-right">Gastos</Th>
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
                  <Td className="tabular text-right">{cycle.expenseCount}</Td>
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
                      to={`/ciclos/${cycle.id}`}
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

import { useMemo, useState } from 'react';

import { selectActiveCreditCards } from '@manager-money/core/application/selectors';
import { LocalState } from '@manager-money/core/application/state';
import { formatCycleLabel } from '@manager-money/core/utils/date';

import { DailyChart } from '@/components/DailyChart';
import { Field } from '@/components/ui/field';
import { DateMaskField } from '@/components/ui/date-mask-input';
import { NativeSelect } from '@/components/ui/input';
import { BALANCE_SERIES, CREDIT_SERIES } from '@/lib/chart';
import {
  buildBalanceChart,
  buildCreditChart,
  CreditChartMode,
  describeStatement,
  listCycleOptions,
} from '@/lib/overview';

const CUSTOM = 'custom';
const INVALID_PERIOD = 'Informe um período válido (De antes de Até, no máximo 400 dias).';

/** Saldo pelo ciclo do salário: atalho por ciclo ou De/Até livre (BR-FIN-039). */
export function BalanceChartCard({
  doc,
  cycleId,
  now,
}: {
  doc: LocalState;
  cycleId: string;
  now: Date;
}) {
  const cycles = useMemo(() => listCycleOptions(doc), [doc]);
  const initial = cycles.find((cycle) => cycle.id === cycleId);
  const [preset, setPreset] = useState(cycleId);
  const [from, setFrom] = useState(initial?.startDate ?? '');
  const [to, setTo] = useState(initial?.endDate ?? '');
  const data = useMemo(() => buildBalanceChart(doc, from, to, now), [doc, from, to, now]);
  const selected = cycles.find((cycle) => cycle.id === preset);

  function choose(value: string) {
    setPreset(value);
    const cycle = cycles.find((item) => item.id === value);

    if (cycle) {
      setFrom(cycle.startDate);
      setTo(cycle.endDate);
    }
  }

  return (
    <DailyChart
      title="Saldo no ciclo"
      description={
        selected
          ? `Ciclo do salário ${formatCycleLabel(selected.startDate, selected.endDate)}: o que saiu do saldo dia a dia. Fixas pagas já estavam reservadas: não mudam o disponível.`
          : 'Período livre: cada dia usa o ciclo do salário que o contém. Fixas pagas já estavam reservadas: não mudam o disponível.'
      }
      controls={
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Período">
            {(props) => (
              <NativeSelect
                value={preset}
                onChange={(event) => choose(event.target.value)}
                {...props}
              >
                {cycles.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    Ciclo {formatCycleLabel(cycle.startDate, cycle.endDate)}
                    {cycle.active ? ' (atual)' : ''}
                  </option>
                ))}
                <option value={CUSTOM}>Personalizado</option>
              </NativeSelect>
            )}
          </Field>
          <DateMaskField
            label="De"
            value={from}
            onChange={(value) => {
              setPreset(CUSTOM);
              setFrom(value);
            }}
          />
          <DateMaskField
            label="Até"
            value={to}
            onChange={(value) => {
              setPreset(CUSTOM);
              setTo(value);
            }}
          />
        </div>
      }
      data={data}
      series={BALANCE_SERIES}
      empty={INVALID_PERIOD}
    />
  );
}

const CREDIT_MODES: { value: CreditChartMode; label: string }[] = [
  { value: 'due-in-cycle', label: 'Vence neste ciclo' },
  { value: 'open', label: 'Aberta (compras de hoje)' },
  { value: 'custom', label: 'Personalizado' },
];

/**
 * Crédito pelo ciclo do cartão (BR-FIN-039): por padrão as faturas que vencem no ciclo ativo (o
 * mesmo conjunto do card "Gasto no crédito"); o último dia bate com o total delas.
 */
export function CreditChartCard({ doc, now }: { doc: LocalState; now: Date }) {
  const cards = useMemo(() => selectActiveCreditCards(doc), [doc]);
  const [mode, setMode] = useState<CreditChartMode>('due-in-cycle');
  const [cardId, setCardId] = useState<string | null>(null);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const chart = useMemo(
    () => buildCreditChart(doc, { mode, cardId, ...custom }, now),
    [doc, mode, cardId, custom, now],
  );

  function editDate(field: 'from' | 'to', value: string) {
    setCustom({ from: chart.from, to: chart.to, [field]: value });
    setMode('custom');
  }

  const description =
    mode === 'custom'
      ? 'Período livre: em cada dia, a fatura que recebe as compras daquele dia.'
      : chart.period
        ? chart.period.statements
            .map((statement) => describeStatement(statement, cards.length > 1 && !cardId))
            .join(' · ')
        : undefined;
  const empty =
    cards.length === 0
      ? 'Nenhum cartão ativo.'
      : mode === 'due-in-cycle' && !chart.period
        ? 'Nenhuma fatura vence neste ciclo.'
        : INVALID_PERIOD;

  return (
    <DailyChart
      title="Crédito no ciclo do cartão"
      description={description}
      controls={
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Fatura">
            {(props) => (
              <NativeSelect
                value={mode}
                onChange={(event) => {
                  const next = event.target.value as CreditChartMode;

                  if (next === 'custom') setCustom({ from: chart.from, to: chart.to });
                  setMode(next);
                }}
                {...props}
              >
                {CREDIT_MODES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {cards.length > 1 ? (
            <Field label="Cartão">
              {(props) => (
                <NativeSelect
                  value={cardId ?? ''}
                  onChange={(event) => setCardId(event.target.value || null)}
                  {...props}
                >
                  <option value="">Todos</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ) : null}
          <DateMaskField
            label="De"
            value={chart.from}
            onChange={(value) => editDate('from', value)}
          />
          <DateMaskField label="Até" value={chart.to} onChange={(value) => editDate('to', value)} />
        </div>
      }
      data={chart.points}
      series={CREDIT_SERIES}
      empty={empty}
    />
  );
}

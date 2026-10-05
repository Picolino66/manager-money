import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';

const reaisFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** Rótulo de eixo em reais inteiros (os valores do gráfico continuam em centavos). */
export function formatAxisReais(value: MoneyCents): string {
  return reaisFormatter.format(Math.round(value / 100));
}

/**
 * Marcas de eixo "redondas" em reais inteiros (1, 2 ou 5 × 10^n) cobrindo de 0 até `max` centavos,
 * para o eixo não mostrar valores quebrados como R$ 7,50 → "R$ 7".
 */
export function moneyTicks(max: MoneyCents, count = 4): MoneyCents[] {
  const maxReais = Math.max(1, Math.ceil(max / 100));
  const rough = maxReais / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough)!;
  const stepReais = Math.max(1, step);
  const ticks: MoneyCents[] = [];

  for (let value = 0; value < maxReais + stepReais; value += stepReais) {
    ticks.push(value * 100);
    if (value >= maxReais) break;
  }

  return ticks;
}

/**
 * Marcas de eixo em reais inteiros entre `min` e `max` centavos (aceita negativos, como o disponível
 * do ciclo estourado). Sem negativos, é o mesmo que `moneyTicks`.
 */
export function moneyTicksBetween(min: MoneyCents, max: MoneyCents, count = 4): MoneyCents[] {
  if (min >= 0) return moneyTicks(max, count);

  const lowReais = Math.floor(min / 100);
  const highReais = Math.max(0, Math.ceil(max / 100));
  const rough = Math.max(1, (highReais - lowReais) / count);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough)!,
  );
  const ticks: MoneyCents[] = [];

  for (let value = Math.floor(lowReais / step) * step; ; value += step) {
    ticks.push(value * 100);
    if (value >= highReais) break;
  }

  return ticks;
}

/** Série de um gráfico diário (barras ou linhas, valores em centavos). */
export type ChartSeries = {
  key: string;
  label: string;
  kind: 'bar' | 'line';
  color: string;
  /** Linha em degrau (limite previsto). */
  step?: boolean;
  /** Barras com a mesma pilha ficam empilhadas (gasto do saldo + fixas pagas). */
  stack?: string;
};

/** Saldo pelo ciclo do salário (BR-FIN-039). */
export const BALANCE_SERIES: ChartSeries[] = [
  { key: 'spent', label: 'Gasto do saldo', kind: 'bar', color: 'var(--primary)', stack: 'saldo' },
  // BR-FIN-041: fixas pagas pelo saldo (já reservadas: não mudam o limite nem o disponível).
  { key: 'fixedPaid', label: 'Fixas pagas', kind: 'bar', color: 'var(--info)', stack: 'saldo' },
  { key: 'limit', label: 'Limite previsto', kind: 'line', color: 'var(--warning)', step: true },
  { key: 'available', label: 'Disponível no ciclo', kind: 'line', color: 'var(--ink)' },
];

/** Crédito pelo ciclo do cartão (BR-FIN-039): compras do dia, fatura acumulada e limite. */
export const CREDIT_SERIES: ChartSeries[] = [
  { key: 'creditSpent', label: 'Compras do dia', kind: 'bar', color: 'var(--primary)' },
  { key: 'statementTotal', label: 'Fatura acumulada', kind: 'line', color: 'var(--ink)' },
  {
    key: 'creditAvailable',
    label: 'Disponível de crédito',
    kind: 'line',
    color: 'var(--warning)',
  },
];

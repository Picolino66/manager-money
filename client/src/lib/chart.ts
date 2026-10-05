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

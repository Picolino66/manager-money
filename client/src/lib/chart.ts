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

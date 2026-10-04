import { MoneyCents } from '../domain/financial/financial.types';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatCurrency(value: MoneyCents): string {
  return currencyFormatter.format(value / 100);
}

export function parseCurrencyInputToCents(value: string): MoneyCents {
  const digits = value.replace(/\D/g, '');

  if (!digits) {
    return 0;
  }

  return Number.parseInt(digits, 10);
}

export function formatCurrencyInput(value: MoneyCents): string {
  if (!Number.isFinite(value) || value === 0) {
    return '';
  }

  return formatCurrency(value);
}

export function formatSignedCurrency(value: MoneyCents): string {
  if (value > 0) {
    return `+${formatCurrency(value)}`;
  }

  return formatCurrency(value);
}

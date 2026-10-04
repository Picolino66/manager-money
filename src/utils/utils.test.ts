import {
  formatCurrency,
  formatCurrencyInput,
  formatSignedCurrency,
  parseCurrencyInputToCents,
} from './currency';
import {
  formatCycleLabel,
  formatDateInput,
  formatMonthLabel,
  formatShortDate,
  getTodayMonthYear,
  parseBRDateInput,
  toISODate,
} from './date';

const normalize = (value: string) => value.replace(/\s/g, ' ');

describe('moeda (BR-FIN-001: centavos)', () => {
  it('formata e interpreta', () => {
    expect(normalize(formatCurrency(123456))).toBe('R$ 1.234,56');
    expect(parseCurrencyInputToCents('R$ 1.234,56')).toBe(123456);
    expect(parseCurrencyInputToCents('abc')).toBe(0);
    expect(formatCurrencyInput(0)).toBe('');
    expect(formatCurrencyInput(Number.NaN)).toBe('');
    expect(normalize(formatCurrencyInput(500))).toBe('R$ 5,00');
    expect(normalize(formatSignedCurrency(500))).toBe('+R$ 5,00');
    expect(normalize(formatSignedCurrency(-500))).toBe('-R$ 5,00');
  });
});

describe('datas', () => {
  it('formatos pt-BR', () => {
    expect(toISODate(new Date(2026, 9, 1))).toBe('2026-10-01');
    expect(formatDateInput('2026-10-01')).toBe('01/10/2026');
    expect(formatShortDate('2026-10-01')).toBe('01/10');
    expect(formatCycleLabel('2026-10-07', '2026-11-06')).toBe('07/10 a 06/11');
    expect(formatMonthLabel(2026, 10)).toBe('Outubro/2026');
    expect(getTodayMonthYear(new Date(2026, 9, 1))).toEqual({ month: 10, year: 2026 });
  });

  it('valida data digitada', () => {
    expect(parseBRDateInput('31/02/2026')).toBeNull();
    expect(parseBRDateInput('2026-10-01')).toBeNull();
    expect(parseBRDateInput(' 01/10/2026 ')?.getDate()).toBe(1);
  });
});

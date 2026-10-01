import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDateLabel(date: string): string {
  return format(parseISO(date), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatDateInput(date: string): string {
  return formatDateLabel(date);
}

export function parseBRDateInput(date: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (
    parsedDate.getFullYear() !== Number(year) ||
    parsedDate.getMonth() !== Number(month) - 1 ||
    parsedDate.getDate() !== Number(day)
  ) {
    return null;
  }

  return parsedDate;
}

export function formatMonthLabel(year: number, month: number): string {
  const date = new Date(year, month - 1, 1);
  const label = format(date, 'MMMM/yyyy', { locale: ptBR });

  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatShortDate(date: string): string {
  return format(parseISO(date), 'dd/MM', { locale: ptBR });
}

export function formatCycleLabel(startDate: string, endDate: string): string {
  return `${format(parseISO(startDate), 'dd/MM', { locale: ptBR })} a ${format(parseISO(endDate), 'dd/MM', { locale: ptBR })}`;
}

export function getTodayMonthYear(date: Date = new Date()) {
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

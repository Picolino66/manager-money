import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrency, formatSignedCurrency } from '@manager-money/core/utils/currency';

import { cn } from '@/lib/cn';

/** Valor em centavos formatado em R$ pelo núcleo; negativo em destaque (texto + cor). */
export function Money({
  value,
  signed = false,
  className,
}: {
  value: MoneyCents;
  signed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('tabular', value < 0 && 'text-negative', className)}>
      {signed ? formatSignedCurrency(value) : formatCurrency(value)}
    </span>
  );
}

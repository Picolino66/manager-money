import { InputHTMLAttributes } from 'react';

import { MoneyCents } from '@manager-money/core/domain/financial/financial.types';
import { formatCurrencyInput, parseCurrencyInputToCents } from '@manager-money/core/utils/currency';

import { Input } from './input';

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: MoneyCents;
  onValueChange: (value: MoneyCents) => void;
};

/**
 * Valor em centavos inteiros (BR-FIN-001), com a mesma máscara do app: os dígitos digitados são
 * centavos (`1234` → R$ 12,34). Nunca usa ponto flutuante.
 */
export function MoneyInput({ value, onValueChange, ...props }: MoneyInputProps) {
  return (
    <Input
      inputMode="numeric"
      autoComplete="off"
      placeholder="R$ 0,00"
      value={formatCurrencyInput(value)}
      onChange={(event) => onValueChange(parseCurrencyInputToCents(event.target.value))}
      {...props}
    />
  );
}

import { useState } from 'react';

import {
  formatDateInput,
  maskDateInput,
  parseBRDateInput,
  toISODate,
} from '@manager-money/core/utils/date';

import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type Props = {
  label: string;
  /** Data em `yyyy-MM-dd`; vazio = sem data. */
  value: string;
  /** Recebe `yyyy-MM-dd` só quando a data está completa e é real; vazio caso contrário. */
  onChange: (value: string) => void;
  className?: string;
};

const FORMAT_ERROR = 'Use DD/MM/AAAA.';

function toIso(text: string): string | null {
  const date = parseBRDateInput(text);

  return date ? toISODate(date) : null;
}

/**
 * Data digitada com máscara DD/MM/AAAA (independe do idioma do navegador). Por fora fala em ISO;
 * data incompleta ou inexistente não filtra e mostra o aviso ao sair do campo (ou ao completar
 * os 10 caracteres).
 */
export function DateMaskField({ label, value, onChange, className }: Props) {
  const [text, setText] = useState(value ? formatDateInput(value) : '');
  const [touched, setTouched] = useState(false);

  // Valor trocado de fora (ex.: "Limpar filtros") reescreve o campo, sem efeito colateral.
  const [previous, setPrevious] = useState(value);

  if (value !== previous) {
    setPrevious(value);

    if ((toIso(text) ?? '') !== value) {
      setText(value ? formatDateInput(value) : '');
      setTouched(false);
    }
  }

  const iso = toIso(text);
  const invalid = text !== '' && iso === null && (touched || text.length === 10);

  function handleChange(raw: string) {
    const masked = maskDateInput(raw);

    setText(masked);
    onChange(toIso(masked) ?? '');
  }

  return (
    <Field label={label} error={invalid ? FORMAT_ERROR : undefined} className={className}>
      {(props) => (
        <Input
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          placeholder="DD/MM/AAAA"
          value={text}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setTouched(true)}
          {...props}
        />
      )}
    </Field>
  );
}

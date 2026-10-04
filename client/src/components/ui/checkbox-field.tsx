import { forwardRef, InputHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  hint?: string;
};

/** Caixa de marcação nativa com rótulo (ativar/desativar cadastros). */
export const CheckboxField = forwardRef<HTMLInputElement, Props>(function CheckboxField(
  { label, hint, className, ...props },
  ref,
) {
  return (
    <label className={cn('flex items-start gap-2 text-sm text-ink', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        {...props}
      />
      <span>
        {label}
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </label>
  );
});

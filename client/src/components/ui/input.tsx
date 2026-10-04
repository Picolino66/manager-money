import { forwardRef, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

const base =
  'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-ink placeholder:text-muted disabled:opacity-60 aria-[invalid=true]:border-critical';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, className)} {...props} />;
  },
);

/** Select nativo: acessível por teclado e leitor de tela sem dependências extras. */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NativeSelect({ className, ...props }, ref) {
    return <select ref={ref} className={cn(base, 'pr-8', className)} {...props} />;
  },
);

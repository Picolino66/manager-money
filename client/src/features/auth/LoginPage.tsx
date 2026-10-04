import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSessionStore } from '@/store/session.store';

type Mode = 'entrar' | 'criar';

const MIN_PASSWORD = 8;

const schema = z
  .object({
    mode: z.enum(['entrar', 'criar']),
    email: z.string().trim().email('Informe um e-mail válido.'),
    password: z
      .string()
      .min(MIN_PASSWORD, `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`),
    confirm: z.string(),
  })
  .refine((values) => values.mode === 'entrar' || values.password === values.confirm, {
    path: ['confirm'],
    message: 'As senhas não conferem.',
  });

type LoginForm = z.infer<typeof schema>;

/** Entrar ou criar conta com e-mail e senha (ADR-011; sem modo local no web). */
export function LoginPage() {
  const status = useSessionStore((state) => state.status);
  const notice = useSessionStore((state) => state.notice);
  const signIn = useSessionStore((state) => state.signIn);
  const signUp = useSessionStore((state) => state.signUp);
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { mode: 'entrar', email: '', password: '', confirm: '' },
  });
  const mode = watch('mode');
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  if (status === 'signed-in') return <Navigate to={from} replace />;

  async function onSubmit(values: LoginForm) {
    setError(null);
    try {
      if (values.mode === 'entrar') await signIn(values.email, values.password);
      else await signUp(values.email, values.password);
      navigate(from, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Não foi possível entrar agora.');
    }
  }

  function switchMode(next: Mode) {
    setValue('mode', next);
    setError(null);
  }

  return (
    <main className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-on-primary"
          >
            M
          </span>
          <h1 className="text-lg font-semibold text-ink">Manager Money</h1>
        </div>

        {notice ? (
          <p role="status" className="mb-4 rounded-md bg-warning-soft px-3 py-2 text-sm text-ink">
            {notice}
          </p>
        ) : null}

        <div
          role="tablist"
          aria-label="Acesso"
          className="mb-5 grid grid-cols-2 rounded-md bg-surface-muted p-1"
        >
          {(
            [
              ['entrar', 'Entrar'],
              ['criar', 'Criar conta'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => switchMode(value)}
              className={
                mode === value
                  ? 'rounded bg-surface px-3 py-1.5 text-sm font-medium text-ink shadow-sm'
                  : 'rounded px-3 py-1.5 text-sm text-muted'
              }
            >
              {label}
            </button>
          ))}
        </div>

        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Field label="E-mail" error={errors.email?.message}>
            {(props) => (
              <Input type="email" autoComplete="email" {...props} {...register('email')} />
            )}
          </Field>
          <Field
            label="Senha"
            error={errors.password?.message}
            hint={mode === 'criar' ? `Mínimo de ${MIN_PASSWORD} caracteres.` : undefined}
          >
            {(props) => (
              <Input
                type="password"
                autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
                {...props}
                {...register('password')}
              />
            )}
          </Field>
          {mode === 'criar' ? (
            <Field label="Confirme a senha" error={errors.confirm?.message}>
              {(props) => (
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...props}
                  {...register('confirm')}
                />
              )}
            </Field>
          ) : null}

          {error ? (
            <p role="alert" className="rounded-md bg-critical-soft px-3 py-2 text-sm text-ink">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Aguarde…' : mode === 'entrar' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          Ao continuar você concorda com a{' '}
          <Link to="/privacidade" className="text-primary underline">
            política de privacidade
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

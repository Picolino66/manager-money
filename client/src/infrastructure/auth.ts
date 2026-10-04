import type { AuthError, Session, SupabaseClient } from '@supabase/supabase-js';

import { logger } from './monitoring/logger';

/** Resultado mínimo de autenticação: nunca expõe token nem e-mail para fora da infraestrutura. */
export type AuthUser = { userId: string };

export type AuthChange = { event: 'signed-in' | 'signed-out' | 'refreshed'; user: AuthUser | null };

export type AuthErrorCode =
  | 'invalid-credentials'
  | 'already-registered'
  | 'weak-password'
  | 'confirmation-required'
  | 'rate-limited'
  | 'network'
  | 'unknown';

export class AuthFailure extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthFailure';
  }
}

export interface AuthGateway {
  currentUser(): Promise<AuthUser | null>;
  onChange(listener: (change: AuthChange) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Tenta renovar a sessão (JWT expirado). `false` = sessão perdida. */
  refresh(): Promise<boolean>;
}

export function mapAuthError(error: Pick<AuthError, 'message' | 'status'> & { code?: string }) {
  const code = error.code ?? '';
  const message = error.message.toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return new AuthFailure('invalid-credentials');
  }
  if (code === 'user_already_exists' || message.includes('already registered')) {
    return new AuthFailure('already-registered');
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return new AuthFailure('weak-password');
  }
  if (code === 'email_not_confirmed') return new AuthFailure('confirmation-required');
  if (error.status === 429 || code.includes('rate_limit')) return new AuthFailure('rate-limited');
  if (/network|fetch|timeout/i.test(message)) return new AuthFailure('network');

  return new AuthFailure('unknown');
}

function toUser(session: Session | null): AuthUser | null {
  return session?.user ? { userId: session.user.id } : null;
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async currentUser(): Promise<AuthUser | null> {
    const { data } = await this.client.auth.getSession();
    return toUser(data.session);
  }

  onChange(listener: (change: AuthChange) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') listener({ event: 'signed-out', user: null });
      else if (event === 'TOKEN_REFRESHED') listener({ event: 'refreshed', user: toUser(session) });
      else if (event === 'SIGNED_IN') listener({ event: 'signed-in', user: toUser(session) });
    });

    return () => data.subscription.unsubscribe();
  }

  private async attempt(
    name: 'auth.login' | 'auth.signup',
    call: () => Promise<{ data: { session: Session | null }; error: AuthError | null }>,
  ): Promise<AuthUser> {
    let result: Awaited<ReturnType<typeof call>>;

    try {
      result = await call();
    } catch {
      logger.event(name, { ok: false, code: 'network' });
      throw new AuthFailure('network');
    }

    if (result.error) {
      const failure = mapAuthError(result.error);
      logger.event(name, { ok: false, code: failure.code });
      throw failure;
    }

    const user = toUser(result.data.session);
    if (!user) {
      // Projeto com confirmação de e-mail ligada: não há sessão até confirmar (ADR-011 prevê desligada).
      logger.event(name, { ok: false, code: 'confirmation-required' });
      throw new AuthFailure('confirmation-required');
    }

    logger.event(name, { ok: true });
    return user;
  }

  signIn(email: string, password: string): Promise<AuthUser> {
    return this.attempt('auth.login', () =>
      this.client.auth.signInWithPassword({ email, password }),
    );
  }

  signUp(email: string, password: string): Promise<AuthUser> {
    return this.attempt('auth.signup', () => this.client.auth.signUp({ email, password }));
  }

  async signOut(): Promise<void> {
    // `local`: encerra esta sessão do navegador mesmo sem rede; não derruba o app mobile.
    await this.client.auth.signOut({ scope: 'local' });
    logger.event('auth.logout', { ok: true });
  }

  async refresh(): Promise<boolean> {
    try {
      const { data, error } = await this.client.auth.refreshSession();
      return !error && Boolean(data.session);
    } catch {
      return false;
    }
  }
}

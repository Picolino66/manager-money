/**
 * Observabilidade sem dados financeiros (SPEC-008 / BR-ACC-006).
 * Apenas campos da lista permitida chegam ao reporter; qualquer outro é descartado.
 */
const ALLOWED_FIELDS = ['ok', 'durationMs', 'code', 'count', 'table'] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

export type EventFields = Partial<Record<AllowedField, string | number | boolean>>;

export type EventName =
  | 'app.load'
  | 'storage.load'
  | 'storage.migrate'
  | 'storage.write'
  | 'sync.run'
  | 'sync.conflict'
  | 'auth.login'
  | 'auth.logout'
  | 'account.delete'
  | 'account.export';

export interface CrashReporter {
  captureEvent(name: EventName, fields: EventFields): void;
  captureException(error: unknown, fields?: EventFields): void;
}

/** Implementação padrão: console em desenvolvimento, silenciosa em testes e produção. */
const consoleReporter: CrashReporter = {
  captureEvent(name, fields) {
    if (__DEV__ && process.env.NODE_ENV !== 'test') {
      console.log(`[event] ${name}`, fields);
    }
  },
  captureException(error, fields) {
    if (__DEV__ && process.env.NODE_ENV !== 'test') {
      console.warn('[error]', error instanceof Error ? error.name : 'unknown', fields);
    }
  },
};

let reporter: CrashReporter = consoleReporter;

export function sanitizeFields(fields: Record<string, unknown> = {}): EventFields {
  const safe: EventFields = {};

  for (const key of ALLOWED_FIELDS) {
    const value = fields[key];

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      safe[key] = value;
    }
  }

  return safe;
}

export const logger = {
  /** Substitui o reporter (ex.: Sentry, T-013). */
  setReporter(next: CrashReporter) {
    reporter = next;
  },

  event(name: EventName, fields?: Record<string, unknown>) {
    reporter.captureEvent(name, sanitizeFields(fields));
  },

  error(error: unknown, fields?: Record<string, unknown>) {
    reporter.captureException(error, sanitizeFields(fields));
  },
};

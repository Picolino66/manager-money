/**
 * Observabilidade sem dados pessoais nem financeiros (BR-ACC-006, mesma lista permitida do app).
 * Nunca recebe token, e-mail, descrição ou valor: campos fora da lista são descartados.
 */
const ALLOWED_FIELDS = ['ok', 'durationMs', 'code', 'count', 'table'] as const;

type AllowedField = (typeof ALLOWED_FIELDS)[number];

export type EventFields = Partial<Record<AllowedField, string | number | boolean>>;

export type EventName =
  | 'web.load'
  | 'web.save'
  | 'web.conflict'
  | 'auth.login'
  | 'auth.signup'
  | 'auth.logout'
  | 'auth.expired';

export type LogSink = (kind: 'event' | 'error', name: string, fields: EventFields) => void;

const consoleSink: LogSink = (kind, name, fields) => {
  if (!import.meta.env.DEV || import.meta.env.MODE === 'test') return;
  console.info(`[${kind}] ${name}`, fields);
};

let sink: LogSink = consoleSink;

export function setLogSink(next: LogSink) {
  sink = next;
}

function sanitize(fields: Record<string, unknown>): EventFields {
  const clean: EventFields = {};

  for (const key of ALLOWED_FIELDS) {
    const value = fields[key];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      clean[key] = value;
    }
  }

  return clean;
}

export const logger = {
  event(name: EventName, fields: Record<string, unknown> = {}) {
    sink('event', name, sanitize(fields));
  },
  /** Só o tipo do erro é registrado; a mensagem pode conter dados e é descartada. */
  error(error: unknown, fields: Record<string, unknown> = {}) {
    sink('error', error instanceof Error ? error.name : 'unknown', sanitize(fields));
  },
};

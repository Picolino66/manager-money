# ADR-007 — Observabilidade com Sentry e métricas no servidor

- **Status:** ACCEPTED · **Fase:** F2 · **Data:** 2026-10-01

## Contexto

App mobile sem servidor próprio. As métricas M1–M6 e o RNF-06 (crash-free ≥ 99,5%) precisam ser
medidos sem enviar dados financeiros a terceiros (BR-ACC-006).

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Firebase Crashlytics + Analytics | Grátis | SDK pesado; envia dados ao Google; exige config nativa extra |
| **Sentry (crash + release health)** + métricas por SQL no Supabase | Crash-free nativo; `beforeSend` para higienização; métricas de produto sem SDK extra | Usuários só locais não entram em M1–M4 |
| Analytics de produto (PostHog/Amplitude) | Funis ricos | Mais um processador de dados (LGPD); excessivo na v1.0 |

## Decisão

- **Sentry** (`@sentry/react-native`), ativo só com `EXPO_PUBLIC_SENTRY_DSN` definido e em builds
  que não são de desenvolvimento. Release health mede M5.
- **Métricas de produto** (M1–M4, M6) são calculadas por SQL sobre as tabelas do Supabase
  (`docs/operations/metrics.sql`), cobrindo usuários com conta. **Limitação declarada:** usuários
  apenas locais ficam fora dessas métricas.
- **Logs:** `src/infrastructure/monitoring/logger.ts` com eventos estruturados
  (`{ event, ok, durationMs }`), sem payload financeiro.

## Consequências

- Os SLOs de F7 se apoiam em release health (Sentry) e em consultas SQL (Supabase).

## Relações

M1–M6, RNF-06, ADR-006

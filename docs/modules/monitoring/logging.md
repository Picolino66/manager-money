---
id: monitoring.logging
type: feature
module: monitoring
title: Logger estruturado e porta CrashReporter
summary: >
  Eventos nomeados com campos permitidos (ok, durationMs, code, count, table); qualquer outro campo
  é descartado antes do reporter.
keywords: [log, evento, sentry, crash, métrica]
code:
  - src/infrastructure/monitoring/logger.ts
symbols: [sanitizeFields, logger]
business_rules: [BR-ACC-006]
adrs: [ADR-007]
tests: [src/infrastructure/monitoring/logger.test.ts]
last_verified_commit: F7-VERIFIED
---

# Logger

Spec: [SPEC-008](../../../specs/SPEC-008-observabilidade.md). Reporter padrão: console em dev,
silencioso em produção. Sentry entra via `logger.setReporter` (T-013, bloqueada por conta).

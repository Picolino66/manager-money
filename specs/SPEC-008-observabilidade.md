---
spec: SPEC-008
features: [monitoring.logging]
---
# SPEC-008 — Observabilidade sem dados financeiros

## Objetivo
Medir a estabilidade (M5) e o sync (M6) sem violar BR-ACC-006.

## Docs relacionados
[ADR-007](../adr/ADR-007-observabilidade.md)

## Requisitos relacionados
RNF-06 · M5, M6 · BR-ACC-006

## Regras
- `logger.event(name, { ok, durationMs, code })`: só aceita campos da lista permitida (`ok`, `durationMs`, `code`, `count`, `table`). Qualquer outro campo é descartado.
- `captureException(error)` passa por uma porta `CrashReporter`. A implementação padrão é no-op/console. O Sentry entra quando a conta existir (task T-013, bloqueada).
- Eventos mínimos: `app.load`, `storage.write`, `sync.run`, `sync.conflict`, `auth.login`, `account.delete`.

## Comportamento
Sem impacto visual.

## Fluxos
Transversal.

## Critérios de aceite
- [ ] Teste garante que campos como `amount`, `description` e `email` nunca chegam ao reporter.

## Tasks derivadas
T-012, T-013

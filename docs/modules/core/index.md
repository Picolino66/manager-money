---
id: core
type: module
module: core
title: Núcleo compartilhado (@manager-money/core)
summary: >
  Pacote TypeScript puro usado pelo app mobile e pelo client web: domínio financeiro, casos de uso,
  seletores, contrato remoto (DTOs, mappers, registros alterados, erros) e utilitários.
code:
  - packages/core/package.json
  - packages/core/eslint.config.mjs
last_verified_commit: 3b9bf25+T-040
---

# Módulo: núcleo compartilhado

| Feature | Doc |
|---|---|
| `core.shared-package` | [shared-package.md](shared-package.md) |

Decisão: [ADR-022](../../../adr/ADR-022-nucleo-compartilhado-packages-core.md). Regras de negócio continuam
documentadas nos módulos de domínio (ciclo, gastos, cartões…), cujos `code:` apontam para `packages/core/src`.

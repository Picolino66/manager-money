---
id: storage.local-document
type: feature
module: storage
title: Documento local versionado
summary: >
  Estado inteiro em uma chave do AsyncStorage, gravado atomicamente, validado por Zod, migrado do
  v1 e protegido contra sobrescrita quando corrompido.
keywords: [asyncstorage, persistência, migração, schema, offline]
code:
  - src/infrastructure/storage/local-store.ts
  - src/infrastructure/storage/migrations.ts
  - src/infrastructure/storage/schema.ts
  - App.tsx
symbols: [migrateV1ToV2, migrateV2ToV3, legacyIncomeSources, normalizeLegacyMonth, parseLocalState, LoadErrorScreen]
adrs: [ADR-003, ADR-013]
tests: [src/infrastructure/storage/local-store.test.ts]
last_verified_commit: a16e575+T-020
---

# Documento local versionado

Spec: [SPEC-004](../../../specs/SPEC-004-documento-local.md) · contrato:
[contracts §4](../../architecture/contracts.md).

- Chave `@manager-money/state`; cada mutação = 1 `setItem` (DEF-002).
- Leitura: JSON + Zod. Falha → tela "Erro ao carregar" com Tentar novamente / Exportar dados brutos;
  nada é sobrescrito (DEF-004).
- Migração v1 (`@daily-budget/*`): normaliza legado, `payday = 7`, tudo `dirty`; chaves v1
  removidas só após gravar a v2.
- Migração v2 → v3 (ADR-013): ao carregar um documento `schemaVersion: 2`, a renda vira a fonte
  "Renda" e `settings` fica `dirty`; o documento v3 é regravado antes de seguir.

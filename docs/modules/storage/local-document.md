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
symbols: [migrateV1ToV2, migrateV2ToV3, migrateV6ToV7, migrateDocument, legacyIncomeSources, normalizeLegacyMonth, parseLocalState, LoadErrorScreen]
adrs: [ADR-003, ADR-013, ADR-014, ADR-015, ADR-016, ADR-017]
tests: [src/infrastructure/storage/local-store.test.ts]
last_verified_commit: c47cf18+T-025r4
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
- `migrateDocument` encadeia v2 → v3 → v4 (cartões) → v5 (pagamentos/rendas avulsas) → v6 (dia por fonte)
  → **v7** e grava uma vez; versão atual: `STATE_SCHEMA_VERSION = 7`.
- Migração v6 → v7 (ADR-017, `migrateV6ToV7`): cartões ganham `creditLimit: null` e `active: true`; compras
  ganham `firstStatementKey` (da data e do fechamento) e `settledInstallments: 0`, sem mudar `firstCycleKey`;
  nasce o cursor `statement_payments`. Cartões, compras e ciclos **não** ficam `dirty`. Faturas já vencidas na
  data da migração ganham um pagamento sintético sem juros (`statementPaymentId`, ciclo ativo ou último), único
  registro `dirty`. A migração **não mexe no saldo**: a store recalcula o saldo do ciclo ativo ao carregar
  (`loadAppData` → `recalculateActiveCycleBalance`, grava se mudou), o que aplica a reserva das fixas (BR-FIN-004).
- Schema Zod v7: `creditLimit` (centavos ≥ 0 ou `null`), `active` no cartão; `active?` em fontes e fixas;
  `firstStatementKey`/`firstCycleKey` `yyyy-MM`; `settledInstallments ≥ 0`; `origin` opcional (`'existing'`); `statementPayments`. Detalhes em
  [contracts §4](../../architecture/contracts.md).

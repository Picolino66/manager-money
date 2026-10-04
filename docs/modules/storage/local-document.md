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
  - app/src/infrastructure/storage/local-store.ts
  - app/src/infrastructure/storage/migrations.ts
  - app/src/infrastructure/storage/schema.ts
  - packages/core/src/contract/mappers.ts
  - app/App.tsx
symbols: [migrateV1ToV2, migrateV2ToV3, migrateV6ToV7, migrateV7ToV8, migrateDocument, legacyIncomeSources, normalizeLegacyMonth, parseLocalState, LoadErrorScreen]
adrs: [ADR-003, ADR-013, ADR-014, ADR-015, ADR-016, ADR-017, ADR-018]
tests: [app/src/infrastructure/storage/local-store.test.ts, app/src/infrastructure/storage/migrations.v8.test.ts]
last_verified_commit: 3b9bf25+T-033
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
  → v7 → **v8** e grava uma vez; versão atual: `STATE_SCHEMA_VERSION = 8`.
- Migração v6 → v7 (ADR-017, `migrateV6ToV7`): cartões ganham `creditLimit: null` e `active: true`; compras
  ganham `firstStatementKey` (da data e do fechamento) e `settledInstallments: 0`, sem mudar `firstCycleKey`;
  nasce o cursor `statement_payments`. Cartões, compras e ciclos **não** ficam `dirty`. Faturas já vencidas na
  data da migração ganham um pagamento sintético sem juros (id `statement-<cardId>-<yyyy-MM>`, ciclo ativo ou último), único
  registro `dirty`. A migração **não mexe no saldo**: a store recalcula o saldo do ciclo ativo ao carregar
  (`loadAppData` → `recalculateActiveCycleBalance`, grava se mudou), o que aplica a reserva das fixas (BR-FIN-004).
- Migração v7 → v8 (ADR-018, `migrateV7ToV8`): cada pagamento de fatura ganha `charges = max(0, paidAmount −
  statementAmount)` (o excedente gravado antes eram os juros; valores ausentes contam como 0); nenhum valor muda, nada fica `dirty`.
- Schema Zod v8 (acrescenta à v7): `charges ≥ 0` no pagamento de fatura; `kind?: 'statement-balance'` e
  `includedInStatementBalance?` na compra; `carriedStatementDebt? ≥ 0` e `carriedStatements?` (`{ cardId,
  statementKey, amount > 0 }[]`) no ciclo.
- Schema Zod v7: `creditLimit` (centavos ≥ 0 ou `null`), `active` no cartão; `active?` em fontes e fixas;
  `firstStatementKey`/`firstCycleKey` `yyyy-MM`; `settledInstallments ≥ 0`; `origin` opcional (`'existing'`); `statementPayments`. Detalhes em
  [contracts §4](../../architecture/contracts.md).

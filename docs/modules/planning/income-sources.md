---
id: planning.income-sources
type: feature
module: planning
title: Múltiplas fontes de renda
summary: >
  A renda mensal é a soma de fontes com nome e valor, cadastradas na Configuração; dados antigos
  viram uma fonte "Renda".
keywords: [renda, fontes de renda, salário, freela, migração]
code:
  - src/screens/ConfigScreen.tsx
  - src/application/cycle.use-cases.ts
  - src/domain/financial/financial.calculations.ts
  - src/infrastructure/storage/migrations.ts
  - src/infrastructure/sync/mappers.ts
symbols: [calculatePrimaryPayday, saveConfig, calculateIncomeTotal, legacyIncomeSources, migrateV2ToV3, migrateV5ToV6, settingsFromRow]
adrs: [ADR-013]
tests: [src/application/cycle.use-cases.test.ts, src/infrastructure/storage/local-store.test.ts, src/infrastructure/sync/mappers.test.ts, src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-018, BR-FIN-024]
last_verified_commit: 6fd4838+T-021
---

# Múltiplas fontes de renda

Spec: [SPEC-012](../../../specs/SPEC-012-fontes-de-renda.md) · decisão: [ADR-013](../../../adr/ADR-013-fontes-de-renda.md).

- `settings.incomeSources` guarda `{ id, name, amount }`; `monthlyIncome` é a soma (derivado em `saveConfig`).
- Formulário: lista com Adicionar/Remover (mínimo uma fonte), nome obrigatório, valor > 0 e **dia do pagamento (1–28)** por fonte; mostra qual dia o ciclo usa.
- Compatibilidade: documento v2 e linha remota sem `income_sources` viram a fonte "Renda".

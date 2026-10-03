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
symbols: [saveConfig, calculateIncomeTotal, legacyIncomeSources, migrateV2ToV3, settingsFromRow]
adrs: [ADR-013]
tests: [src/application/cycle.use-cases.test.ts, src/infrastructure/storage/local-store.test.ts, src/infrastructure/sync/mappers.test.ts, src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-018]
last_verified_commit: a16e575+T-020
---

# Múltiplas fontes de renda

Spec: [SPEC-012](../../../specs/SPEC-012-fontes-de-renda.md) · decisão: [ADR-013](../../../adr/ADR-013-fontes-de-renda.md).

- `settings.incomeSources` guarda `{ id, name, amount }`; `monthlyIncome` é a soma (derivado em `saveConfig`).
- Formulário: lista com Adicionar/Remover (mínimo uma fonte), nome obrigatório e valor > 0.
- Compatibilidade: documento v2 e linha remota sem `income_sources` viram a fonte "Renda".

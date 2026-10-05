---
id: planning.income-sources
type: feature
module: planning
title: Múltiplas fontes de renda
summary: >
  A renda mensal é a soma das fontes ativas (nome, valor, dia de pagamento), cadastradas na
  Configuração; fontes podem ser desativadas; dados antigos viram uma fonte "Renda".
keywords: [renda, fontes de renda, salário, freela, migração, ativa, inativa]
code:
  - app/src/screens/ConfigScreen.tsx
  - packages/core/src/application/cycle.use-cases.ts
  - packages/core/src/domain/financial/financial.calculations.ts
  - packages/core/src/domain/financial/financial.types.ts
  - app/src/infrastructure/storage/migrations.ts
  - packages/core/src/contract/mappers.ts
symbols: [calculatePrimaryPayday, calculatePrimaryIncomeSource, saveConfig, calculateIncomeTotal, isActive, legacyIncomeSources, migrateV2ToV3, migrateV5ToV6, settingsFromRow]
adrs: [ADR-013, ADR-016, ADR-017]
tests: [packages/core/src/application/cycle.use-cases.test.ts, app/src/infrastructure/storage/local-store.test.ts, packages/core/src/contract/mappers.test.ts, app/src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-018, BR-FIN-024]
last_verified_commit: 7903717+T-042
---

# Múltiplas fontes de renda

Spec: [SPEC-012](../../../specs/SPEC-012-fontes-de-renda.md) · decisão: [ADR-013](../../../adr/ADR-013-fontes-de-renda.md).

- `settings.incomeSources` guarda `{ id, name, amount, payday, active? }`; `monthlyIncome` é a soma das
  fontes **ativas** (derivado em `saveConfig`).
- Formulário: lista com Adicionar/Remover, nome obrigatório, valor > 0, **dia do pagamento (1–28)** e chave
  **Ativa** por fonte; mostra qual dia o ciclo usa.
- **Ativa/inativa** ([SPEC-017](../../../specs/SPEC-017-situacao-inicial-e-ativo-inativo.md)): `active` ausente = ativa.
  Inativa não soma à renda, não define o dia do ciclo (`calculatePrimaryIncomeSource`) e fica fora da
  projeção. Salvar exige **ao menos uma fonte ativa** ("Informe ao menos uma fonte de renda ativa.").
  O mapper só grava `active: false` (no jsonb `income_sources`).
- Compatibilidade: documento v2 e linha remota sem `income_sources` viram a fonte "Renda".

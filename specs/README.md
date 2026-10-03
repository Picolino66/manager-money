# Specs

Fonte primária de comportamento das features. Toda task em `tasks/` aponta para uma spec, e toda
spec aponta para os requisitos (RF/RNF/DEF) e as regras (BR) de origem.
O frontmatter `features:` declara os IDs estáveis cobertos; o gerador da knowledge layer
(`npm run docs:index`) usa essa lista para indexar features planejadas.

| Spec | Features | Requisitos |
|---|---|---|
| [SPEC-001](SPEC-001-dia-de-pagamento.md) | planning.payday | RF-12, DEF-009 |
| [SPEC-002](SPEC-002-ciclo-de-vida.md) | cycle.open, cycle.receive-early, cycle.close | RF-03, RF-10, RF-11, DEF-001, DEF-006, DEF-007 |
| [SPEC-003](SPEC-003-exclusao-de-gasto.md) | expense.delete | RF-06, DEF-003 |
| [SPEC-004](SPEC-004-documento-local.md) | storage.local-document | RNF-03, DEF-002, DEF-004 |
| [SPEC-005](SPEC-005-conta.md) | account.auth, account.export, account.delete | RF-13, RF-16, RF-17, RF-18 |
| [SPEC-006](SPEC-006-sync.md) | sync.engine, sync.first-login | RF-14, RF-15 |
| [SPEC-007](SPEC-007-ajustes-e-textos.md) | settings.hub, legal.privacy-policy | RNF-05, RNF-07, RNF-08, DEF-005 |
| [SPEC-008](SPEC-008-observabilidade.md) | monitoring.logging | RNF-06, M5, M6 |
| [SPEC-009](SPEC-009-camada-de-aplicacao.md) | application.use-cases | ADR-001, ADR-008 |
| [SPEC-010](SPEC-010-pipeline-de-qualidade.md) | tooling.quality-pipeline | RNF-09, DEF-008 |
| [SPEC-011](SPEC-011-upgrade-expo-sdk-57.md) | — (técnica) | RNF-09, RNF-10 |
| [SPEC-012](SPEC-012-fontes-de-renda.md) | planning.income-sources | RF-01 |
| [SPEC-013](SPEC-013-cartoes-de-credito.md) | card.manage, card.purchase | RF-19 |
| [SPEC-014](SPEC-014-pagamento-de-fixas-e-renda-avulsa.md) | payment.fixed-expense, payment.extra-income | RF-20, RF-21 |

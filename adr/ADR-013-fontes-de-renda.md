# ADR-013 — Múltiplas fontes de renda e documento local v3

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-03
- **Atualiza:** [ADR-003](ADR-003-persistencia-local.md) (versão do documento) e
  [ADR-008](ADR-008-modelo-de-dados-e-consistencia.md) (modelo de dados)

## Contexto

A renda era um único número (`monthlyIncome`). O usuário precisa cadastrar várias fontes, cada
uma com nome e valor (ex.: salário, freela). O contrato remoto v1, o motor de sync e os cálculos
de domínio já dependem de `monthlyIncome`.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Nova tabela `income_sources` com sync próprio | Granularidade por fonte | Nova tabela, RLS, cursor e ordem de push para poucos registros; conflitos de LWW por linha |
| **Lista dentro de `settings` (`income_sources jsonb`)** | Aditivo; sem nova tabela; uma linha por usuário já é a unidade de LWW | Conflito resolvido por `settings` inteiro (aceitável: já era assim) |
| Só trocar `monthlyIncome` por lista, sem manter o total | Modelo mais limpo | Quebra cálculos, mappers e linhas remotas existentes |

## Decisão

- `settings.incomeSources: { id, name, amount }[]`, persistido em `settings.income_sources` (jsonb,
  até 20 fontes, `default '[]'`).
- `monthlyIncome` continua existindo e é **derivado** (soma das fontes), calculado em `saveConfig`.
  Cálculos, dashboard e a coluna `monthly_income` não mudam.
- Documento local sobe para **`schemaVersion: 3`**; a migração v2 → v3 transforma a renda em uma
  fonte `Renda` e marca `settings` como `dirty`.
- Linhas remotas sem fontes (`[]`) são lidas como uma fonte `Renda` com o `monthly_income`
  (compatibilidade com clientes antigos). O contrato continua `v1` (mudança aditiva).
- Migration nova `20261003000000_income_sources.sql`; a `init` não é editada.

## Trade-offs e consequências

- Cliente antigo que escrever `settings` sem `income_sources` não apaga as fontes no servidor
  (a coluna tem default e o upsert não a envia), mas o próximo cliente novo as reescreve.
- Remover a última fonte é bloqueado no formulário e no caso de uso (BR-FIN-018).

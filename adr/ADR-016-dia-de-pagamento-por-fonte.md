# ADR-016 — Dia de pagamento por fonte de renda

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-03
- **Atualiza:** [ADR-013](ADR-013-fontes-de-renda.md) e [ADR-003](ADR-003-persistencia-local.md) (documento v6).

## Contexto

O dia de pagamento era um campo global que ancora o ciclo (início, fim, recebimento antecipado,
fechamento de fatura). Cada fonte de renda passa a ter o seu dia, mas o ciclo continua único.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Ciclo por fonte | Fiel a cada pagamento | Vários ciclos simultâneos; reescreve o domínio inteiro |
| Dia da primeira fonte da lista | Previsível | Depende da ordem digitada |
| **Dia da fonte de maior valor** | Normalmente é o salário; automático; ciclo único | Trocar valores pode mudar o ciclo (vale só no próximo) |

## Decisão

- `IncomeSource.payday` (1–28). `settings.payday` permanece como valor **derivado** (dia da maior
  fonte; empate: a primeira), calculado em `saveConfig`, como `monthlyIncome`. Ciclo, "Já recebi" e
  cartões não mudam.
- O campo global sai da Configuração; a tela avisa qual dia o ciclo usa.
- Documento local **`schemaVersion: 6`**; a migração v5 → v6 dá a cada fonte o dia global atual (nenhum
  ciclo muda) e deixa `settings` pendente de sync.
- **Sem migration SQL:** `income_sources` já é jsonb e `settings.payday` continua gravado. Linhas sem dia
  na fonte herdam `settings.payday` na leitura.

## Consequências

- Cliente antigo ignora o dia por fonte, mas continua lendo `settings.payday` coerente.
- O ciclo ativo não muda ao editar fontes; vale a partir do próximo (SPEC-001).

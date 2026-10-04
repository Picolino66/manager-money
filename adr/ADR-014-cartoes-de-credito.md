# ADR-014 — Cartões de crédito e compras parceladas

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-03
- **Atualiza:** [ADR-003](ADR-003-persistencia-local.md) (documento v4), [ADR-004](ADR-004-sincronizacao.md) (novas tabelas)
  e [ADR-008](ADR-008-modelo-de-dados-e-consistencia.md) (modelo de dados). Relaciona [ADR-013](ADR-013-fontes-de-renda.md).
- **Substituída em parte por:** [ADR-017](ADR-017-faturas-limite-e-situacao-inicial.md) — a fatura passa a pesar no
  ciclo do **vencimento** (não mais do fechamento) e a compra grava também `first_statement_key`.

## Contexto

O usuário quer registrar compras no crédito, parceladas, com cartões que têm fechamento e
vencimento. As parcelas caem em ciclos futuros, que ainda não existem como registros.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Materializar um `Expense` por parcela em cada ciclo futuro | Reaproveita lista e cálculo diário | Ciclos futuros não existem; exige hook na abertura de ciclo; parcela vira gasto do dia 1 e distorce o limite diário |
| **Compra no cartão + parcelas derivadas, abatidas do saldo inicial do ciclo** | Sem registros por parcela; consistente entre aparelhos; compromisso do ciclo como a fatura | Compra não aparece na lista de gastos do dia |
| Só valor mensal fixo "fatura" digitado | Simples | Sem parcelas, sem fechamento, sem rastreio |

## Decisão

- Duas tabelas novas com o padrão existente (RLS, exclusão lógica, `server_updated_at`):
  `credit_cards` (nome, `closing_day`, `due_day`) e `card_purchases` (`total_amount` com juros,
  `installments`, `purchase_date`, `first_cycle_key`).
- `first_cycle_key` (`yyyy-MM` do início do ciclo) é gravado na compra: mudar o fechamento do
  cartão não reescreve compras antigas. A parcela *n* cai no ciclo `first_cycle_key + (n−1)` meses.
- O saldo inicial do ciclo passa a subtrair as parcelas do ciclo (`calculateInitialAvailableAmount`
  recebe `cardCharges`), recalculado em `createCycle`, `saveConfig` e ao registrar/excluir compra.
- O vencimento é informativo; o ciclo vem do fechamento (BR-FIN-019).
- Documento local sobe para **`schemaVersion: 4`** (`creditCards`, `cardPurchases`, cursores
  `credit_cards` e `card_purchases`); `SYNC_TABLES` ganha as duas tabelas (cartões antes das compras).
- Migration nova `20261003000100_credit_cards.sql`. Contrato remoto segue `v1` (aditivo).

## Trade-offs e consequências

- Chave de ciclo por mês de início é frágil só no ciclo antecipado (janela entre o início
  antecipado e o dia de pagamento): um fechamento nessa janela pode deslocar 1 ciclo.
- Ciclos pulados (app sem uso por um mês) não recebem a parcela daquele mês.
- Histórico imutável: excluir compra com parcela em ciclo fechado é bloqueado.

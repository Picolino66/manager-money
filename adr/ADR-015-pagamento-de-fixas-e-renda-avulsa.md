# ADR-015 — Pagamento de despesas fixas e renda avulsa

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-03
- **Atualiza:** [ADR-003](ADR-003-persistencia-local.md) (documento v5), [ADR-004](ADR-004-sincronizacao.md) (novas tabelas) e
  [ADR-008](ADR-008-modelo-de-dados-e-consistencia.md). Depende de [ADR-014](ADR-014-cartoes-de-credito.md).
- **Substituída em parte por:** [ADR-017](ADR-017-faturas-limite-e-situacao-inicial.md) — despesas fixas ativas
  pendentes passam a ficar **reservadas** no saldo do ciclo (BR-FIN-004).

## Contexto

O app passa de limite diário a aplicativo financeiro: o usuário confirma, a cada ciclo, o pagamento das
despesas fixas (Pix, dinheiro, débito ou crédito) e lança rendas avulsas. Hoje as fixas são descontadas do
saldo na abertura do ciclo, sem noção de "paga".

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Manter o desconto na abertura e só marcar "pago" | Sem mudar o saldo | Contradiz o pedido: desconta só ao pagar; sem juros nem cartão |
| **Registro de pagamento por ciclo (`fixed_payments`) que ajusta o saldo inicial do ciclo** | Reaproveita o mecanismo de ajustes (ADR-014); histórico por ciclo; sync simples | Fixa pendente não reserva saldo: o limite diário fica mais alto até pagar |
| Pagar vira um `Expense` do dia | Reaproveita a lista de gastos | Distorce o limite diário do dia e perde a ligação com a fixa |

## Decisão

- Tabelas novas `fixed_payments` (um pagamento vigente por fixa e ciclo, com foto do nome/categoria,
  `method`, `amount`, `interest`, `paid_at`, `card_purchase_id`) e `extra_incomes`; RLS, exclusão
  lógica e carimbo de servidor como as demais. `SYNC_TABLES` ganha as duas, depois de `card_purchases`.
- `initialAvailableAmount` = renda + rendas avulsas − fixas pagas à vista − meta − dívida − parcelas de
  cartão. Recalculado por `recalculateActiveCycleBalance` (pagar, desfazer, renda avulsa, compra no
  cartão, salvar configuração) e em `createCycle`.
- Pagamento no crédito cria uma `CardPurchase` com `valor + juros`; o desconto vem das parcelas
  (BR-FIN-019). Desfazer remove pagamento e compra.
- Pagamentos e rendas avulsas **pertencem ao ciclo em que foram lançados**; o recebimento antecipado
  não os move. Ciclos fechados são imutáveis.
- Documento local sobe para **`schemaVersion: 5`**. A migração v4 → v5 devolve ao saldo do ciclo ativo o
  total de fixas que a v4 já havia descontado, para não contar duas vezes ao pagar.
- Migration `20261003000200_fixed_payments_and_incomes.sql`; contrato remoto segue `v1`.

## Trade-offs e consequências

- Fixa pendente não reserva saldo (escolha do dono do produto): o limite diário do início do ciclo fica
  alto e cai a cada pagamento. A tela mostra "Pagas" e "Pendentes" para deixar isso visível.
- A migração aumenta o saldo do ciclo ativo existente no total das fixas; elas voltam a descontar
  conforme o usuário confirma cada pagamento.
- `fixed_expense_id` e `card_purchase_id` são referências lógicas (sem FK) para não impor ordem
  extra de sync; a integridade é garantida pelos casos de uso.

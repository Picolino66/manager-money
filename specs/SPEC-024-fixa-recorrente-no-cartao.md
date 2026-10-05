---
spec: SPEC-024
features: [payment.fixed-expense, planning.configure, cycle.open, cycle.dashboard]
---
# SPEC-024 — Despesa fixa recorrente no cartão de crédito

## Objetivo
Permitir marcar uma despesa fixa permanente como **recorrente no cartão de crédito** (e escolher o cartão), de
modo que o sistema lance a compra no cartão sozinho ao abrir cada ciclo, sem o usuário precisar pagar a fixa
manualmente todo mês. Vale no app e no web (configuração); o lançamento é uma regra do núcleo.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) (BR-FIN-004/021/022/035) ·
[fixed-expense](../docs/modules/payment/fixed-expense.md) · [configure](../docs/modules/planning/configure.md) ·
[ADR-023](../adr/ADR-023-fixa-recorrente-no-cartao.md) · [ADR-015](../adr/ADR-015-pagamento-de-fixas-e-renda-avulsa.md) ·
[ADR-017](../adr/ADR-017-faturas-limite-e-situacao-inicial.md) · [contracts](../docs/architecture/contracts.md)

## Requisitos relacionados
RF-01, RF-20, RF-26 · BR-FIN-004, BR-FIN-019, BR-FIN-021, BR-FIN-022, BR-FIN-025, BR-FIN-035 · INV-01..10.

## Regras
- A despesa fixa **permanente** ganha `recurringCardId` (opcional; ausente = como hoje). Parcelamentos fora do
  cartão não têm o campo.
- `saveConfig` exige que o cartão exista e esteja **ativo** ao marcar a recorrência; cartão que fica inativo ou
  é excluído depois mantém a marca, e o lançamento passa a falhar com aviso (abaixo).
- **Ao abrir o ciclo** (`openCycle`), para cada fixa permanente **ativa**, com valor > 0, com `recurringCardId`:
  cria a compra no cartão (1 parcela, **sem juros**, `valor` da fixa, data = **início do ciclo**) e o pagamento da
  fixa no crédito ligado a ela (`cardPurchaseId`), exatamente como `payFixedExpense` no crédito (BR-FIN-022). A fixa
  sai da reserva e pesa pela fatura que vence (BR-FIN-004/025). O limite do cartão é comprometido pelo valor total
  (INV-02), sem bloquear se estourar.
- **Ids determinísticos** — compra `auto-buy-<yyyy-MM do início do ciclo>-<id da fixa>` e pagamento
  `auto-pay-<yyyy-MM>-<id da fixa>` — para que dois aparelhos que abram o mesmo ciclo offline não dupliquem
  (BR-FIN-021: no máximo um pagamento vigente por fixa por ciclo).
- **Falha não bloqueia:** cartão inativo/excluído, fatura da data já paga ou qualquer recusa do núcleo deixa a fixa
  **pendente e reservada** (como hoje) e a tela Hoje mostra o motivo.
- Valor ou cartão alterado no meio do ciclo vale a partir do **próximo** ciclo. Ligar a recorrência com o ciclo
  ativo **não** lança retroativamente: o "Pagar" da fixa já abre com crédito e esse cartão escolhidos.
- **Desfazer** o pagamento automático (`undoFixedPayment`) remove também a compra; a fixa volta a ficar pendente e
  reservada e **não** é lançada de novo naquele ciclo.
- **Projeção (BR-FIN-031):** a fixa recorrente deixa de entrar como "fixa" nos próximos ciclos e entra como
  cobrança de cartão no ciclo em que vence a fatura da compra virtual daquele ciclo (data = início do ciclo, mesmas
  regras de fechamento e vencimento).
- Contrato aditivo: `fixed_expenses.recurring_card_id` (texto, nulável, **sem chave estrangeira**: `fixed_expenses`
  sincroniza antes de `credit_cards`). Aparelho com versão antiga ignora o campo e não lança.

## Critérios de aceite
- Abrir ciclo com fixas recorrentes produz o mesmo saldo, fatura e limite que pagar cada uma no crédito (1x, sem
  juros) manualmente; INV-01..10 continuam valendo.
- Cada caso de falha mantém a fixa pendente com aviso; dois aparelhos abrindo o mesmo ciclo não duplicam.
- App e web configuram a recorrência; web lê as pagas automáticas no histórico.
- `verify` de core, app e client verdes; `npm run test:db` (RLS) verde; `docs:check` limpo.

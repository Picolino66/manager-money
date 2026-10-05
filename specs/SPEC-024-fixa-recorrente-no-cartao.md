---
spec: SPEC-024
features: [payment.fixed-expense, planning.configure, cycle.open, cycle.dashboard]
---
# SPEC-024 — Despesa fixa recorrente no cartão de crédito

## Objetivo
Permitir marcar uma despesa fixa permanente como **recorrente no cartão de crédito** (e escolher o cartão), de
modo que o sistema cobre a fixa no cartão sozinho **toda vez que a fatura do cartão vira**, sem o usuário precisar pagar a
fixa manualmente todo mês. Vale no app e no web (configuração); o lançamento é uma regra do núcleo.

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
- **A cada virada de fatura** (o dia seguinte ao fechamento da fatura anterior), para cada fixa permanente **ativa**, com
  valor > 0, com `recurringCardId`: cria a compra no cartão (1 parcela, **sem juros**, `valor` da fixa, data = o dia da
  virada) e o pagamento da fixa no crédito ligado a ela (`cardPurchaseId`), exatamente como `payFixedExpense` no crédito
  (BR-FIN-022). A compra cai na fatura que acabou de abrir; a fixa sai da reserva do ciclo e pesa pela fatura que vence
  (BR-FIN-004/025). O limite do cartão é comprometido pelo valor total (INV-02), sem bloquear se estourar.
- **Quando confere (sem agendador):** o app confere ao carregar, ao voltar ao primeiro plano, depois de sincronizar e ao abrir
  o ciclo (`launchRecurringCharges`). Só lança viradas que **já passaram** e caem **dentro do ciclo ativo**; nunca refaz ciclos
  fechados. O web não grava ao ler: vê o resultado depois da sincronização.
- **Uma cobrança por fixa por ciclo:** fixa já paga no ciclo (à mão ou por uma virada anterior) não é cobrada de novo; se o
  ciclo não tem virada, a fixa fica reservada até a virada; com duas viradas no mesmo ciclo só a primeira vira pagamento.
- **Ids determinísticos por fatura** — compra `auto-buy-<yyyy-MM da fatura>-<id da fixa>` e pagamento
  `auto-pay-<yyyy-MM da fatura>-<id da fixa>` — para que conferir de novo, ou em dois aparelhos, não duplique.
- **Falha não bloqueia:** cartão inativo/excluído, fatura da data já paga ou qualquer recusa do núcleo deixa a fixa
  **pendente e reservada** (como hoje) e a tela Hoje mostra o motivo (inclusive "será lançada na virada da fatura, em dd/MM" antes da virada).
- Valor ou cartão alterado vale a partir da **próxima virada**. Ligar a recorrência no meio do ciclo cobra na próxima
  virada que cair no ciclo; para antecipar, o "Pagar" da fixa continua disponível.
- **Desfazer** o pagamento automático (`undoFixedPayment`) remove também a compra; a fixa volta a ficar pendente e
  reservada e **não** é cobrada de novo naquela virada nem no mesmo ciclo.
- **Projeção (BR-FIN-031):** a fixa recorrente deixa de entrar como "fixa" nos próximos ciclos e entra como
  cobrança de cartão no ciclo em que vence a fatura de cada compra virtual (uma por virada de fatura que cai no ciclo,
  mesmas regras de fechamento e vencimento).
- Contrato aditivo: `fixed_expenses.recurring_card_id` (texto, nulável, **sem chave estrangeira**: `fixed_expenses`
  sincroniza antes de `credit_cards`). Aparelho com versão antiga ignora o campo e não lança.

## Critérios de aceite
- A cobrança na virada produz o mesmo saldo, fatura e limite que pagar a fixa no crédito (1x, sem juros) manualmente; INV-01..10 continuam valendo.
- Cada caso de falha mantém a fixa pendente com aviso; dois aparelhos conferindo a mesma virada não duplicam.
- App e web configuram a recorrência; web lê as pagas automáticas no histórico.
- `verify` de core, app e client verdes; `npm run test:db` (RLS) verde; `docs:check` limpo.

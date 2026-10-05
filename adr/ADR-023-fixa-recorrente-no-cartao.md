# ADR-023 — Despesa fixa recorrente no cartão: lançamento automático ao abrir o ciclo

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-04
- **Depende de:** [ADR-015](ADR-015-pagamento-de-fixas-e-renda-avulsa.md), [ADR-017](ADR-017-faturas-limite-e-situacao-inicial.md),
  [ADR-018](ADR-018-pagamento-parcial-e-total-da-fatura.md), [ADR-004](ADR-004-sincronizacao.md).
- **Spec:** [SPEC-024](../specs/SPEC-024-fixa-recorrente-no-cartao.md) · task [T-042](../tasks/done/T-042.md).

## Contexto
Hoje toda despesa fixa fica pendente e reservada no saldo até o usuário pagá-la, escolhendo À vista ou Cartão
(BR-FIN-021/022). Quem tem uma fixa que sempre cai no cartão (assinatura, internet) repete o mesmo pagamento todo
ciclo. O usuário pediu marcar a fixa como recorrente no cartão e escolher qual.

## Opções consideradas
| Opção | Prós | Contras |
|---|---|---|
| **A. Só um padrão no "Pagar"** (cartão pré-selecionado) | Sem mudar regra financeira | O usuário ainda paga toda vez; a fixa segue reservada |
| **B. Lançar a compra sozinho ao abrir o ciclo (escolhida)** | A conta fica certa sem ação; a fatura pesa no ciclo certo | Muda quando a fixa sai da reserva; exige tratar falhas, sync e projeção |
| C. Lançar por um dia do mês configurável | Data mais fiel à cobrança real | Campo extra e projeção bem mais complexa |

## Decisão
- **B**, com data de cobrança = **início do ciclo**. O campo é `recurringCardId` na fixa **permanente**.
- O lançamento é uma composição das primitivas existentes (`buildCardPurchase` + pagamento ligado, como
  `payFixedExpense` no crédito, 1x, sem juros), então saldo, fatura e limite seguem as regras vigentes
  (BR-FIN-004/022/025, INV-01..10).
- **Ids determinísticos** (`auto-buy-…`/`auto-pay-…`) tornam a abertura idempotente entre aparelhos: o LWW do sync
  junta, sem duplicar.
- **Falha = pendente:** nenhuma falha de lançamento impede abrir o ciclo; a fixa fica reservada e a tela avisa.
- **Projeção:** compra virtual por ciclo futuro, para a fixa recorrente pesar na fatura e não duplicar como fixa.
- **Banco:** coluna nulável `fixed_expenses.recurring_card_id`, sem FK (ordem de sync: `fixed_expenses` antes de
  `credit_cards`); validação no núcleo.

## Consequências
- `openCycle` passa a chamar o lançamento (dependência circular de módulos resolvida por funções chamadas em tempo
  de execução, sem uso na carga do módulo).
- Aparelhos com versão antiga não lançam; os ids determinísticos evitam duplicar quando os dois lançam.
- BR-FIN-004/021/022 ganham a menção ao automático; nova regra BR-FIN-035.

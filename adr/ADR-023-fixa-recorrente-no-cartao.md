# ADR-023 — Despesa fixa recorrente no cartão: cobrança automática a cada virada de fatura

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
| **B. Cobrar sozinho a cada virada de fatura do cartão (escolhida)** | Uma cobrança por fatura, como a assinatura real; a conta fica certa sem ação | Muda quando a fixa sai da reserva; exige tratar falhas, sync, projeção e conferir quando o app abre |
| C. Lançar por um dia do mês configurável | Data mais fiel à cobrança real | Campo extra e projeção bem mais complexa |
| B0. Lançar ao abrir o ciclo de orçamento (primeira versão, substituída) | Simples | Não acompanha a fatura do cartão: o usuário esperava a cobrança na virada da fatura |

## Decisão
- **B**, com a cobrança **a cada virada de fatura** do cartão: a fatura vira no **dia seguinte ao fechamento** e a compra é datada nesse dia, caindo na fatura que acabou de abrir. O campo é `recurringCardId` na fixa **permanente**.
- O lançamento é uma composição das primitivas existentes (`buildCardPurchase` + pagamento ligado, como
  `payFixedExpense` no crédito, 1x, sem juros), então saldo, fatura e limite seguem as regras vigentes
  (BR-FIN-004/022/025, INV-01..10).
- **Ids determinísticos por fatura** (`auto-buy-<fatura>-<fixa>`/`auto-pay-<fatura>-<fixa>`) tornam a cobrança idempotente
  entre aparelhos e entre conferências: o LWW do sync junta, sem duplicar.
- **Quando confere:** não há agendador; o **app** confere ao carregar, ao voltar ao primeiro plano, depois de sincronizar e ao
  abrir o ciclo, lançando só as viradas que caem **dentro do ciclo ativo** e já passaram (nada retroativo em ciclos fechados).
  O web não grava ao ler: só mostra o resultado depois da sincronização.
- **Falha = pendente:** nenhuma falha de lançamento impede nada; a fixa fica reservada e a tela avisa (inclusive "será lançada na virada em dd/MM").
- **Uma cobrança por fixa por ciclo:** a fixa já paga no ciclo (à mão ou por uma virada) não é cobrada de novo; ciclo sem virada mantém a fixa reservada.
- **Projeção:** uma compra virtual por virada de fatura em cada ciclo futuro, para a fixa recorrente pesar na fatura e não duplicar como fixa.
- **Banco:** coluna nulável `fixed_expenses.recurring_card_id`, sem FK (ordem de sync: `fixed_expenses` antes de
  `credit_cards`); validação no núcleo.

## Consequências
- `openCycle` e o store do app chamam `launchRecurringCharges` (dependência circular de módulos resolvida por funções
  chamadas em tempo de execução, sem uso na carga do módulo).
- Aparelhos com versão antiga não lançam; os ids determinísticos evitam duplicar quando os dois lançam.
- BR-FIN-004/021/022 ganham a menção ao automático; nova regra BR-FIN-035.

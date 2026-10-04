---
spec: SPEC-019
features: [card.statement, card.existing-debt, card.manage, cycle.close, cycle.dashboard]
---
# SPEC-019 — Pagamento parcial e total da fatura, encargos e invariantes

## Objetivo
Permitir **pagamento parcial** da fatura (o restante vira dívida do próximo ciclo), **encargos** (juros/multa)
lançados no pagamento ou depois, e o **total informado da fatura** na situação inicial, sem contar nada duas
vezes. Liberar o limite só pelo que foi amortizado. Registrar as invariantes do domínio e cobri-las com testes.
Atualiza a [SPEC-016](SPEC-016-faturas-e-limite-do-cartao.md) ("um pagamento vigente por fatura", "valor pago ≥
fatura") e a [SPEC-017](SPEC-017-situacao-inicial-e-ativo-inativo.md) (situação inicial).

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [statement](../docs/modules/card/statement.md) ·
[existing-debt](../docs/modules/card/existing-debt.md) · [manage](../docs/modules/card/manage.md) ·
[close](../docs/modules/cycle/close.md) · [dashboard](../docs/modules/cycle/dashboard.md) ·
[contracts](../docs/architecture/contracts.md) · [ADR-018](../adr/ADR-018-pagamento-parcial-e-total-da-fatura.md)

## Requisitos relacionados
RF-24, RF-25, RF-29, RF-30, RF-31 · BR-FIN-005, BR-FIN-026, BR-FIN-027, BR-FIN-029, BR-FIN-030, BR-FIN-032,
BR-FIN-033, BR-FIN-034

## Regras
- **Lançamentos (BR-FIN-033):** uma fatura tem vários lançamentos (`paidAmount`, `charges`). `payStatement` só
  depois do fechamento: sem valor quita o restante (só até o vencimento; depois o valor é obrigatório); valor <
  restante = **parcial**; valor > restante = a diferença vira **encargos**. `addStatementCharges` lança juros/multa
  informados depois (pago 0). `undoStatementPayment` desfaz um lançamento do ciclo ativo.
- **Totais da fatura:** `remaining = max(0, principal + encargos − pago)`; status `partial` quando há pago e
  restante, `paid` sem restante.
- **Limite (BR-FIN-026):** comprometido = parcelas que pesam (inclusive futuras) − `min(pago, principal)` por
  fatura. Parcial libera parcial; encargos não ocupam limite; desfazer volta a comprometer.
- **Orçamento:** pagar a fatura reservada **não desconta de novo**; só encargos pesam, no ciclo ativo do lançamento.
- **Restante transportado (BR-FIN-034):** ao fechar o ciclo (ou "Já recebi"), o restante não pago da fatura que
  pesou nele **e tem pagamento** (`paidAmount > 0`) volta ao resultado do ciclo encerrado (`carriedStatements`) e
  fica reservado no seguinte (`carriedStatementDebt`), até ser quitado. Desconta as parcelas da mesma fatura que
  ainda vão pesar em ciclos seguintes e nunca passa do que o ciclo reservou (+ transportado + encargos do ciclo).
- **Total informado (BR-FIN-032):** compra `kind: 'statement-balance'` (1x, `origin: 'existing'`), uma por
  cartão+fatura. Parcelamento com `includedInStatementBalance`: a parcela atual aparece com `nominalAmount` e
  `amount = 0` (não soma ao total, ao orçamento nem ao limite) enquanto o total existir. Itens incluídos ≤ total,
  também ao cadastrar o total depois das parcelas incluídas.
- **Onboarding (UI):** ao cadastrar parcelamento cuja parcela atual cai numa fatura com total informado,
  mostrar "Esta parcela já está no total da fatura informada", **marcada por padrão**; sem total, a opção não aparece.
- **Formas à vista:** Pix/débito/dinheiro continuam "À vista". Compra acima do limite: alerta forte + confirmação
  (`calculateLimitExcess` informa quanto excede).
- **Invariantes:** INV-01..INV-10 de BR-FIN-030.

## Critérios de aceite
Testes em `src/application/card-rules.test.ts` (salvo indicação).

- [x] **1.** Compra parcelada compromete o limite inteiro — "1. compra parcelada compromete o limite inteiro".
- [x] **2.** Pagar a fatura com uma parcela libera só a parcela; a próxima libera mais uma — "2. pagar a fatura…".
- [x] **3.** Desfazer o pagamento volta a comprometer o limite — "3. desfazer o pagamento…".
- [x] **4.** A fatura que vence no ciclo reduz o disponível antes do vencimento — "4. a fatura que vence no ciclo…".
- [x] **5.** Pagar a fatura reservada não desconta de novo — "5. pagar a fatura reservada…".
- [x] **6.** Nova compra na mesma fatura aumenta a fatura e reduz o disponível na hora — "6. nova compra…".
- [x] **7.** Compra em fatura que vence no próximo ciclo não muda o ciclo atual — "7. compra em fatura…".
- [x] **8.** Onboarding: parcela atual já incluída no total da fatura não soma de novo (e, sem marcar, soma) — "8. onboarding…".
- [x] **9.** Pagamento parcial libera só o pago; o restante continua comprometido e aparece em compromissos — "9. pagamento parcial…".
- [x] **10.** Juros no pagamento: só o excedente pesa no orçamento — "10. juros no pagamento…".
- [x] **11.** Compra acima do limite fica registrada e o disponível fica negativo — "11. compra acima do limite…".
- [x] **12.** Alterar o limite muda só a capacidade de crédito (renda, saldo e limite diário iguais) — "12. alterar o limite…".
- [x] **13.** Parcelas com centavos somam exatamente o total — "13. parcelas com centavos…".
- [x] Restante parcial volta ao resultado do ciclo encerrado e fica reservado no seguinte até ser quitado — bloco "restante de fatura parcial vira dívida do próximo ciclo (BR-FIN-034)".
- [x] Restante não quitado é transportado de novo, sem passar do que o ciclo reservou — mesmo bloco.
- [x] Invariantes (soma das parcelas, parcela uma única vez, excluir total, itens incluídos ≤ total) — bloco "invariantes do domínio (BR-FIN-030)".
- [x] Migração v7 → v8 (`charges` = excedente) — `src/infrastructure/storage/migrations.v8.test.ts`.
- [x] Migration `20261005000000_statement_partial_payments.sql` com RLS e constraints — `npm run test:db`.
- [x] UI: faturas parciais ("Pagar o restante", valor parcial, aviso de restante), "Registrar juros/multa", desfazer por lançamento, "Fatura pendente do ciclo anterior" e "Juros/multas de faturas" no plano do ciclo, "Registrar mesmo assim" acima do limite e onboarding com "já incluída" (T-027; `src/screens/cards.screens.test.tsx`, `src/screens/screens.test.tsx`).

## Casos de borda
| Caso | Comportamento |
|---|---|
| Fatura **sem pagamento** ao fechar o ciclo (nenhum lançamento, ou só encargos) | **Não é transportada**: o principal já pesou no ciclo do vencimento; a fatura segue `overdue` e o limite comprometido até haver pagamento. |
| Fatura parcial com parcelas que ainda vão pesar em ciclos seguintes | Transporta só o restante que não será reservado adiante (`restante − reservado adiante`). |
| **Encargos informados depois** (`addStatementCharges`) | Lançamento com pago 0: aumenta o restante, pesa no orçamento do ciclo ativo e não ocupa limite. Exige fatura fechada. |
| **Excluir o total informado** | Permitido enquanto a compra for modificável (BR-FIN-029); a parcela marcada "já incluída" volta a contar (amount = nominal) — nada some. |
| **Itens incluídos > total** | Recusado: "As parcelas incluídas somam mais que o total informado da fatura. Confira os valores." Cadastrar o total depois, menor que as parcelas já incluídas: "As parcelas incluídas nesta fatura somam mais que o total informado. Confira os valores." |
| Marcar "já incluída" **sem total** | Recusado: "Informe antes o total desta fatura para incluir a parcela nele." |
| Segundo total para a mesma fatura | Recusado: "Já existe um total informado para a fatura MM/AAAA." |
| **Dois aparelhos** registram o mesmo pagamento offline | Ficam dois lançamentos. O amortizado é limitado ao principal (limite nunca liberado a mais) e pagamento não mexe no orçamento; se o segundo aparelho já via o primeiro, o excedente vira encargo. O usuário desfaz o duplicado. |
| Pagar acima do restante | A diferença é gravada como `charges` e pesa no ciclo ativo. |
| Quitar o restante transportado no ciclo seguinte | Não desconta de novo (já reservado como `carriedStatementDebt`) e libera o limite; o ciclo não transporta mais nada. |
| Pagamento sem valor depois do vencimento | Recusado: "A fatura venceu. Informe o valor pago, com juros se houver." |
| Desfazer lançamento de ciclo encerrado | Recusado (histórico imutável). |
| Lançamento offline com `cycleId` de ciclo que outro aparelho já fechou | **Limitação conhecida:** não reabre o transporte (ADR-018). |
| Juros lançados antes do vencimento | **Limitação conhecida:** pesam no ciclo ativo do lançamento; o total fica certo (ADR-018). |
| Situação inicial em fatura com lançamento | A fatura não aparece entre as opções (qualquer lançamento, pago ou parcial). |
| Fatura com lançamento (mesmo parcial ou só encargos) | Bloqueia compra retroativa nela e edição/exclusão das compras que a compõem (BR-FIN-029). |

## Tasks derivadas
T-026 (núcleo), T-027 (UI), T-028 (documentação)

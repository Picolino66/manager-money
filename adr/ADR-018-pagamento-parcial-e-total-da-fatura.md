# ADR-018 — Pagamento parcial e total da fatura, encargos e restante transportado

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-04
- **Atualiza:** [ADR-017](ADR-017-faturas-limite-e-situacao-inicial.md) (um pagamento por fatura com id
  determinístico, `paid_amount ≥ statement_amount`, juros = pago − fatura), [ADR-003](ADR-003-persistencia-local.md)
  (documento v8) e [ADR-004](ADR-004-sincronizacao.md) (colunas novas, índice único removido).
- **Spec:** [SPEC-019](../specs/SPEC-019-pagamento-parcial-total-da-fatura-e-invariantes.md).

## Contexto

A ADR-017 tratava a fatura como "paga ou não paga": um único pagamento vigente, sempre ≥ ao valor da
fatura, com os juros calculados como `pago − fatura`. A revisão do domínio com o dono do produto encontrou
situações que esse modelo não representa:

- **Pagamento parcial** (pagar parte da fatura e rolar o restante) é comum, e o modelo obrigava o usuário a
  mentir (marcar paga) ou a não registrar nada (limite preso).
- **Juros e multa** às vezes só aparecem na fatura seguinte, depois do pagamento; não havia onde lançá-los.
- **Situação inicial:** quem chega ao app conhece o **total da fatura** mostrado pelo banco, e esse total já
  contém a parcela atual dos parcelamentos em andamento. Cadastrar o total e os parcelamentos somava a parcela
  duas vezes.
- O limite liberado pelo pagamento precisava ser **proporcional ao que foi amortizado**, não "tudo ou nada".

Também era preciso escrever explicitamente as **invariantes** que nenhuma mudança pode quebrar (limite ≠
dinheiro, nada contado duas vezes, histórico fechado imutável etc.).

## Opções consideradas

| Tema | Opção | Prós | Contras |
|---|---|---|---|
| Lançamentos | Manter um pagamento por fatura (id determinístico) | Convergência trivial entre aparelhos | Não representa pagamento parcial nem encargos tardios |
| | **Vários lançamentos por fatura (`paidAmount`, `charges`)** | Representa parcial, quitação posterior e encargos | Dois aparelhos podem registrar o mesmo pagamento (ver trade-offs) |
| Restante de pagamento parcial | **Restante continua reservado** no ciclo do vencimento, sem transporte | Simples; nenhum campo novo no ciclo | O ciclo fecha com o dinheiro "reservado" sem ter saído; o ciclo seguinte não enxerga a dívida e o limite diário fica inflado |
| | **Restante vira dívida do próximo ciclo** (escolhida pelo dono do produto) | O ciclo encerrado mostra o que de fato saiu; o seguinte reserva o que ainda é devido até quitar | Exige `carriedStatementDebt`/`carriedStatements` no ciclo e cálculo no fechamento |
| Encargos | Embutir no valor pago (ADR-017) | Sem campo novo | Juros informados depois não têm onde entrar; histórico ambíguo |
| | **Campo `charges` separado por lançamento** | Encargos tardios (`addStatementCharges`); orçamento recebe só os encargos | Migração de dados (v8 e SQL) |
| Total da fatura na situação inicial | Cadastrar só itens | Sem tipo novo | O usuário não sabe reconstruir a fatura item a item |
| | **Compra `kind: 'statement-balance'` + parcela marcada "já incluída"** | Total do banco vira fonte de verdade; parcela compõe sem somar | Valor efetivo × nominal na parcela |
| Liberação de limite | Tudo ao quitar | Simples | Parcial prende o limite inteiro |
| | **Libera o amortizado: `min(pago, principal)`** | Proporcional; encargos não ocupam limite | — |

## Decisão

1. **Lançamentos de fatura (BR-FIN-033).** `StatementPayment` passa a ter `paidAmount` (pode ser parcial; 0 =
   só encargos) e `charges` (juros/multa reconhecidos). Uma fatura tem **vários** lançamentos, cada um com id
   gerado no cliente (`ctx.newId`), substituindo o id determinístico `statement-<cardId>-<yyyy-MM>` da ADR-017.
   `payStatement({ cardId, statementKey, paidAmount? })`, depois do fechamento: sem valor quita o restante (só
   até o vencimento; depois o valor é obrigatório); valor menor que o restante = parcial; maior = a diferença
   vira `charges`. `addStatementCharges` registra encargos informados depois. `undoStatementPayment` desfaz um
   lançamento do ciclo ativo.
2. **Totais derivados** (`summarizeStatement`): `remaining = max(0, principal + encargos − pago)`;
   `amortized = min(pago, principal)`. Status `open`/`closed`/`overdue` sem lançamento pago; `partial` com pago e
   restante; `paid` sem restante. `CardStatement` deixa de ter `payment` (singular) e ganha `knownTotal`,
   `charges`, `paid`, `remaining` e `payments[]`; `calculateStatementInterest` e `statementPaymentId` saem.
3. **Limite (BR-FIN-026 alterada).** Comprometido = parcelas que pesam (inclusive futuras) − amortizado em cada
   fatura. Pagamento parcial libera parcial; encargos não ocupam limite; desfazer volta a comprometer.
4. **Orçamento.** O principal da fatura já está reservado no ciclo do vencimento: **pagar não desconta de novo**.
   Só os encargos pesam, no ciclo ativo em que foram lançados (`statementInterest`).
5. **Restante transportado (BR-FIN-034).** Ao fechar o ciclo (`closeCycle` ou `receiveIncomeEarly`),
   `selectStatementsToCarry` calcula, por fatura que pesou nele (vence nele ou veio transportada) **e tem algum
   pagamento** (`paidAmount > 0`; encargos sozinhos não bastam),
   `min(max(0, restante − reservado adiante), reservado no ciclo + transportado + encargos do ciclo)`, em que
   "reservado adiante" são as parcelas da mesma fatura que ainda vão pesar em ciclos seguintes. Esse valor volta ao
   `finalBalance` do ciclo encerrado e é gravado em `carriedStatements`; o ciclo seguinte nasce com
   `carriedStatementDebt` (soma), que reduz o saldo inicial até ser quitado. Fatura **sem pagamento não é
   transportada** (continua vencida, com o limite comprometido).
6. **Total informado da fatura (BR-FIN-032).** Na situação inicial, `statementBalance: true` cria uma compra 1x
   `origin: 'existing'`, `kind: 'statement-balance'` — fonte de verdade da fatura; um por cartão+fatura. Um
   parcelamento com `includedInStatementBalance` tem a parcela atual incluída: aparece com `nominalAmount` e
   `amount = 0` enquanto o total existir (`listEffectiveInstallments`); itens incluídos não podem passar do total;
   excluir o total faz a parcela voltar a contar. Cadastrar um total para fatura cujas parcelas já marcadas como
   incluídas somam mais que ele também é recusado.
7. **Documento local v8** (`migrateV7ToV8`): cada pagamento ganha `charges = max(0, pago − fatura)`; nenhum
   valor muda e nada fica `dirty` (valores ausentes contam como 0). Schema Zod aceita `kind`, `includedInStatementBalance`, `charges`,
   `carriedStatementDebt` e `carriedStatements`.
8. **Remoto, contrato v1 aditivo** (`20261005000000_statement_partial_payments.sql`):
   `card_purchases.kind`/`included_in_balance`; `statement_payments.charges` **nulável e sem default** (backfill
   igual ao local; linha gravada por cliente antigo chega nula e o app deriva `pago − fatura`), troca da regra
   `paid_amount ≥ statement_amount` por `paid_amount ≥ 0 and paid_amount + coalesce(charges, 0) > 0`, **remoção do índice
   único** `statement_payments_one_per_statement` (vira índice comum); `cycles.carried_statement_debt` e
   `cycles.carried_statements` (jsonb array, até 100). O mapper lê `charges` ausente ou nulo como `pago − fatura`.
9. **Invariantes do domínio** registradas em BR-FIN-030 (INV-01..INV-10) e cobertas por
   `src/application/card-rules.test.ts`.

## Trade-offs e consequências

- **Dois aparelhos offline** podem registrar o mesmo pagamento (antes convergiam pelo id determinístico).
  Mitigações: o **principal amortizado é limitado ao valor da fatura** (`amortized = min(pago, principal)`),
  então o limite nunca é liberado além do que a fatura comprometeu; o pagamento não mexe no orçamento (só
  encargos mexem), então o saldo do ciclo não fica errado; e, quando o segundo aparelho já sincronizou o
  primeiro lançamento, o excedente sobre o restante **vira encargo** (`charges`), visível ao usuário. O
  lançamento duplicado aparece na lista da fatura e o usuário o desfaz no ciclo ativo.
- O transporte acontece só no fechamento; durante o ciclo, a fatura parcial aparece em "Próximos compromissos"
  com o **restante**. O valor transportado nunca passa do que o ciclo reservou para a fatura (mais o que veio
  transportado e os encargos do ciclo), para não criar dívida que o ciclo não contou.
- `carriedStatements` é congelado no ciclo fechado (histórico imutável): pagar depois não reescreve o ciclo
  encerrado; o ciclo seguinte é que recalcula.
- UI entregue na T-027 (pagar o restante ou valor parcial, registrar juros/multa, desfazer por lançamento, "Fatura
  pendente do ciclo anterior" no plano do ciclo, "já incluída" no onboarding).
- **Limitação conhecida (sync):** um lançamento feito offline num aparelho com `cycleId` de um ciclo que outro
  aparelho já fechou **não reabre o transporte**: `carriedStatements` do ciclo fechado é imutável; o restante segue
  visível na fatura e em próximos compromissos.
- **Limitação conhecida (encargos):** encargos são atribuídos ao ciclo ativo do lançamento; quando os juros são
  lançados antes do vencimento, o valor pode ficar num ciclo diferente do que o usuário esperaria, mas o total
  pago e devido fica certo.
- Supersede na ADR-017: o item 3 (um pagamento vigente, `paidAmount ≥ valor`, juros = pago − fatura) e o trecho
  do item 8 sobre o id determinístico e o índice único. O restante da ADR-017 continua valendo.

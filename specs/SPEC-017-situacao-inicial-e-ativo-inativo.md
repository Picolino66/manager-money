---
spec: SPEC-017
features: [card.existing-debt, planning.configure, planning.income-sources]
---
# SPEC-017 — Situação inicial do cartão e itens ativos/inativos

## Objetivo
Permitir que quem já chega com fatura aberta e parcelamentos em curso registre essa **situação inicial** sem distorcer o orçamento, e permitir **desativar** cartões, fontes de renda e despesas fixas sem apagar o histórico.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [existing-debt](../docs/modules/card/existing-debt.md) · [manage](../docs/modules/card/manage.md) · [configure](../docs/modules/planning/configure.md) · [income-sources](../docs/modules/planning/income-sources.md) · [ADR-017](../adr/ADR-017-faturas-limite-e-situacao-inicial.md)

## Requisitos relacionados
RF-01, RF-25, RF-26 · BR-FIN-004, BR-FIN-010, BR-FIN-018, BR-FIN-021, BR-FIN-024, BR-FIN-027, BR-FIN-028

## Regras
- **Situação inicial (BR-FIN-027):** `addExistingCardDebt` com descrição, categoria, valor da parcela (> 0), total de parcelas (1–48), parcelas restantes (1..total) e a **fatura da próxima parcela** (`yyyy-MM`), que ainda não pode ter vencido e fica até 12 faturas à frente da atual. Fatura em aberto = 1 de 1.
- As parcelas já pagas (`total − restantes`) viram `settledInstallments`: **não pesam** no orçamento nem no limite. As restantes geram a agenda futura (fatura e ciclo de cada uma) e comprometem o limite.
- Total da compra = parcela × total de parcelas (sem arredondamento); data sintética = fechamento da 1ª fatura; `origin = 'existing'` (coluna `card_purchases.origin`).
- Pode ser cadastrada antes do primeiro ciclo (referência = próximo ciclo a abrir) e em cartão inativo.
- Compra da situação inicial (`origin = 'existing'`) só muda **descrição e categoria**, qualquer que seja a data; essa edição não recalcula a compra (funciona com cartão inativo).
- **Cartão inativo (BR-FIN-028):** some do formulário de compra; parcelas e faturas continuam valendo; pode ser reativado.
- **Fonte de renda inativa (BR-FIN-018/024):** não soma à renda nem define o dia do ciclo. É obrigatória ao menos uma fonte ativa.
- **Despesa fixa inativa:** não reserva saldo, não aparece como pendente, não pode ser paga e, se for parcelamento, não avança nem começa (fica pausado). Recorrência = mensal (implícita, sem campo).

## Comportamento
- **Cartões → cartão → "Compras anteriores ao app"** (rota `CardDebt {cardId}`; também oferecida logo após cadastrar um cartão): "Fatura em aberto" ou "Parcelamento em andamento", com descrição, categoria, valor da parcela, total, restantes e fatura da próxima parcela.
- **Configuração:** chave "Ativa" por fonte de renda e por despesa fixa; inativas aparecem esmaecidas e fora dos totais.

## Fluxos
FLOW-primeiro-uso · FLOW-cartao-fatura.

## Critérios de aceite
- [x] Fatura atual e parcelamentos existentes geram os compromissos futuros e o limite já usado.
- [x] Parcelas já pagas não pesam no saldo nem no limite.
- [x] Valida restantes, fatura vencida e fatura distante demais; aceita cadastro antes do 1º ciclo.
- [x] Compra anterior ao app só muda descrição e categoria.
- [x] Cartão inativo não aceita compra nova e suas parcelas continuam valendo.
- [x] Fonte inativa não soma nem define o ciclo; salvar exige uma ativa. Fixa inativa não reserva, não é paga e não avança parcelas.
- [x] Sync aditivo (`active`, `settled_installments`) e migração v6 → v7.
- [x] Formulário de situação inicial e ativar/desativar cartão na UI (T-023).
- [x] Chaves de ativo/inativo de fontes e fixas na Configuração (T-024).

## Casos de borda
| Caso | Comportamento |
|---|---|
| Restantes = total | Nenhuma parcela quitada; todas pesam. |
| Próxima parcela em fatura já vencida | Recusado: a fatura vencida deve ser paga fora e a próxima informada. |
| Próxima parcela em fatura já paga no app | Recusado. |
| Fatura da próxima parcela cai em ciclo anterior ao ativo | A agenda começa no ciclo ativo (nunca antes). |
| Única fonte ativa desativada | Recusado ao salvar ("Informe ao menos uma fonte de renda ativa."). |
| Fixa inativada já paga no ciclo | O pagamento vigente continua contando; ela deixa de reservar nos próximos ciclos. |
| Cartão inativo com fatura fechada | Pode receber "Paguei a fatura" normalmente. |

## Tasks derivadas
T-022, T-023, T-024

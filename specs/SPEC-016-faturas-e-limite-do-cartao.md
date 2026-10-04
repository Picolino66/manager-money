---
spec: SPEC-016
features: [card.manage, card.purchase, card.statement]
---
# SPEC-016 — Faturas e limite do cartão

## Objetivo
Tratar o cartão de crédito como compromisso futuro: cada compra entra numa fatura, a fatura pesa no ciclo do seu **vencimento**, o limite do cartão é acompanhado à parte e só é liberado quando o usuário marca **"Paguei a fatura"**. Substitui, em SPEC-013, a regra "1ª parcela no ciclo do fechamento; vencimento informativo".

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [manage](../docs/modules/card/manage.md) · [purchase](../docs/modules/card/purchase.md) · [statement](../docs/modules/card/statement.md) · [contracts](../docs/architecture/contracts.md) · [ADR-017](../adr/ADR-017-faturas-limite-e-situacao-inicial.md)

## Requisitos relacionados
RF-19, RF-22, RF-23, RF-24 · BR-FIN-005, BR-FIN-019, BR-FIN-020, BR-FIN-025, BR-FIN-026, BR-FIN-028, BR-FIN-029, BR-FIN-030

## Regras
- **Cartão:** nome único, fechamento e vencimento de 1 a 28, **limite total opcional** (centavos ≥ 0; vazio = não informado), ativo/inativo.
- **Fatura da compra (BR-FIN-025):** primeiro fechamento em ou depois da data da compra; chave = `yyyy-MM` do mês de fechamento.
- **Vencimento:** próximo `dueDay` depois do fechamento — mesmo mês se `dueDay > closingDay`; senão, mês seguinte.
- **Ciclo da fatura:** o ciclo financeiro que contém o vencimento, nunca antes do ciclo ativo. Compra → fatura → ciclo.
- `firstStatementKey` e `firstCycleKey` são gravados na compra; a parcela *n* fica em `chave + (n − 1)` meses (fatura e ciclo).
- **Status da fatura:** `open` até o dia do fechamento (inclusive); `closed` do dia seguinte até o vencimento (inclusive); `overdue` depois; `paid` com pagamento vigente.
- **Limite (BR-FIN-026):** comprometido = parcelas em aberto em faturas não pagas, inclusive futuras; disponível = limite − comprometido. A compra compromete o valor total na hora.
- **Compra acima do disponível:** o app **avisa e permite**; o disponível fica negativo.
- **"Paguei a fatura":** só para fatura `closed` ou `overdue` (a partir do dia seguinte ao fechamento). Até o vencimento, o valor pago é o da fatura; depois, o usuário informa o valor pago (≥ valor da fatura) e a diferença (juros) **pesa no ciclo ativo**. Um pagamento vigente por fatura; desfazer só no ciclo ativo.
- **Compra retroativa em fatura já paga e fechada** é recusada ("Confira a data da compra"). Se o fechamento foi aumentado depois do pagamento e a fatura paga ainda está "aberta" pelo dia novo, a compra nova vai para a fatura seguinte (BR-FIN-028).
- **Id do pagamento** determinístico `statement-<cardId>-<yyyy-MM>`: dois aparelhos que pagam a mesma fatura convergem no mesmo registro (LWW); pagar de novo depois de desfazer reaproveita o registro.
- **Saldo do ciclo:** as parcelas do ciclo reduzem o saldo inicial (BR-FIN-005); o limite do cartão **nunca** é apresentado como dinheiro para gastar. Rótulos obrigatórios: "Limite disponível do cartão" × "Ainda pode gastar hoje".
- **Sem dupla contagem (BR-FIN-030):** compra no crédito pesa só pela fatura no ciclo do vencimento; nunca como gasto do dia.

## Comportamento
- **Cartões (Ajustes → Cartões de crédito):** lista com selo "Inativo", barra de limite e "Limite disponível do cartão" (ou "Limite não informado"); Editar/Excluir (excluir só sem compras).
- **Detalhe do cartão (rota `CardDetail {cardId}`):** limite total, comprometido e disponível; **Fatura atual** (a fechada/vencida mais antiga não paga; se não houver, a aberta), **Próxima fatura** e demais faturas não pagas — título **"Outras faturas"** quando há fechadas/vencidas além da atual e da próxima (cada uma com "Paguei a fatura"), ou **"Faturas futuras"** quando todas estão abertas; **"Quanto vai pesar nos próximos ciclos?"** soma as parcelas do ciclo ativo em diante, **inclusive de faturas pagas** (pagar libera o limite, não o orçamento); **Paguei a fatura** (com "Valor pago, com juros" quando vencida); faturas pagas neste ciclo com **Desfazer**; editar/excluir compra quando permitido (BR-FIN-029); ativar/desativar; atalho "Compras anteriores ao app".
- **Registrar gasto → Cartão de crédito:** só cartões ativos; prévia "Nx de R$ … · fatura MM/AAAA · vence dd/MM"; aviso quando o total passa do limite disponível.

## Fluxos
FLOW-registrar-gasto · FLOW-cartao-fatura · FLOW-fim-de-ciclo.

## Critérios de aceite
- [x] Compra até o dia do fechamento entra na fatura do mês; depois, na do mês seguinte (domínio).
- [x] A fatura pesa no ciclo do vencimento, inclusive quando o vencimento cai no mês seguinte ao fechamento.
- [x] Limite comprometido = parcelas em aberto de faturas não pagas; pagar a fatura libera; desfazer volta a comprometer.
- [x] Depois do vencimento, pagar exige o valor pago; os juros reduzem o saldo do ciclo ativo.
- [x] Compra acima do limite é registrada; o disponível fica negativo.
- [x] Compra em fatura paga é recusada; alterar fechamento não reescreve compras; alterar limite só muda o disponível.
- [x] Migração v6 → v7 e migration `20261004000000_card_limits_and_statements.sql` com RLS (`npm run test:db`).
- [x] Tela de cartões com limite, faturas e "Paguei a fatura" (T-023).
- [x] Registrar gasto com aviso de limite e só cartões ativos (T-024).

## Casos de borda
| Caso | Comportamento |
|---|---|
| Compra **no dia do fechamento** | Mesma fatura (fechamento em ou depois da data). |
| Meses curtos | Fechamento e vencimento ficam entre 1 e 28: todo mês tem o dia; não há ajuste para fevereiro. |
| Vencimento no mês seguinte | `dueDay ≤ closingDay` → vencimento no mês seguinte ao fechamento; a fatura pesa no ciclo que contém essa data. |
| Parcelamento atravessando anos | Chaves `yyyy-MM` avançam por mês (`2026-12` + 1 = `2027-01`), para fatura e ciclo. |
| Edição / exclusão / estorno | Permitidos enquanto nenhum ciclo fechado contou parcela da compra e nenhuma fatura paga a contém (BR-FIN-029). A edição de valor/parcelas/data recalcula fatura e ciclo pela nova data; mudar só descrição e categoria nunca recalcula (vale com cartão inativo ou data fora do ciclo ativo). Estorno = excluir a compra. |
| Compra criada por fixa paga no crédito | Editar valor, parcelas ou data é bloqueado ("Desfaça o pagamento"); descrição e categoria podem mudar. Excluir a compra exclui junto o pagamento da fixa, que volta a pendente e reservada; bloqueado se o pagamento for de ciclo encerrado. |
| Fechamento aumentado depois de pagar a fatura | Compra nova que cairia na fatura paga (ainda "aberta" pelo dia novo) vai para a fatura seguinte. |
| Dois aparelhos pagam a mesma fatura | Mesmo id determinístico: convergem no mesmo registro (LWW), sem travar o sync. |
| Faturas vencidas antes da v7 | A migração as marca pagas sem juros (pagamento sintético no ciclo ativo ou no último), para não aparecerem vencidas nem prenderem o limite. |
| **Limitação conhecida:** ciclo antecipado ("Já recebi") | Fatura com vencimento entre o início antecipado e o dia de pagamento natural é mapeada pela chave mensal do ciclo: as parcelas seguintes podem pesar um ciclo à frente, e faturas de compras do ciclo anterior com vencimento nessa janela continuam no ciclo fechado. Correção futura: mapear datas pelos ciclos reais. |
| Exclusão de cartão com compras | Recusada: o cartão deve ser **desativado** (some de compras novas; parcelas continuam valendo). |
| Alterar limite | Só muda o disponível. |
| Alterar fechamento/vencimento | Vale para compras novas; compras registradas mantêm as chaves gravadas. |
| Alterar a fonte principal (dia do ciclo) | Vale a partir do próximo ciclo e para compras novas; chaves gravadas não mudam. |
| Alterar a meta | Recalcula o saldo do ciclo ativo (BR-FIN-014) e a projeção; não toca faturas. |
| Compra retroativa | Só com data dentro do ciclo ativo; dívida anterior ao app entra pela situação inicial (SPEC-017). |
| Gasto/compra com data futura | Permitido só dentro do ciclo ativo (BR-FIN-011). |
| Ciclo encerrado | Imutável: compra contada não muda; pagamento de fatura de ciclo fechado não é desfeito. |
| Arredondamento | Parcelas em centavos inteiros; os centavos que sobram vão para as primeiras parcelas (BR-FIN-020). |
| Limite já usado antes do cadastro | Lançado pela situação inicial: parcelas restantes comprometem o limite; as já pagas não. |
| Fatura não paga depois do vencimento | Continua `overdue` e comprometendo o limite até "Paguei a fatura". |

## Tasks derivadas
T-022, T-023, T-024

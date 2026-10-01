---
spec: SPEC-002
features: [cycle.open, cycle.receive-early, cycle.close]
---
# SPEC-002 — Ciclo de vida do ciclo financeiro (correções)

## Objetivo
Tornar abertura, recebimento antecipado e fechamento de ciclo seguros contra corrupção de dados (DEF-001, DEF-006, DEF-007).

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [journeys](../docs/flows/journeys.md)

## Requisitos relacionados
RF-03, RF-10, RF-11 · DEF-001, DEF-006, DEF-007 · BR-FIN-003, 006, 010, 013, 016, 017

## Regras
- **BR-FIN-016:** o recebimento antecipado na data D só é permitido se `dia(D) < payday` **e** o ciclo ativo termina **antes** da data de pagamento do mês de D. Exemplo com payday 7: o ciclo 07/10–06/11, em 03/11, permite; o ciclo 03/11–06/12, em 04/11, bloqueia.
- **BR-FIN-017:** fechar manualmente só é permitido quando `hoje > endDate` do ciclo ativo. Antes disso, a UI desabilita o botão e explica: "O ciclo termina em dd/MM. Se o pagamento cair antes, use 'Já recebi'."
- **Abertura:** o início é o padrão de hoje (SPEC-001). Se esse início for ≤ `endDate` do último ciclo fechado, o início passa a ser `endDate + 1` desse ciclo (proteção para dados legados). O fim é sempre calculado a partir do início.
- Parcelas avançam exatamente uma vez por ciclo aberto (BR-FIN-010).

## Comportamento
- Erros de abertura viram `Alert` com a mensagem da regra (DEF-007).
- O botão "Já recebi" só aparece quando BR-FIN-016 é satisfeita.

## Fluxos
FLOW-receber-antecipado, FLOW-fim-de-ciclo

## Critérios de aceite
- [ ] Acionar "Já recebi" duas vezes no mesmo período: a 2ª vez é rejeitada e as parcelas avançaram uma única vez.
- [ ] Fechar antes do fim é rejeitado pelo caso de uso (não só pela UI).
- [ ] Fechar após o fim e abrir um novo ciclo: os períodos não se sobrepõem.
- [ ] Erro na abertura mostra um Alert.

## Tasks derivadas
T-005

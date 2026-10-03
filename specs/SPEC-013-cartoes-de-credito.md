---
spec: SPEC-013
features: [card.manage, card.purchase]
---
# SPEC-013 — Cartões de crédito e compras parceladas

## Objetivo
Cadastrar cartões (nome, fechamento, vencimento) e registrar compras no crédito parceladas, cujas parcelas abatem o saldo dos ciclos em que caem.

## Docs relacionados
[business-rules](../docs/business/business-rules.md) · [manage](../docs/modules/card/manage.md) · [purchase](../docs/modules/card/purchase.md) · [contracts](../docs/architecture/contracts.md) · [ADR-014](../adr/ADR-014-cartoes-de-credito.md)

## Requisitos relacionados
RF-19 · BR-FIN-005, BR-FIN-019, BR-FIN-020

## Regras
- Cartão: nome obrigatório e único; fechamento e vencimento entre 1 e 28; sem número de cartão.
- Compra: valor total **já com juros** (> 0), 1 a 48 parcelas, data dentro do ciclo ativo, cartão existente.
- Fatura = primeiro fechamento em ou depois da data da compra; 1ª parcela no ciclo que contém esse fechamento (nunca antes do ciclo ativo); uma parcela por ciclo seguinte.
- O vencimento é informativo.
- O saldo inicial do ciclo subtrai as parcelas que caem nele.
- Cartão com compras vigentes não é excluído; compra com parcela em ciclo fechado não é excluída.

## Comportamento
- Ajustes → **Cartões de crédito**: lista, cria, edita e exclui cartões; mostra fatura do ciclo e do próximo; permite excluir uma compra.
- **Registrar gasto → Forma de pagamento → Cartão de crédito**: escolhe cartão e parcelas; mostra "Nx de R$ …" e em qual ciclo cai a 1ª parcela.
- Hoje e Abrir ciclo mostram "Faturas de cartão".

## Fluxos
FLOW-registrar-gasto.

## Critérios de aceite
- [x] Compra antes do fechamento entra no ciclo atual; depois, no próximo; ciclo seguinte abre já com as parcelas.
- [x] Centavos que sobram vão para as primeiras parcelas e a soma fecha o total.
- [x] Excluir compra devolve o saldo; bloqueios de exclusão cobertos.
- [x] Cartões e compras sincronizam entre aparelhos (servidor em memória) e o saldo acompanha.
- [x] Migração v3 → v4 do documento; migration e RLS cobrem as tabelas (`npm run test:db`).

## Tasks derivadas
T-019

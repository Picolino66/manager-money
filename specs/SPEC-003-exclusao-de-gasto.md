---
spec: SPEC-003
features: [expense.delete]
---
# SPEC-003 — Exclusão de gasto

## Objetivo
Permitir corrigir um lançamento feito por engano (DEF-003, U2).

## Docs relacionados
[journeys](../docs/flows/journeys.md) · [contracts](../docs/architecture/contracts.md)

## Requisitos relacionados
RF-06 · BR-FIN-011, BR-SYNC-002

## Regras
- Só gastos do ciclo ativo podem ser excluídos (BR-FIN-011).
- A exclusão é lógica (`deletedAt` + `dirty`) para propagar no sync; gastos excluídos não entram em nenhum cálculo nem lista.

## Comportamento
Na tela de edição, o botão "Excluir gasto" (variante perigo) pede confirmação ("Excluir gasto? Esta ação não pode ser desfeita.") e depois volta para a tela anterior.

## Fluxos
FLOW-registrar-gasto (correção)

## Critérios de aceite
- [ ] Depois de excluir, o total do dia, o limite e o histórico são recalculados.
- [ ] Excluir um gasto inexistente ou de um ciclo fechado gera erro de domínio.
- [ ] O registro excluído é enviado no próximo push com `deleted_at`.

## Tasks derivadas
T-006

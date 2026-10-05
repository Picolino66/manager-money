---
id: cycle.dashboard
type: feature
module: cycle
title: Painel do dia (Hoje)
summary: >
  Tela inicial que responde quanto ainda pode ser gasto hoje sem perder a meta: saldo e limite do
  dia com status, próximos compromissos (faturas e fixas pendentes), resumo do ciclo e projeção
  dos próximos ciclos ("livre antes de novos gastos").
keywords: [limite diário, hoje, você pode gastar hoje, saldo do dia, status, dashboard, próximos compromissos, projeção, próximos ciclos]
code:
  - app/src/screens/DashboardScreen.tsx
  - app/src/components/CyclePlanCard.tsx
  - packages/core/src/domain/financial/financial.calculations.ts
  - packages/core/src/domain/financial/projection.ts
  - packages/core/src/application/selectors.ts
symbols: [selectCreditSnapshot, buildDashboardSummary, calculateDailyLimitForDate, calculateDayStatus, calculateRemainingDays, selectUpcomingCommitments, selectCycleProjections, projectCycles, selectCycleAdjustments]
adrs: [ADR-017, ADR-018]
tests: [packages/core/src/application/card-rules.test.ts, packages/core/src/application/financial-vision.test.ts, packages/core/src/domain/financial/projection.test.ts, packages/core/src/domain/financial/financial.calculations.test.ts, app/src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-007, BR-FIN-008, BR-FIN-009, BR-FIN-030, BR-FIN-031, BR-FIN-033, BR-FIN-034]
last_verified_commit: 7903717+T-042e
---

# Painel do dia (Hoje)

Spec: [SPEC-018](../../../specs/SPEC-018-hoje-compromissos-e-projecao.md) · UI entregue na
[T-024](../../../tasks/done/T-024.md). Componentes: `FixedExpensesCard`, `CyclePlanCard`.

> A tela foi enxugada: os cards "Próximos compromissos" e "Próximos ciclos" foram removidos do Hoje. Os
> seletores `selectUpcomingCommitments` e `selectCycleProjections` seguem no código, sem uso na UI.

## Descrição
Responde "quanto posso gastar hoje **e continuar atingindo minha meta**?". O saldo do ciclo já desconta a
meta, as fixas pendentes (reservadas), as parcelas de cartão do ciclo, os encargos de faturas lançados no ciclo e
o restante de faturas parciais transportado do ciclo anterior.

## Saída (blocos, nesta ordem)
1. **Hero:** "Ainda pode gastar hoje" = saldo do dia (BR-FIN-008) com selo de status (BR-FIN-009) e, no mesmo
   quadro, a grade: "Já gastou hoje", "Disponível no ciclo", "Disponível no crédito", "Gasto no saldo" (gasto à
   vista do ciclo) e "Gasto no crédito (fatura vigente)" (BR-FIN-037, `selectCreditSnapshot`). O limite previsto
   de hoje (BR-FIN-007) deixou de aparecer. Nunca mistura o limite do cartão com o "pode gastar hoje".
2. **Ações:** Registrar e Renda (rendas avulsas).
3. **Resumo curto:** dias restantes e "Meta de economia (guardada)" ("disponível no ciclo" foi para o hero).
4. **Despesas fixas do ciclo** (`FixedExpensesCard`): Pagar/Desfazer ([payment.fixed-expense](../payment/fixed-expense.md)).
5. **Plano do ciclo** (`CyclePlanCard`, **recolhido**, mostra o saldo inicial): renda (fontes ativas), rendas
   avulsas, fixas reservadas/pagas, meta, faturas do ciclo, encargos de faturas (`statementInterest`), **dívida de
   fatura transportada** (`carriedStatementDebt`, BR-FIN-034) e dívida herdada (`selectCycleAdjustments`). Rótulos:
   "− Faturas de cartão do ciclo", "− Juros/multas de faturas", "− Fatura pendente do ciclo anterior", "− Dívida
   herdada", "= Saldo inicial do ciclo" (UI da [T-027](../../../tasks/done/T-027.md)).
6. **Fim da tela:** **Já recebi** ([receive-early.md](receive-early.md)) e **Fechar ciclo** ([close.md](close.md)),
   conforme BR-FIN-016/017.

## Regras de negócio
- BR-FIN-004/005: fixas ativas pendentes reservadas; encargos de faturas lançados no ciclo e o restante de faturas
  parciais transportado (BR-FIN-034) descontam.
- BR-FIN-030: cada saída conta uma vez (dia, reserva, fatura no ciclo do vencimento, encargos no ciclo do
  lançamento, restante parcial no ciclo seguinte); pagar a fatura reservada não desconta de novo (INV-05).
- A projeção é a partir do ciclo ativo (ou do próximo a abrir) e não inclui dívida, juros nem gastos variáveis.

## Possíveis estados
Sem configuração → "Configuração inicial"; sem ciclo ativo → base financeira + "Iniciar ciclo" (a projeção
parte do próximo ciclo a abrir); sem compromissos → mensagem de vazio.

- **Projeção e fixa recorrente no cartão (BR-FIN-035):** `projectCycles` recebe os cartões; a fixa permanente recorrente num cartão ativo sai de "fixas" e entra como cobrança de cartão no ciclo em que vence a fatura de cada compra virtual (uma por virada de fatura que cai no ciclo, mesmas regras de fechamento/vencimento). Cartão inativo/excluído: volta a contar como fixa.

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
  - app/src/domain/financial/financial.calculations.ts
  - app/src/domain/financial/projection.ts
  - app/src/application/selectors.ts
symbols: [buildDashboardSummary, calculateDailyLimitForDate, calculateDayStatus, calculateRemainingDays, selectUpcomingCommitments, selectCycleProjections, projectCycles, selectCycleAdjustments]
adrs: [ADR-017, ADR-018]
tests: [app/src/application/card-rules.test.ts, app/src/application/financial-vision.test.ts, app/src/domain/financial/projection.test.ts, app/src/domain/financial/financial.calculations.test.ts, app/src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-007, BR-FIN-008, BR-FIN-009, BR-FIN-030, BR-FIN-031, BR-FIN-033, BR-FIN-034]
last_verified_commit: bfe9de6+T-028
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
1. **Hero:** "Ainda pode gastar hoje" = saldo do dia (BR-FIN-008) com selo de status (BR-FIN-009), "já gastou"
   e o limite previsto de hoje (BR-FIN-007). Nunca mistura o limite do cartão com esse valor.
2. **Ações:** Registrar e Renda (rendas avulsas).
3. **Resumo curto:** dias restantes, "Dinheiro disponível no ciclo" e "Meta de economia (guardada)".
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

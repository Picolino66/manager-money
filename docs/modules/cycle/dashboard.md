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
  - src/screens/DashboardScreen.tsx
  - src/components/UpcomingCommitmentsCard.tsx
  - src/components/ProjectionCard.tsx
  - src/components/CyclePlanCard.tsx
  - src/domain/financial/financial.calculations.ts
  - src/domain/financial/projection.ts
  - src/application/selectors.ts
symbols: [buildDashboardSummary, calculateDailyLimitForDate, calculateDayStatus, calculateRemainingDays, selectUpcomingCommitments, selectCycleProjections, projectCycles, selectCycleAdjustments]
adrs: [ADR-017]
tests: [src/application/financial-vision.test.ts, src/domain/financial/projection.test.ts, src/domain/financial/financial.calculations.test.ts, src/screens/screens.test.tsx]
business_rules: [BR-FIN-004, BR-FIN-005, BR-FIN-007, BR-FIN-008, BR-FIN-009, BR-FIN-030, BR-FIN-031]
last_verified_commit: c47cf18+T-025r2
---

# Painel do dia (Hoje)

Spec: [SPEC-018](../../../specs/SPEC-018-hoje-compromissos-e-projecao.md) · UI entregue na
[T-024](../../../tasks/done/T-024.md). Componentes: `UpcomingCommitmentsCard`, `FixedExpensesCard`,
`ProjectionCard`, `CyclePlanCard`.

## Descrição
Responde "quanto posso gastar hoje **e continuar atingindo minha meta**?". O saldo do ciclo já desconta a
meta, as fixas pendentes (reservadas), as parcelas de cartão do ciclo e os juros de faturas pagas com atraso.

## Saída (blocos, nesta ordem)
1. **Hero:** "Ainda pode gastar hoje" = saldo do dia (BR-FIN-008) com selo de status (BR-FIN-009), "já gastou"
   e o limite previsto de hoje (BR-FIN-007). Nunca mistura o limite do cartão com esse valor.
2. **Ações:** Registrar e Renda (rendas avulsas).
3. **Resumo curto:** dias restantes, "Dinheiro disponível no ciclo" e "Meta de economia (guardada)".
4. **Próximos compromissos** (`UpcomingCommitmentsCard` ← `selectUpcomingCommitments`): faturas não pagas já
   fechadas ou que vencem até o fim do ciclo, com "vence dd/MM" e as **vencidas em destaque**; depois as fixas
   ativas pendentes. Vazio: "Nenhuma fatura ou despesa fixa pendente neste ciclo."
5. **Despesas fixas do ciclo** (`FixedExpensesCard`): Pagar/Desfazer ([payment.fixed-expense](../payment/fixed-expense.md)).
6. **Próximos ciclos** (`ProjectionCard` ← `selectCycleProjections`, 3 ciclos, **recolhido** mostrando o
   "Livre antes de novos gastos"): por ciclo, renda − meta − fixas − faturas (BR-FIN-031), com aviso quando
   negativo.
7. **Plano do ciclo** (`CyclePlanCard`, **recolhido**, mostra o saldo inicial): renda (fontes ativas), rendas
   avulsas, fixas reservadas/pagas, meta, faturas do ciclo, juros de atraso e dívida herdada (`selectCycleAdjustments`).
8. **Fim da tela:** **Já recebi** ([receive-early.md](receive-early.md)) e **Fechar ciclo** ([close.md](close.md)),
   conforme BR-FIN-016/017.

## Regras de negócio
- BR-FIN-004/005: fixas ativas pendentes reservadas; juros de faturas pagas com atraso no ciclo descontam.
- BR-FIN-030: cada saída conta uma vez (dia, reserva, fatura no ciclo do vencimento, juros no ciclo do pagamento).
- A projeção é a partir do ciclo ativo (ou do próximo a abrir) e não inclui dívida, juros nem gastos variáveis.

## Possíveis estados
Sem configuração → "Configuração inicial"; sem ciclo ativo → base financeira + "Iniciar ciclo" (a projeção
parte do próximo ciclo a abrir); sem compromissos → mensagem de vazio.

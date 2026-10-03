---
id: cycle.dashboard
type: feature
module: cycle
title: Painel do dia (limite diário)
summary: >
  Tela inicial que mostra quanto ainda pode ser gasto hoje, o limite diário, o gasto do dia, o
  status e o resumo do ciclo ativo.
keywords: [limite diário, hoje, saldo do dia, status, dashboard]
code:
  - src/screens/DashboardScreen.tsx
  - src/domain/financial/financial.calculations.ts
symbols: [buildDashboardSummary, calculateDailyLimitForDate, calculateDayStatus, calculateRemainingDays]
business_rules: [BR-FIN-007, BR-FIN-008, BR-FIN-009]
last_verified_commit: a16e575+T-020
---

# Painel do dia

- **Hero:** "Ainda pode gastar" = saldo do dia (BR-FIN-008), com o selo de status (BR-FIN-009);
  abaixo, "Você já gastou" e "Hoje você pode gastar" (limite, BR-FIN-007).
- **Resumo do ciclo:** saldo inicial, saldo restante, total gasto, dias restantes.
- **Despesas fixas do ciclo:** sempre visíveis, com status e **Pagar**/**Desfazer** ([payment.fixed-expense](../payment/fixed-expense.md)).
- **Plano do ciclo:** renda, rendas avulsas, fixas pagas, meta, faturas de cartão, dívida herdada. Botão **Renda** abre as rendas avulsas.
- **Ações:** "Já recebi" ([receive-early.md](receive-early.md)) e "Fechar ciclo" ([close.md](close.md)) seguem BR-FIN-016/017.
- **Estados:** sem configuração → "Configuração inicial"; sem ciclo ativo → base financeira +
  "Iniciar ciclo".

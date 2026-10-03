---
id: planning.configure
type: feature
module: planning
title: Configurar base financeira
summary: >
  Cadastro de renda mensal, meta de economia, despesas fixas permanentes e parcelamentos; calcula
  o total de fixos e alerta quando o plano passa da renda.
keywords: [configuração, renda, fontes de renda, meta, despesas fixas, parcelamento, cartão]
code:
  - src/screens/ConfigScreen.tsx
  - src/application/cycle.use-cases.ts
  - src/domain/financial/financial.calculations.ts
symbols: [saveConfig, calculateIncomeTotal, calculateFixedExpensesTotal, calculateBaseAvailableAmount, calculateFixedExpenseAmount]
tests: [src/application/cycle.use-cases.test.ts]
business_rules: [BR-FIN-004, BR-FIN-010, BR-FIN-014, BR-FIN-015, BR-FIN-018]
last_verified_commit: a16e575+T-020
---

# Configurar base financeira

- **Tela:** `Config` (stack), acessível pelo Hoje e pela aba Ajustes. Inclui o dia de pagamento ([payday.md](payday.md)).
- **Renda:** lista de fontes (nome + valor > 0), com adicionar/remover e total exibido; ao menos
  uma fonte (BR-FIN-018). A renda mensal é a soma das fontes ([SPEC-012](../../../specs/SPEC-012-fontes-de-renda.md)).
- **Formulário:** React Hook Form + Zod. Fontes de renda ≥ 1; meta ≥ 0; fixos com nome, valor e categoria;
  parcelamentos com valor da parcela > 0, total ≥ 1 e restantes ≤ total.
- **Saldo base** = renda + rendas avulsas − fixos **pagos à vista** − meta (BR-FIN-004); fixos pendentes
  não descontam e são pagos no Hoje ([payment.fixed-expense](../payment/fixed-expense.md)). Parcelamento
  com 0 parcelas restantes não conta (BR-FIN-010).
- Se fixos + meta > renda, o app pede confirmação (BR-FIN-015).
- Fixos removidos viram exclusão lógica (propagada no sync); salvar sem mudanças não gera pendências.
- Com ciclo ativo, salvar recalcula o saldo inicial do ciclo (BR-FIN-014; mantém pagamentos, rendas avulsas e faturas) e ativa no ciclo atual
  os parcelamentos ainda não iniciados.

---
id: planning.configure
type: feature
module: planning
title: Configurar base financeira
summary: >
  Cadastro de renda mensal, meta de economia, despesas fixas permanentes e parcelamentos (cada
  item ativo ou inativo); calcula o total de fixos ativos e alerta quando o plano passa da renda.
keywords: [configuração, renda, fontes de renda, meta, despesas fixas, parcelamento, cartão, ativo, inativo]
code:
  - app/src/screens/ConfigScreen.tsx
  - app/src/application/cycle.use-cases.ts
  - app/src/domain/financial/financial.calculations.ts
  - app/src/domain/financial/financial.types.ts
symbols: [saveConfig, calculateIncomeTotal, calculateFixedExpensesTotal, calculateBaseAvailableAmount, calculateFixedExpenseAmount, isActive]
adrs: [ADR-017]
tests: [app/src/application/cycle.use-cases.test.ts, app/src/application/financial-vision.test.ts]
business_rules: [BR-FIN-004, BR-FIN-010, BR-FIN-014, BR-FIN-015, BR-FIN-018]
last_verified_commit: c47cf18+T-025r2
---

# Configurar base financeira

- **Tela:** `Config` (stack), acessível pelo Hoje e pela aba Ajustes. O dia de pagamento é de cada fonte de renda ([payday.md](payday.md)).
- **Renda:** lista de fontes (nome + valor > 0), com adicionar/remover e total (das ativas) exibido; ao menos
  uma fonte (BR-FIN-018). A renda mensal é a soma das fontes ([SPEC-012](../../../specs/SPEC-012-fontes-de-renda.md)).
- **Formulário:** React Hook Form + Zod. Fontes de renda ≥ 1 (ao menos uma ativa); meta ≥ 0; fixos com nome, valor e categoria;
  parcelamentos com valor da parcela > 0, total ≥ 1 e restantes ≤ total.
- **Saldo base** = renda (fontes ativas) + rendas avulsas − fixos do ciclo − meta (BR-FIN-004); fixos do
  ciclo = pagos à vista + **ativos pendentes, que ficam reservados** até serem pagos no Hoje
  ([payment.fixed-expense](../payment/fixed-expense.md)). Parcelamento com 0 parcelas restantes não conta (BR-FIN-010).
- **Ativo/inativo** ([SPEC-017](../../../specs/SPEC-017-situacao-inicial-e-ativo-inativo.md)): cada despesa fixa tem
  `active?` (ausente = ativa). Inativa fica fora do total de fixos, da reserva, dos pendentes e da projeção;
  parcelamento inativo não começa nem avança (BR-FIN-010). A recorrência é mensal (implícita).
- **Interruptor Ativa/Inativa** em cada fonte de renda, despesa fixa e parcelamento, com dica do efeito
  ("Não soma na renda nem define o dia do ciclo", "Não reserva dinheiro no ciclo nem aparece para pagar",
  "… e as parcelas ficam pausadas"). Grava `active: false` só quando inativo (ligado = campo ausente). Validação
  exige ao menos uma fonte ativa.
- Parcelamentos **do cartão** não ficam aqui: a tela orienta a cadastrá-los em Cartões → "Compras anteriores ao
  app" ([card.existing-debt](../card/existing-debt.md)); aqui ficam carnês, financiamentos e similares.
- Se fixos + meta > renda, o app pede confirmação (BR-FIN-015).
- Fixos removidos viram exclusão lógica (propagada no sync); salvar sem mudanças não gera pendências.
- Com ciclo ativo, salvar recalcula o saldo inicial do ciclo (BR-FIN-014; mantém pagamentos, rendas avulsas e faturas) e ativa no ciclo atual
  os parcelamentos ativos ainda não iniciados.

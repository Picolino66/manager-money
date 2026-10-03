---
id: card.manage
type: feature
module: card
title: Cadastrar cartões e ver faturas
summary: >
  Tela Cartões: cria, edita e exclui cartões (nome, dia de fechamento e de vencimento) e mostra a
  fatura do ciclo atual e do próximo, com as parcelas e a exclusão de compras.
keywords: [cartão, crédito, fatura, fechamento, vencimento, parcelas]
code:
  - src/screens/CardsScreen.tsx
  - src/application/card.use-cases.ts
  - src/domain/financial/credit-card.ts
  - src/application/selectors.ts
symbols: [saveCreditCard, deleteCreditCard, deleteCardPurchase, canDeleteCardPurchase, selectCardInstallments]
adrs: [ADR-014]
tests: [src/application/card.use-cases.test.ts, src/screens/screens.test.tsx]
business_rules: [BR-FIN-019, BR-FIN-020]
last_verified_commit: a16e575+T-020
---

# Cadastrar cartões e ver faturas

Spec: [SPEC-013](../../../specs/SPEC-013-cartoes-de-credito.md) · acesso: Ajustes → Cartões de crédito.

- Cartão: nome único (sem diferenciar maiúsculas), fechamento e vencimento de 1 a 28. Nunca se
  guarda número de cartão.
- Cada cartão mostra "Fatura deste ciclo" e "Próximo ciclo"; ao tocar, lista as parcelas do ciclo
  (`Parcela n/N`) com o botão de excluir a compra inteira.
- Excluir o cartão só é possível sem compras vigentes; excluir a compra é bloqueado se alguma
  parcela cair em ciclo fechado (BR-FIN-020). Exclusões são lógicas (propagadas no sync).
- Editar o fechamento não reescreve compras já feitas (`firstCycleKey` fica gravado na compra).

---
id: card.manage
type: feature
module: card
title: Cadastrar cartões, limite e ativo/inativo
summary: >
  Tela Cartões: cria e edita cartões (nome, fechamento, vencimento, limite opcional), ativa ou
  desativa, mostra limite comprometido e disponível e permite editar ou excluir compras ainda
  não contadas em ciclo fechado nem em fatura paga.
keywords: [cartão, crédito, limite, limite disponível, fechamento, vencimento, desativar, inativo]
code:
  - src/screens/CardsScreen.tsx
  - src/screens/CardDetailScreen.tsx
  - src/screens/cardView.ts
  - src/components/CardForm.tsx
  - src/components/CardLimitBar.tsx
  - src/components/EditCardPurchaseModal.tsx
  - src/components/Badge.tsx
  - src/application/card.use-cases.ts
  - src/domain/financial/credit-card.ts
  - src/application/selectors.ts
symbols: [saveCreditCard, setCreditCardActive, deleteCreditCard, updateCardPurchase, deleteCardPurchase, canModifyCardPurchase, calculateCardLimitUsage, selectCardLimitUsage, selectCreditCards, selectActiveCreditCards]
adrs: [ADR-014, ADR-017]
tests: [src/application/card.use-cases.test.ts, src/application/financial-vision.test.ts, src/domain/financial/credit-card.test.ts, src/screens/cards.screens.test.tsx, src/screens/screens.test.tsx]
business_rules: [BR-FIN-020, BR-FIN-026, BR-FIN-028, BR-FIN-029]
last_verified_commit: c47cf18+T-025r4
---

# Cadastrar cartões, limite e ativo/inativo

Specs: [SPEC-013](../../../specs/SPEC-013-cartoes-de-credito.md), [SPEC-016](../../../specs/SPEC-016-faturas-e-limite-do-cartao.md),
[SPEC-017](../../../specs/SPEC-017-situacao-inicial-e-ativo-inativo.md) · acesso: Ajustes → Cartões de crédito.
UI entregue na [T-023](../../../tasks/done/T-023.md).

## Telas
- **Cartões** (`CardsScreen`): lista com selo "Inativo" (`Badge`), barra de limite (`CardLimitBar`) e
  "Limite disponível do cartão" (ou "Limite não informado"); **Editar** e **Excluir** (só sem compras,
  `hasCardPurchases`); **Adicionar cartão** abre o `CardForm` (nome, fechamento, vencimento, limite). Depois
  de cadastrar, oferece **"Cadastrar compras anteriores"** (vai para [situação inicial](existing-debt.md)) ou "Agora não".
- **Detalhe do cartão** (rota `CardDetail { cardId }`, `CardDetailScreen`): "Editar cartão", ativar/desativar,
  bloco **"Quanto ainda posso usar deste cartão?"** (limite total, comprometido, "Limite disponível do cartão"),
  faturas ([statement.md](statement.md)), **"Quanto vai pesar nos próximos ciclos?"** (`weightByCycle`: parcelas do ciclo
  ativo em diante, inclusive de faturas pagas — pagar libera o limite, não o orçamento), compras
  com editar/excluir (`EditCardPurchaseModal`) e atalho **"Compras anteriores ao app"**.

## Regras

- **Cartão** (`saveCreditCard`): nome único (sem diferenciar maiúsculas), fechamento e vencimento de 1 a 28,
  **limite total opcional** em centavos (`creditLimit`, `null` = não informado; negativo é recusado) e `active`
  (novo nasce ativo; edição mantém o valor). Nunca se guarda número de cartão.
- **Limite (BR-FIN-026, `calculateCardLimitUsage`):** comprometido = parcelas em aberto (sem as quitadas antes do
  cadastro) em faturas **não pagas**, inclusive futuras; disponível = limite − comprometido, `null` sem limite e
  negativo em estouro. Rótulo obrigatório: **"Limite disponível do cartão"** — nunca apresentado como dinheiro
  para gastar ("Ainda pode gastar hoje" é outra coisa).
- **Alterações (BR-FIN-028):** mudar fechamento, vencimento ou o dia do ciclo não reescreve compras (chaves
  `firstStatementKey`/`firstCycleKey` congeladas); mudar o limite só muda o disponível.
- **Ativar/desativar** (`setCreditCardActive`): cartão inativo some do formulário de compra
  (`selectActiveCreditCards`); parcelas, faturas e "Paguei a fatura" continuam valendo.
- **Excluir cartão** (`deleteCreditCard`): só sem compras vivas; com compras, erro "Desative-o em vez de excluir".
- **Editar/excluir compra (BR-FIN-029, `canModifyCardPurchase`):** permitido enquanto nenhum ciclo fechado
  (fechado depois do cadastro da compra) contou parcela dela e nenhuma fatura paga a contém. Editar recalcula
  fatura e ciclo pela nova data (dentro do ciclo ativo); compras da situação inicial (`origin = 'existing'`)
  só mudam descrição e categoria, qualquer que seja a data. Mudar só descrição e categoria nunca recalcula a
  compra (vale com cartão inativo ou data fora do ciclo ativo). Compra criada por **fixa paga no crédito**: valor,
  parcelas e data ficam bloqueados ("Desfaça o pagamento"); excluí-la exclui junto o pagamento da fixa, que volta a
  pendente e reservada (bloqueado se o pagamento for de ciclo encerrado). Estorno = excluir a compra. Exclusões são lógicas (propagadas no sync).
- Faturas e "Paguei a fatura": [statement.md](statement.md). Situação inicial: [existing-debt.md](existing-debt.md).

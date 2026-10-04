---
spec: SPEC-023
features: [web.settings, web.cards, core.shared-package]
---
# SPEC-023 — Client web: Ajustes (configuração, cartões e exportação)

## Objetivo
Dar ao web as telas de **Ajustes** do app: configuração financeira, cartões de crédito (limite, faturas
e compras) e exportação dos dados, com as mesmas regras do mobile (núcleo compartilhado) e sem sync.
Primeira entrega do P1 (CLIENT-017/018 do plano); a política de privacidade já existia.

## Docs relacionados
[client-web-plan](../docs/architecture/client-web-plan.md) · [SPEC-022](SPEC-022-client-web-mvp.md) ·
[ADR-020](../adr/ADR-020-client-web-stack-e-integracao.md) · [ADR-022](../adr/ADR-022-nucleo-compartilhado-packages-core.md) ·
[contracts](../docs/architecture/contracts.md) · [business-rules](../docs/business/business-rules.md)

## Requisitos relacionados
RF-01, RF-02, RF-12, RF-17, RF-19, RF-22, RF-23, RF-24, RF-26 · BR-FIN-018, BR-FIN-019, BR-FIN-024, BR-FIN-025/026/028/029, BR-FIN-033/034, BR-ACC-004.

## Regras
- Mesmo princípio da SPEC-022: toda escrita passa por um caso de uso do núcleo (`saveConfig`,
  `saveCreditCard`, `setCreditCardActive`, `deleteCreditCard`, `payStatement`, `addStatementCharges`,
  `undoStatementPayment`, `updateCardPurchase`, `deleteCardPurchase`, `addExistingCardDebt`, `addExistingCardDebts`); só os registros alterados são gravados.
- `/ajustes`: atalhos para Configuração financeira, Cartões, Exportar e Política de privacidade. "Conta e
  sincronização" não existe no web (sem sync; o menu da conta já tem "Sair").
- **Configuração** (`/ajustes/configuracao`): fontes de renda (nome, valor, dia 1–28, ativa), meta de
  economia, despesas fixas e parcelamentos fora do cartão (ativar/desativar). As categorias personalizadas
  não mudam aqui (como no app). Plano acima da renda pede confirmação.
- **Cartões** (`/ajustes/cartoes`, `/:id`): cadastrar, editar, ativar/desativar e excluir (só sem compras);
  detalhe com limite comprometido/disponível, faturas (atual, próxima, futuras, quitadas no ciclo), pagar
  total ou parcial, juros/multa, desfazer lançamento do ciclo ativo, peso por ciclo e compras (editar/excluir
  quando o núcleo permite, BR-FIN-029). O limite do cartão nunca é dinheiro disponível.
- **Exportar** (`/ajustes/exportar`): baixa o JSON do app (`buildExportPayload`, núcleo), sem dados de
  sessão (BR-ACC-004). Só lê; o arquivo vive no `Blob`, sem armazenamento do navegador.
- **Compras anteriores ao app** (`/ajustes/cartoes/:id/compras-anteriores`): situação inicial do cartão como no
  app (fatura em aberto ou parcelamento em andamento, BR-FIN-027/032), por `addExistingCardDebt`; as contas
  puras vivem no núcleo (`card-debt`) e o app as usa também. Acesso pelo detalhe do cartão e ao cadastrar um
  cartão novo. Em "Parcelamento em andamento" (app e web) há **cadastro em lote**: itens vão para uma lista e
  "Salvar tudo" grava todos juntos por `addExistingCardDebts`, tudo ou nada.
- Fora do escopo desta entrega: registrar compra nova no cartão pelo web, CSV de gastos, abrir/fechar ciclo,
  pagar fixa e renda avulsa.

## Critérios de aceite
- Telas acessíveis pela sidebar ("Ajustes") e com os mesmos números do app para a mesma fixture.
- Falha de gravação não altera a tela; erros do núcleo aparecem na tela.
- `verify` de core, app e client verdes; `docs:check` limpo.

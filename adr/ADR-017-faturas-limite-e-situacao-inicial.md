# ADR-017 — Faturas pelo vencimento, limite do cartão e situação inicial

- **Status:** ACCEPTED · **Fase:** F3 (evolução) · **Data:** 2026-10-03
- **Atualizada por:** [ADR-018](ADR-018-pagamento-parcial-e-total-da-fatura.md) (vários lançamentos por fatura,
  pagamento parcial, encargos separados e restante transportado; substitui o item 3 e o id determinístico / índice
  único do item 8).
- **Substitui em parte:** [ADR-014](ADR-014-cartoes-de-credito.md) ("o vencimento é informativo; o ciclo vem do
  fechamento") e [ADR-015](ADR-015-pagamento-de-fixas-e-renda-avulsa.md) ("fixa pendente não reserva saldo").
- **Atualiza:** [ADR-003](ADR-003-persistencia-local.md) (documento v7), [ADR-004](ADR-004-sincronizacao.md)
  (nova tabela `statement_payments`), [ADR-008](ADR-008-modelo-de-dados-e-consistencia.md) e
  [ADR-013](ADR-013-fontes-de-renda.md) (fonte ativa/inativa).

## Contexto

A visão de produto passa a responder "quanto posso gastar hoje **e continuar atingindo minha meta
financeira?**". Para isso o app precisa:

- tratar o cartão como compromisso futuro: a compra entra numa fatura e a fatura sai do dinheiro no
  **vencimento**, não no fechamento (ADR-014 usava o fechamento e tratava o vencimento como informativo);
- mostrar o **limite do cartão** sem confundi-lo com dinheiro disponível;
- aceitar a **situação inicial** de quem já chega com fatura aberta e parcelamentos em curso;
- permitir **desativar** cartões, fontes de renda e despesas fixas sem apagar o histórico;
- reservar as despesas fixas ainda não pagas, para o limite diário do começo do ciclo não ficar
  inflado (ADR-015 deixava a fixa pendente fora do saldo).

## Opções consideradas

| Tema | Opção | Prós | Contras |
|---|---|---|---|
| Fatura | Gravar a fatura como entidade (valor, status) | Consulta direta | Duplica o que as compras já dizem; conflito de sync entre fatura e compras |
| | **Fatura derivada das compras; só o pagamento é gravado** | Uma fonte de verdade; nada a reconciliar | Recalcula a cada leitura (barato: poucas compras por usuário) |
| Ciclo da fatura | Ciclo do fechamento (ADR-014) | Já implementado | A fatura pesa antes de o dinheiro sair; cartões que vencem no mês seguinte ficam errados |
| | **Ciclo que contém o vencimento** | Fiel ao fluxo de caixa | Exige gravar a fatura da compra (`firstStatementKey`) |
| Liberar o limite | Automático no vencimento | Sem ação do usuário | Mente quando a fatura não foi paga; esconde juros |
| | **Botão "Paguei a fatura"** | Reflete o que aconteceu; captura juros por atraso | Depende do usuário marcar |
| Situação inicial | Lançar compras antigas com datas retroativas | Reaproveita o formulário | Datas fora do ciclo ativo quebram BR-FIN-011; parcelas pagas pesariam de novo |
| | **Compra "anterior ao app" com `settledInstallments`** | Agenda futura correta; parcelas pagas não pesam | Compra sintética (data = fechamento da 1ª fatura) |
| Fixa pendente | Não reservar (ADR-015) | Simples | Limite diário alto no começo do ciclo |
| | **Reservar pendentes ativas no saldo do ciclo** | Limite diário realista desde o 1º dia | Muda o saldo de ciclos ativos existentes (migração) |

## Decisão

1. **Fatura derivada (BR-FIN-025).** A compra entra na fatura do primeiro fechamento em ou depois da
   data (no dia do fechamento = mesma fatura). A chave da fatura é o `yyyy-MM` do mês de fechamento. O
   vencimento é o próximo `dueDay` depois do fechamento (mesmo mês se `dueDay > closingDay`; senão, o
   mês seguinte). A fatura pertence ao **ciclo que contém o vencimento**, nunca antes do ciclo ativo.
   `buildCardStatements` monta as faturas a partir das compras; status `open` (até o fechamento),
   `closed` (até o vencimento), `overdue` (depois) ou `paid`.
2. **Chaves congeladas na compra (BR-FIN-028).** `firstStatementKey` e `firstCycleKey` são gravados na
   compra; a parcela *n* fica na fatura e no ciclo `chave + (n − 1)` meses. Mudar fechamento,
   vencimento ou dia de pagamento vale só para compras novas.
3. **Limite (BR-FIN-026).** `credit_limit` opcional (centavos, `null` = não informado). Comprometido =
   parcelas em aberto em faturas **não pagas**, inclusive futuras; disponível = limite − comprometido
   (pode ficar negativo: o app avisa e não bloqueia). O limite só é liberado por **"Paguei a fatura"**
   (`payStatement`), permitido para fatura fechada. Depois do vencimento o usuário informa o valor pago
   (≥ valor da fatura); a diferença são **juros, que pesam no ciclo ativo do pagamento**. Um pagamento
   vigente por fatura; desfazer só no ciclo ativo.
4. **Situação inicial (BR-FIN-027).** `addExistingCardDebt` cadastra fatura em aberto (1 de 1) ou
   parcelamento existente (valor da parcela, total, restantes e fatura da próxima parcela, ainda não
   vencida). As parcelas já pagas viram `settledInstallments`: não pesam no orçamento nem no limite. A
   compra é marcada `origin = 'existing'` e só muda descrição e categoria.
5. **Ativo/inativo.** Cartão (`active`), fonte de renda e despesa fixa (`active?`, ausente = ativa).
   Cartão com compras não é excluído, é desativado: some do formulário de compra e as parcelas
   continuam valendo. Fonte inativa não soma nem define o dia do ciclo (exige ao menos uma ativa).
   Fixa inativa não reserva, não aparece como pendente, não pode ser paga e não avança parcelas.
6. **Reserva de fixas pendentes (BR-FIN-004, sobrepõe a ADR-015).** Saldo base = renda (fontes
   ativas) + rendas avulsas − fixas pagas à vista − fixas ativas pendentes − meta. Pagar à vista não
   muda o saldo (já estava reservado); pagar no crédito tira a reserva e joga o valor para as faturas.
   Saldo inicial = base − dívida herdada − parcelas de cartão do ciclo − juros de faturas pagas com
   atraso no ciclo (BR-FIN-005). O saldo inicial do ciclo ativo é **derivado**: recalculado a cada
   escrita, **ao carregar o app** (`loadAppData`, que grava se mudou) e **ao fim de cada sync**, depois
   dos pulls (`runSync` → `recalculateActiveCycleBalance`).
7. **Documento local v7** (`migrateV6ToV7`): cartões ganham `creditLimit: null` e `active: true`;
   compras ganham `firstStatementKey` (derivada da data e do fechamento) e `settledInstallments: 0`
   (o `firstCycleKey` não muda); nasce o cursor `statement_payments`. Cartões, compras e ciclos **não**
   ficam pendentes de envio (o servidor aceita as colunas novas nulas e o mapper deriva
   `first_statement_key`). Faturas que **já tinham vencido** na data da migração ganham um pagamento
   sintético sem juros (id determinístico, preso ao ciclo ativo ou ao último ciclo), para não aparecerem
   vencidas nem prenderem o limite — só esses pagamentos ficam `dirty`. A migração **não mexe no saldo**:
   a reserva das fixas pendentes entra pelo recálculo ao carregar (item 6).
8. **Remoto, contrato v1 aditivo.** Migration `20261004000000_card_limits_and_statements.sql`:
   `credit_cards.credit_limit`/`active`, `card_purchases.first_statement_key`/`settled_installments`/`origin`,
   `fixed_expenses.active` e a tabela **`statement_payments`** (RLS, exclusão lógica, índice único de
   um pagamento vigente por `(user_id, card_id, statement_key)`, `paid_amount ≥ statement_amount`).
   `SYNC_TABLES` ganha `statement_payments` por último. O pagamento de fatura tem **id determinístico**
   `statement-<cardId>-<yyyy-MM>` (`statementPaymentId`): dois aparelhos que pagam a mesma fatura convergem
   no mesmo registro (LWW) em vez de violar o índice único, e pagar de novo depois de desfazer reaproveita o
   registro. Ao adotar o ciclo ativo remoto (ADR-004 §4), gastos, pagamentos de fixas, rendas avulsas e
   pagamentos de fatura do ciclo local duplicado são movidos para o ciclo adotado. Linhas antigas sem `first_statement_key`
   derivam a fatura da data e do fechamento do cartão local.
9. **Projeção (BR-FIN-031).** `projectCycles` estima os próximos ciclos só com o que já é conhecido:
   renda (ativas) − meta − fixas ativas − parcelas de cartão = "livre antes de novos gastos".

## Trade-offs e consequências

- Ao atualizar para a v7, o recálculo ao carregar **reduz** o saldo do ciclo ativo existente no total
  das fixas pendentes; o limite diário cai na hora e deixa de cair a cada pagamento à vista.
- Faturas vencidas antes da v7 são consideradas pagas sem juros (não havia "Paguei a fatura"); se o
  usuário não as pagou de fato, ele desfaz no ciclo ativo e paga com o valor real.
- **Limitação conhecida (ciclo antecipado):** a fatura é mapeada para o ciclo pela chave mensal do ciclo
  (`yyyy-MM` do início). Num ciclo antecipado ("Já recebi"), uma fatura cujo vencimento cai entre o início
  antecipado e o dia de pagamento natural pode ficar um ciclo à frente nas parcelas seguintes, e faturas
  de compras do ciclo anterior com vencimento nessa janela continuam no ciclo fechado. Corrigir exige
  mapear datas pelos ciclos reais (evolução futura).
- Compras feitas antes desta versão mantêm o `firstCycleKey` antigo (ciclo do fechamento); só compras
  novas usam o ciclo do vencimento. Não há reescrita de histórico.
- "Paguei a fatura" depende do usuário: sem ele o limite continua comprometido, mesmo depois do
  vencimento (é o comportamento desejado; o app lista a fatura como vencida em próximos compromissos).
- Juros por atraso pesam no ciclo em que o pagamento foi marcado, não no ciclo do vencimento.
- A compra da situação inicial é sintética (`purchaseDate` = fechamento da 1ª fatura) e só aceita
  mudança de descrição e categoria.
- A projeção ignora dívida herdada, juros futuros e gastos variáveis: é um piso de compromissos,
  não uma previsão de saldo.
- `card_id` e `cycle_id` em `statement_payments` têm FK (diferente de `fixed_payments`): o push envia
  `statement_payments` depois de `credit_cards` e `cycles`.

---
id: business.rules
type: rule
module: business
title: Regras de negócio
summary: >
  Catálogo canônico das regras de negócio BR-FIN-* do domínio financeiro, com origem no código.
code:
  - src/domain/financial/financial.calculations.ts
  - src/domain/financial/credit-card.ts
  - src/domain/financial/projection.ts
  - src/application/cycle.use-cases.ts
  - src/application/card.use-cases.ts
  - src/application/selectors.ts
  - src/infrastructure/sync/sync-engine.ts
last_verified_commit: c47cf18+T-025r4
---

# Regras de negócio

Fonte canônica das regras `BR-*`. Todas estão **vigentes** no código desde a F5. A coluna Origem
aponta o símbolo que implementa cada regra.

## Domínio financeiro (`BR-FIN`)

| ID | Regra | Status | Origem |
|---|---|---|---|
| BR-FIN-001 | Todo valor monetário é armazenado e calculado em **centavos inteiros** (BRL). Não há ponto flutuante em cálculos de domínio. | vigente | `MoneyCents` em `financial.types.ts` |
| BR-FIN-002 | O ciclo financeiro começa no **dia de pagamento** (1–28; padrão 7; da fonte de maior valor, BR-FIN-024) e termina no dia anterior ao dia de pagamento do mês seguinte. | vigente | `calculateDefaultCycleStartDate`, `calculateCycleEndDate` |
| BR-FIN-003 | **Recebimento antecipado:** antes do dia de pagamento, o usuário pode declarar "Já recebi". O ciclo ativo é fechado na véspera com os gastos anteriores; os demais migram para um novo ciclo que começa na data de recebimento e termina na data de fim padrão do mês seguinte. | vigente | `receiveIncomeEarly` |
| BR-FIN-004 | **Saldo base** = renda mensal (soma das fontes **ativas**, BR-FIN-018) + rendas avulsas do ciclo (BR-FIN-023) − **despesas fixas do ciclo** − meta de economia. Fixas do ciclo = pagas à vista + **ativas ainda pendentes (reservadas)**, só as com valor no ciclo (parcelamento quitado não reserva); na abertura do ciclo a reserva usa as parcelas já avançadas. Fixa paga no crédito pesa só pela fatura (BR-FIN-022). Pagar à vista não muda o saldo (já estava reservado); pagar no crédito tira a reserva. Fixa inativa não reserva. | vigente (altera a SPEC-014 e sobrepõe parte da ADR-015; ADR-017, SPEC-018) | `calculateBaseAvailableAmount`, `selectPendingFixedExpenses`, `selectCycleAdjustments` |
| BR-FIN-005 | **Saldo inicial do ciclo** = saldo base − dívida herdada − parcelas de cartão do ciclo (BR-FIN-025) − **juros de faturas pagas com atraso no ciclo** (BR-FIN-026); No ciclo ativo é **derivado**: recalculado a cada escrita (pagar fixas ou faturas, lançar rendas, mudar compras, salvar a configuração), **ao carregar o app** e **ao fim de cada sync**, depois dos pulls. | vigente (ADR-017) | `calculateInitialAvailableAmount`, `recalculateActiveCycleBalance`, `selectCycleStatementInterest`, `runSync` |
| BR-FIN-006 | **Dívida herdada** = valor absoluto do saldo final do último ciclo fechado, se negativo. **Superávit não é transferido** para o ciclo seguinte. | vigente | `calculatePreviousMonthDebt` |
| BR-FIN-007 | **Limite diário do dia D** = trunc((saldo inicial − gastos com data anterior a D) ÷ dias restantes do ciclo, incluindo D). Se não restam dias, o limite é o próprio saldo restante. | vigente | `calculateDailyLimitForDate` |
| BR-FIN-008 | **Saldo do dia** = limite diário do dia − total gasto no dia. | vigente | `calculateTodayBalance` |
| BR-FIN-009 | **Status do dia:** `negative` se saldo < 0; `healthy` se saldo > 50% do limite; `warning` se > 15%; `critical` caso contrário. Com limite ≤ 0, o percentual é 1 (saldo ≥ 0) ou −1. | vigente | `calculateDayStatus` |
| BR-FIN-010 | **Parcelamento:** a parcela conta como despesa fixa enquanto houver parcelas restantes. A primeira parcela pertence ao ciclo em que o parcelamento é ativado; a cada abertura de novo ciclo, as parcelas restantes diminuem em 1. Parcelamento **inativo** fica pausado (não começa nem avança; ADR-017). | vigente | `advanceInstallments`, `startPendingInstallments` |
| BR-FIN-011 | Um gasto só pode ser criado, editado ou excluído com data **dentro do ciclo ativo**. | vigente | `assertDateWithinCycle`, `findEditableExpense` |
| BR-FIN-012 | Categoria vazia é normalizada para **"Outros"**. Categorias disponíveis = padrão + personalizadas, sem duplicatas e ordenadas em pt-BR. | vigente | `normalizeCategory`, `getAvailableCategories` |
| BR-FIN-013 | Existe **no máximo um ciclo ativo** por usuário. | vigente | `openCycle` + índice `cycles_one_active_per_user` |
| BR-FIN-014 | Alterar a configuração com ciclo ativo **recalcula o saldo inicial** do ciclo ativo, preservando a dívida herdada. | vigente | `saveConfig` |
| BR-FIN-015 | Plano (fixos + meta) acima da renda é permitido somente após **confirmação explícita** do usuário. | vigente | `ConfigScreen.onSubmit` |
| BR-FIN-016 | O recebimento antecipado só é permitido **uma vez por ciclo** e com data **posterior ao início** do ciclo ativo. Isso impede ciclo vazio e avanço duplo de parcelas. | vigente (corrige DEF-001) | `canReceiveIncomeEarlyForCycle` |
| BR-FIN-017 | Um ciclo novo **nunca se sobrepõe** ao período de um ciclo fechado. O fechamento manual só é permitido **depois do fim do período**; antes disso, o caminho é o recebimento antecipado. Se o início padrão cair dentro de um ciclo fechado (dados legados), o novo ciclo começa no dia seguinte ao fim dele. | vigente (corrige DEF-006) | `canCloseCycle`, `calculateNextCycleStartDate` |
| BR-FIN-018 | A renda mensal é a **soma das fontes de renda ativas** (nome + valor > 0; `active` ausente = ativa). É obrigatória ao menos **uma fonte ativa**, cada uma com seu dia de pagamento (BR-FIN-024). Fonte inativa não soma. Documentos e linhas remotas antigos viram uma fonte "Renda". | vigente (SPEC-012, SPEC-017) | `saveConfig`, `calculateIncomeTotal`, `isActive`, `legacyIncomeSources` |
| BR-FIN-019 | **Compra no crédito:** a fatura que recebe a compra é a do primeiro **fechamento do cartão em ou depois da data da compra** (até o dia de fechamento = fatura do mês; depois = do mês seguinte); as demais parcelas, uma por fatura seguinte. As parcelas do ciclo **reduzem o saldo inicial** (BR-FIN-005). ~~A 1ª parcela cai no ciclo que contém o fechamento; o vencimento é informativo.~~ **Trecho de ciclo substituído pela BR-FIN-025** (ciclo do vencimento). | vigente (SPEC-013; ciclo substituído pela BR-FIN-025) | `statementKeyForDate`, `calculateCardChargesForCycle`, `addCardPurchase` |
| BR-FIN-020 | **Valor da compra no crédito:** o valor informado é o **total já com juros**, dividido em parcelas iguais de centavos inteiros (os centavos que sobram vão para as primeiras parcelas). Cartão com compras vigentes não pode ser excluído (deve ser desativado, BR-FIN-028); alteração de compra segue a BR-FIN-029 (histórico imutável). | vigente (SPEC-013) | `splitInstallments`, `deleteCreditCard`, `canModifyCardPurchase` |
| BR-FIN-021 | **Pagamento de despesa fixa:** todo ciclo lista as despesas fixas **ativas** (e a parcela do mês dos parcelamentos) como pendentes — e reservadas no saldo (BR-FIN-004). Ao pagar, escolhe-se **À vista** (gravado `cash`; `pix`/`debit` seguem válidos em dados antigos) ou **Cartão de crédito**. À vista confirma a saída já reservada; no crédito o valor sai da reserva e vai para as faturas. Fixa inativa não pode ser paga. Cada despesa tem no máximo **um pagamento vigente por ciclo**; o pagamento pode ser desfeito enquanto o ciclo está ativo. | vigente (SPEC-014, SPEC-018) | `payFixedExpense`, `undoFixedPayment`, `calculatePaidFixedAmount` |
| BR-FIN-022 | **Fixa paga no crédito:** o app pede cartão, parcelas e os **juros cobrados em R$**; vira uma compra no cartão de `valor + juros` (BR-FIN-019/020). O crédito **não desconta à vista**: quem desconta são as parcelas nos ciclos das faturas. Desfazer remove também a compra. | vigente (SPEC-014) | `payFixedExpense`, `buildCardPurchase` |
| BR-FIN-023 | **Renda avulsa:** entrada extra lançada no ciclo ativo (nome, valor > 0, data dentro do ciclo) que **soma ao saldo disponível** do ciclo; pode ser excluída enquanto o ciclo está ativo. | vigente (SPEC-014) | `addExtraIncome`, `deleteExtraIncome`, `calculateExtraIncomeTotal` |
| BR-FIN-024 | **Dia de pagamento por fonte:** cada fonte de renda tem o seu dia (1–28). O ciclo financeiro (BR-FIN-002) usa o dia da **fonte ativa de maior valor** (empate: a primeira da lista); `settings.payday` é derivado disso. Os dias das demais fontes são informativos; fonte inativa não define o ciclo. Mudar fontes vale a partir do próximo ciclo. | vigente (SPEC-015, SPEC-017) | `calculatePrimaryPayday`, `calculatePrimaryIncomeSource`, `saveConfig` |
| BR-FIN-025 | **Fatura e ciclo da compra:** a compra entra na fatura do 1º fechamento **em ou depois** da data (no dia do fechamento = mesma fatura). Fatura = chave `yyyy-MM` do mês de fechamento. **Vencimento** = próximo `dueDay` após o fechamento (mesmo mês se `dueDay > closingDay`; senão, mês seguinte). A fatura pertence ao **ciclo que contém o vencimento**, nunca antes do ciclo ativo. Compra → fatura → ciclo. `firstStatementKey` e `firstCycleKey` são gravados na compra (congelados); a parcela *n* fica em `chave + (n − 1)` meses. Status: aberta até o fechamento, fechada até o vencimento, vencida depois, paga com pagamento vigente. | vigente (SPEC-016, ADR-017) | `statementKeyForDate`, `statementDueDate`, `statementCycleKey`, `calculateFirstCycleKey`, `buildCardStatements`, `listInstallments` |
| BR-FIN-026 | **Limite do cartão:** `creditLimit` em centavos (`null` = não informado). **Comprometido** = soma das parcelas em aberto (não quitadas antes do cadastro) em faturas **não pagas**, inclusive futuras; **disponível** = limite − comprometido (negativo = estouro, só aviso; a compra não é bloqueada). O limite só é liberado por **"Paguei a fatura"**, permitido para fatura fechada ou vencida: até o vencimento (inclusive) paga o valor da fatura; depois, exige `paidAmount ≥ valor` e os **juros** (`paidAmount − valor`) são descontados do **ciclo ativo** do pagamento. Um pagamento vigente por fatura, com **id determinístico** `statement-<cardId>-<yyyy-MM>` (aparelhos diferentes convergem no mesmo registro; pagar de novo depois de desfazer reaproveita o registro); desfazer só no ciclo ativo. Compra retroativa em fatura já paga e fechada é recusada. Limite do cartão **nunca** é dinheiro disponível para gastar. | vigente (SPEC-016, ADR-017) | `calculateCardLimitUsage`, `payStatement`, `undoStatementPayment`, `calculateStatementInterest`, `statementPaymentId`, `buildCardPurchase` |
| BR-FIN-027 | **Situação inicial:** `addExistingCardDebt` cadastra fatura em aberto (1 de 1) ou parcelamento existente (valor da parcela, total, restantes e fatura da próxima parcela, ainda não vencida e até 12 faturas à frente). A compra é gravada com `origin = 'existing'`. Parcelas já pagas = `settledInstallments`: **não pesam** no orçamento nem no limite. Gera a agenda futura (fatura e ciclo de cada parcela restante, nunca antes do ciclo ativo). | vigente (SPEC-017, ADR-017) | `addExistingCardDebt`, `listOpenInstallments`, `calculateInstallmentForCycle` |
| BR-FIN-028 | **Alterações no cartão:** mudar fechamento, vencimento ou dia de pagamento **não reescreve** compras registradas (chaves congeladas, BR-FIN-025); vale para compras novas. Se o fechamento for **aumentado** depois de a fatura ser paga, uma compra nova cuja chave cairia nessa fatura paga (ainda "aberta" pelo dia novo) vai para a **fatura seguinte**. Mudar o limite só muda o disponível. Cartão com compras não pode ser excluído: deve ser **desativado** (`active = false`) — some do formulário de compra e as parcelas continuam valendo. | vigente (SPEC-016/017, ADR-017) | `saveCreditCard`, `setCreditCardActive`, `deleteCreditCard`, `selectActiveCreditCards`, `buildCardPurchase` |
| BR-FIN-029 | **Edição, exclusão e estorno de compra no cartão:** permitidos enquanto **nenhum ciclo fechado** (fechado depois do cadastro da compra) tiver contado uma parcela dela e **nenhuma fatura paga** contiver parcela dela. A edição recalcula fatura e ciclo pela nova data (dentro do ciclo ativo). Compras da situação inicial (`origin = 'existing'`) só mudam descrição e categoria, independentemente da data. Mudar **só descrição e categoria** nunca recalcula a compra (funciona com cartão inativo ou data fora do ciclo ativo). Compra que veio de **fixa paga no crédito**: editar valor, parcelas ou data é bloqueado ("Desfaça o pagamento"); excluí-la exclui junto o pagamento da fixa, que volta a ficar pendente e reservada — bloqueado se o pagamento for de ciclo encerrado. | vigente (SPEC-016, ADR-017) | `canModifyCardPurchase`, `updateCardPurchase`, `deleteCardPurchase` |
| BR-FIN-030 | **Sem dupla contagem:** gasto à vista → dia (BR-FIN-007); despesa fixa → reserva do ciclo (à vista) ou fatura (crédito); compra no crédito → fatura → ciclo do vencimento; juros de atraso → ciclo do pagamento da fatura. Um compromisso nunca some do orçamento: excluir a compra de uma fixa paga no crédito devolve a fixa à reserva (BR-FIN-029). | vigente (SPEC-018, ADR-017) | `selectCycleAdjustments`, `calculateInitialAvailableAmount`, `deleteCardPurchase` |
| BR-FIN-031 | **Projeção dos próximos ciclos:** para cada ciclo futuro, **livre antes de novos gastos** = renda (fontes ativas) − meta − despesas fixas ativas (parcelamentos só enquanto restarem parcelas; não iniciado começa no próximo ciclo) − parcelas de cartão do ciclo. Pode ser negativo; não inclui dívida herdada, juros nem gastos variáveis. | vigente (SPEC-018, ADR-017) | `projectCycles`, `projectFixedExpenseAmount`, `selectCycleProjections` |

## Conta, dados e privacidade (`BR-ACC`)

| ID | Regra | Status |
|---|---|---|
| BR-ACC-001 | O app funciona **sem login** (modo local). O login é opcional e habilita o sync. | vigente |
| BR-ACC-002 | No primeiro login em um aparelho com dados locais, o usuário escolhe **enviar os dados locais** para a conta ou **substituí-los** pelos dados da nuvem. Nunca há descarte silencioso. | vigente |
| BR-ACC-003 | O usuário pode **excluir a conta e todos os dados na nuvem** de dentro do app (exigência da Apple e do Google). | vigente |
| BR-ACC-004 | O usuário pode **exportar** todos os dados em JSON a qualquer momento. | vigente |
| BR-ACC-005 | Um usuário só lê e escreve **os próprios dados**: isolamento por `user_id`, aplicado no servidor. | vigente |
| BR-ACC-006 | Nenhum dado financeiro é enviado a terceiros (analytics ou crash reporting) com valores ou descrições. | vigente |

## Sincronização (`BR-SYNC`)

| ID | Regra | Status |
|---|---|---|
| BR-SYNC-001 | Toda escrita acontece **primeiro localmente** e é enviada ao servidor quando houver conexão (offline-first). | vigente |
| BR-SYNC-002 | Conflito na mesma entidade é resolvido por **last-write-wins** no campo `updated_at` do servidor. Exclusões usam marcação (`deleted_at`) para propagar entre aparelhos. | vigente |
| BR-SYNC-003 | Operações de ciclo (abrir, fechar, receber antecipado) são **idempotentes** por ID gerado no cliente. | vigente |

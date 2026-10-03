---
id: business.rules
type: rule
module: business
title: Regras de negócio
summary: >
  Catálogo canônico das regras de negócio BR-FIN-* do domínio financeiro, com origem no código.
code:
  - src/domain/financial/financial.calculations.ts
  - src/application/cycle.use-cases.ts
  - src/infrastructure/sync/sync-engine.ts
last_verified_commit: c3d79fd
---

# Regras de negócio

Fonte canônica das regras `BR-*`. Todas estão **vigentes** no código desde a F5. A coluna Origem
aponta o símbolo que implementa cada regra.

## Domínio financeiro (`BR-FIN`)

| ID | Regra | Status | Origem |
|---|---|---|---|
| BR-FIN-001 | Todo valor monetário é armazenado e calculado em **centavos inteiros** (BRL). Não há ponto flutuante em cálculos de domínio. | vigente | `MoneyCents` em `financial.types.ts` |
| BR-FIN-002 | O ciclo financeiro começa no **dia de pagamento** (configurável, 1–28; padrão 7) e termina no dia anterior ao dia de pagamento do mês seguinte. | vigente | `calculateDefaultCycleStartDate`, `calculateCycleEndDate` |
| BR-FIN-003 | **Recebimento antecipado:** antes do dia de pagamento, o usuário pode declarar "Já recebi". O ciclo ativo é fechado na véspera com os gastos anteriores; os demais migram para um novo ciclo que começa na data de recebimento e termina na data de fim padrão do mês seguinte. | vigente | `receiveIncomeEarly` |
| BR-FIN-004 | **Saldo base** = renda mensal (soma das fontes, BR-FIN-018) − despesas fixas ativas − meta de economia. | vigente | `calculateBaseAvailableAmount` |
| BR-FIN-005 | **Saldo inicial do ciclo** = saldo base − dívida herdada. | vigente | `calculateInitialAvailableAmount` |
| BR-FIN-006 | **Dívida herdada** = valor absoluto do saldo final do último ciclo fechado, se negativo. **Superávit não é transferido** para o ciclo seguinte. | vigente | `calculatePreviousMonthDebt` |
| BR-FIN-007 | **Limite diário do dia D** = trunc((saldo inicial − gastos com data anterior a D) ÷ dias restantes do ciclo, incluindo D). Se não restam dias, o limite é o próprio saldo restante. | vigente | `calculateDailyLimitForDate` |
| BR-FIN-008 | **Saldo do dia** = limite diário do dia − total gasto no dia. | vigente | `calculateTodayBalance` |
| BR-FIN-009 | **Status do dia:** `negative` se saldo < 0; `healthy` se saldo > 50% do limite; `warning` se > 15%; `critical` caso contrário. Com limite ≤ 0, o percentual é 1 (saldo ≥ 0) ou −1. | vigente | `calculateDayStatus` |
| BR-FIN-010 | **Parcelamento:** a parcela conta como despesa fixa enquanto houver parcelas restantes. A primeira parcela pertence ao ciclo em que o parcelamento é ativado; a cada abertura de novo ciclo, as parcelas restantes diminuem em 1. | vigente | `advanceInstallments`, `startPendingInstallments` |
| BR-FIN-011 | Um gasto só pode ser criado, editado ou excluído com data **dentro do ciclo ativo**. | vigente | `assertDateWithinCycle`, `findEditableExpense` |
| BR-FIN-012 | Categoria vazia é normalizada para **"Outros"**. Categorias disponíveis = padrão + personalizadas, sem duplicatas e ordenadas em pt-BR. | vigente | `normalizeCategory`, `getAvailableCategories` |
| BR-FIN-013 | Existe **no máximo um ciclo ativo** por usuário. | vigente | `openCycle` + índice `cycles_one_active_per_user` |
| BR-FIN-014 | Alterar a configuração com ciclo ativo **recalcula o saldo inicial** do ciclo ativo, preservando a dívida herdada. | vigente | `saveConfig` |
| BR-FIN-015 | Plano (fixos + meta) acima da renda é permitido somente após **confirmação explícita** do usuário. | vigente | `ConfigScreen.onSubmit` |
| BR-FIN-016 | O recebimento antecipado só é permitido **uma vez por ciclo** e com data **posterior ao início** do ciclo ativo. Isso impede ciclo vazio e avanço duplo de parcelas. | vigente (corrige DEF-001) | `canReceiveIncomeEarlyForCycle` |
| BR-FIN-017 | Um ciclo novo **nunca se sobrepõe** ao período de um ciclo fechado. O fechamento manual só é permitido **depois do fim do período**; antes disso, o caminho é o recebimento antecipado. Se o início padrão cair dentro de um ciclo fechado (dados legados), o novo ciclo começa no dia seguinte ao fim dele. | vigente (corrige DEF-006) | `canCloseCycle`, `calculateNextCycleStartDate` |
| BR-FIN-018 | A renda mensal é a **soma de uma ou mais fontes de renda** (nome + valor > 0). É obrigatória ao menos uma fonte. Documentos e linhas remotas antigos viram uma fonte "Renda". | vigente (SPEC-012) | `saveConfig`, `calculateIncomeTotal`, `legacyIncomeSources` |

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

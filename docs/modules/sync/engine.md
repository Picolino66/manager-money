---
id: sync.engine
type: integration
module: sync
title: Motor de sincronização
summary: >
  Push de registros sujos em ordem de dependência, pull incremental com janela de 5 s, LWW por
  registro e resolução de conflito de ciclo ativo concorrente.
keywords: [sync, sincronizar, offline, conflito, outbox, supabase]
code:
  - app/src/infrastructure/sync/sync-engine.ts
  - app/src/infrastructure/sync/supabase-remote.ts
  - packages/core/src/contract/mappers.ts
  - packages/core/src/contract/types.ts
  - packages/core/src/contract/dirty.ts
  - packages/core/src/contract/errors.ts
  - app/src/store/financial.store.ts
symbols: [runSync, collectDirty, acknowledge, applyRemoteRows, adoptRemoteActiveCycle, mapSupabaseError, scheduleSync, statementPaymentFromRow, cardPurchaseFromRow, cycleFromRow]
business_rules: [BR-SYNC-001, BR-SYNC-002, BR-SYNC-003, BR-FIN-013]
adrs: [ADR-004, ADR-008, ADR-017, ADR-018]
tests: [packages/core/src/contract/dirty.test.ts, app/src/infrastructure/sync/sync-engine.test.ts, app/src/infrastructure/sync/supabase-remote.test.ts, packages/core/src/contract/mappers.test.ts]
last_verified_commit: 3b9bf25+T-033
---

# Motor de sincronização

Spec: [SPEC-006](../../../specs/SPEC-006-sync.md) · contrato: [contracts](../../architecture/contracts.md).

- **Push:** settings → fixed_expenses → credit_cards → cycles (fechados antes de ativos) → expenses → card_purchases → fixed_payments → extra_incomes
  → **statement_payments** (FKs para cartão e ciclo, ADR-017); ack só limpa registros que não mudaram durante o envio.
- **Recálculo:** depois dos pulls, `runSync` chama `recalculateActiveCycleBalance` — o saldo do ciclo ativo é
  derivado e passa a refletir o que chegou de outros aparelhos (BR-FIN-005).
- **Pull:** por tabela, `server_updated_at > cursor − 5 s`, paginado (500); registro local sujo não é
  sobrescrito; linha excluída desconhecida não é inserida.
- **Conflito 23505** (ciclo ativo): pull de ciclos, adota o remoto, move para ele os gastos, pagamentos de fixas,
  rendas avulsas e pagamentos de fatura do ciclo local duplicado e exclui o local; 1 retry.
- **Lançamentos de fatura (ADR-018):** vários por fatura, id gerado no cliente; o índice único da ADR-017 foi
  removido. Dois aparelhos que registram o mesmo pagamento offline geram dois lançamentos: o amortizado é limitado
  ao principal (o limite nunca é liberado a mais) e o pagamento não mexe no orçamento; o usuário desfaz o duplicado.
- **Gatilhos:** escrita (+2 s), abertura, primeiro plano, reconexão; backoff 2 s → 60 s.
- Commits do sync são descartados se a conta mudar durante a rede.
- **Contrato v1 aditivo (ADR-017):** `credit_cards.credit_limit`/`active`, `card_purchases.first_statement_key`/`settled_installments`/`origin`,
  `fixed_expenses.active` e `income_sources[].active`. Linha antiga sem `first_statement_key` deriva a fatura da data e do
  fechamento do cartão local (`cardPurchaseFromRow`); sem `active` = ativo; sem `settled_installments` = 0.
- **Contrato v1 aditivo (ADR-018):** `card_purchases.kind`/`included_in_balance`, `statement_payments.charges` (nulável e sem default no
  servidor: linha sem `charges` ou nula → `max(0, paid − statement)`), `cycles.carried_statement_debt`/`carried_statements` (jsonb com
  `card_id`/`statement_key`/`amount`; 0 e `[]` no remoto = ausente no local).
- `replaceRemoteWithLocal` marca `statement_payments` como excluídas primeiro (ordem inversa das dependências).
- Testes com `MemoryRemote` (`app/src/infrastructure/sync/memory-remote.ts`) que reproduz RLS, cursor e índice único.

## Núcleo compartilhado (ADR-022)

`collectDirty`, `acknowledge` e `mapSupabaseError` moram em `packages/core/src/contract/` desde a
extração do núcleo: o sync importa de lá, e o client web usa as mesmas funções para gravar na hora só
os registros que o caso de uso marcou `dirty` (sem outbox). `markAllClean` (só usado pelo web) zera as
marcações depois de ler o estado do servidor.

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
  - src/infrastructure/sync/sync-engine.ts
  - src/infrastructure/sync/supabase-remote.ts
  - src/infrastructure/sync/mappers.ts
  - src/infrastructure/sync/types.ts
  - src/store/financial.store.ts
symbols: [runSync, collectDirty, acknowledge, applyRemoteRows, adoptRemoteActiveCycle, mapSupabaseError, scheduleSync, statementPaymentToRow, statementPaymentFromRow, cardPurchaseFromRow]
business_rules: [BR-SYNC-001, BR-SYNC-002, BR-SYNC-003, BR-FIN-013]
adrs: [ADR-004, ADR-008, ADR-017]
tests: [src/infrastructure/sync/sync-engine.test.ts, src/infrastructure/sync/supabase-remote.test.ts, src/infrastructure/sync/mappers.test.ts]
last_verified_commit: c47cf18+T-025r4
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
- **Pagamento de fatura:** id determinístico `statement-<cardId>-<yyyy-MM>`; dois aparelhos que pagam a mesma
  fatura gravam o mesmo registro (LWW) e não violam o índice único.
- **Gatilhos:** escrita (+2 s), abertura, primeiro plano, reconexão; backoff 2 s → 60 s.
- Commits do sync são descartados se a conta mudar durante a rede.
- **Contrato v1 aditivo (ADR-017):** `credit_cards.credit_limit`/`active`, `card_purchases.first_statement_key`/`settled_installments`/`origin`,
  `fixed_expenses.active` e `income_sources[].active`. Linha antiga sem `first_statement_key` deriva a fatura da data e do
  fechamento do cartão local (`cardPurchaseFromRow`); sem `active` = ativo; sem `settled_installments` = 0.
- `replaceRemoteWithLocal` marca `statement_payments` como excluídas primeiro (ordem inversa das dependências).
- Testes com `MemoryRemote` (`src/infrastructure/sync/memory-remote.ts`) que reproduz RLS, cursor e índice único.

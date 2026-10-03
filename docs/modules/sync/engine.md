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
symbols: [runSync, collectDirty, acknowledge, applyRemoteRows, adoptRemoteActiveCycle, mapSupabaseError, scheduleSync]
business_rules: [BR-SYNC-001, BR-SYNC-002, BR-SYNC-003, BR-FIN-013]
adrs: [ADR-004, ADR-008]
tests: [src/infrastructure/sync/sync-engine.test.ts, src/infrastructure/sync/supabase-remote.test.ts, src/infrastructure/sync/mappers.test.ts]
last_verified_commit: 1e8ade5+T-019
---

# Motor de sincronização

Spec: [SPEC-006](../../../specs/SPEC-006-sync.md) · contrato: [contracts](../../architecture/contracts.md).

- **Push:** settings → fixed_expenses → credit_cards → cycles (fechados antes de ativos) → expenses → card_purchases; ack só limpa
  registros que não mudaram durante o envio.
- **Pull:** por tabela, `server_updated_at > cursor − 5 s`, paginado (500); registro local sujo não é
  sobrescrito; linha excluída desconhecida não é inserida.
- **Conflito 23505** (ciclo ativo): pull de ciclos, adota o remoto, move gastos e exclui o local; 1 retry.
- **Gatilhos:** escrita (+2 s), abertura, primeiro plano, reconexão; backoff 2 s → 60 s.
- Commits do sync são descartados se a conta mudar durante a rede.
- Testes com `MemoryRemote` (`src/infrastructure/sync/memory-remote.ts`) que reproduz RLS, cursor e índice único.

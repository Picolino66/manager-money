# ADR-004 — Sync offline-first com outbox e last-write-wins

- **Status:** ACCEPTED · **Fase:** F2 · **Data:** 2026-10-01

## Contexto

RF-14 exige sync entre aparelhos; RNF-02 exige funcionamento integral offline. Os volumes são
pequenos (dezenas de registros por dia por usuário). Conflitos reais são raros: um único usuário,
normalmente um aparelho ativo por vez.

## Opções consideradas

| Opção | Prós | Contras |
|---|---|---|
| Online-first (escrever direto no servidor) | Simples | Viola RNF-02 |
| **Outbox + pull incremental + LWW por registro** | Simples, previsível, testável | Edição concorrente do mesmo registro perde uma das versões |
| CRDT / motor de sync (PowerSync, WatermelonDB) | Merge rico | Dependência pesada; custo; excessivo para o volume |

## Decisão

1. Toda escrita local marca o registro com `updatedAt` (relógio do cliente) e `dirty: true`.
   Exclusões viram `deletedAt` (soft delete).
2. **Push:** registros sujos são enviados via `upsert` por tabela, em ordem de dependência
   (`settings` → `fixed_expenses` → `cycles` → `expenses`). O servidor grava `server_updated_at`
   por trigger. Ao confirmar, o registro fica `dirty: false`.
3. **Pull:** busca registros com `server_updated_at > cursor` por tabela e aplica localmente quando
   o registro local **não** está sujo. Registro sujo vence até ser enviado (LWW: o último push vence).
4. **Ciclo ativo único (BR-FIN-013) entre aparelhos:** um índice único parcial no servidor impede
   dois ciclos ativos. Se o push falhar por essa violação, o cliente adota o ciclo ativo do servidor,
   move os gastos do ciclo local duplicado para ele e marca o ciclo local como excluído.
5. **Gatilhos de sync:** abrir o app, voltar ao primeiro plano, reconectar e 2 s após cada escrita
   (debounce). Retentativa com backoff exponencial (2 s → 60 s).

## Trade-offs

- Edições simultâneas do mesmo gasto em dois aparelhos offline: a última enviada vence. Aceito, dado
  o perfil de uso.
- O relógio do cliente só ordena eventos locais. A ordem global vem do servidor.

## Consequências

- Porta `SyncRemote` em `src/infrastructure/sync/` com implementação Supabase e uma implementação
  em memória para testes.
- Métrica M6 instrumentada: sucesso ou falha de cada ciclo de sync.

## Relações

RF-14, RF-15, BR-SYNC-001..003, BR-FIN-013, ADR-003, ADR-008

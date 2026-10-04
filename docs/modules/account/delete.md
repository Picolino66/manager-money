---
id: account.delete
type: feature
module: account
title: Excluir conta
summary: >
  Exclusão definitiva da conta e de todos os dados na nuvem via RPC, com dupla confirmação;
  dados do aparelho continuam no modo local.
keywords: [excluir conta, apagar conta, lgpd, direito ao esquecimento]
code:
  - app/src/store/session.store.ts
  - app/src/infrastructure/sync/supabase-remote.ts
  - supabase/migrations/20261001000000_init.sql
symbols: [deleteAccount]
business_rules: [BR-ACC-003]
adrs: [ADR-005, ADR-006]
tests: [app/src/store/session.store.test.ts]
last_verified_commit: bfe9de6+T-028r2
---

# Excluir conta

Conta → Excluir conta → 2 confirmações → `rpc('delete_my_account')` (SECURITY DEFINER, apaga
`auth.users` em cascata). Falha → mensagem "Nada foi apagado" e nenhum estado local muda.

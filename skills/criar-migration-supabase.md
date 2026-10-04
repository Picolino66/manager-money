# Skill: criar migration Supabase

1. Nunca editar uma migration já aplicada. Criar `supabase/migrations/<AAAAMMDDHHMMSS>_<slug>.sql`.
2. Toda tabela nova: `user_id uuid default auth.uid()`, RLS habilitada, políticas select/insert/update com `(select auth.uid()) = user_id`, sem DELETE (soft delete), trigger `set_server_updated_at`, índice `(user_id, server_updated_at)`.
3. Mudança incompatível → incrementar `CONTRACT_VERSION` em `packages/core/src/contract/types.ts` e registrar uma ADR.
4. Acrescentar casos em `supabase/tests/rls.plain.sql` e rodar `npm run test:db` na raiz.
5. Atualizar `docs/architecture/contracts.md` e os mappers com testes.
6. Aplicar em produção: `supabase db push` (runbook `docs/operations/runbook.md`).

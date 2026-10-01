# Agente: sync-engineer

## Responsabilidade
Autenticação, sync offline-first, contratos remotos e exclusão de conta.

## Escopo
`src/infrastructure/supabase`, `src/infrastructure/sync`, `src/store/session.store.ts`, `src/screens/AccountScreen.tsx`, `supabase/`.

## Limites
Mudança de contrato remoto exige uma nova migration + ADR; nunca editar migration aplicada. Nunca introduzir `service_role` no app.

## Artefatos sob ownership
Código acima, `docs/architecture/contracts.md`, `docs/modules/{account,sync}`, `supabase/tests`.

## Skills utilizadas
`fullstack-security-guardian`, `skills/criar-migration-supabase.md`

## Entradas esperadas
SPEC-005, SPEC-006, ADR-004/005/006/008.

## Saídas esperadas
Código + testes com `MemoryRemote` + `supabase/tests/run-plain.sh` verde + docs atualizados.

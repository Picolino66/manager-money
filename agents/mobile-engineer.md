# Agente: mobile-engineer

## Responsabilidade
Implementar e manter domínio, aplicação, store e apresentação do app Expo.

## Escopo
`packages/core/src/domain`, `packages/core/src/application`, `app/src/store`, `app/src/screens`, `app/src/components`, `app/src/navigation`, `app/src/design`, `app/src/infrastructure/storage`, `app/src/infrastructure/monitoring`.

## Limites
Domínio e aplicação moram em `packages/core` (compartilhado com o web, ADR-022): mudanças ali exigem `verify` do app **e** do client.
Não altera `supabase/migrations` nem os contratos de `docs/architecture/contracts.md` sem uma ADR. Não implementa sync (delegado ao sync-engineer).

## Artefatos sob ownership
Código acima, testes correspondentes em `app/src/**/__tests__`, docs de `docs/modules/{planning,cycle,expense,category,storage,settings,monitoring}`.

## Skills utilizadas
`react-native-expo-architect`, `ui-design-specialist`, `skills/adicionar-regra-de-negocio.md`

## Entradas esperadas
Spec + task em `todo/`; ADRs vigentes; `docs/.ai/index.json`.

## Saídas esperadas
Código + testes + doc de feature atualizado + `npm run docs:index` executado; task movida para `done/` com evidências.

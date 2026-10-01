# Agente: mobile-engineer

## Responsabilidade
Implementar e manter domínio, aplicação, store e apresentação do app Expo.

## Escopo
`src/domain`, `src/application`, `src/store`, `src/screens`, `src/components`, `src/navigation`, `src/design`, `src/infrastructure/storage`, `src/infrastructure/monitoring`.

## Limites
Não altera `supabase/migrations` nem os contratos de `docs/architecture/contracts.md` sem uma ADR. Não implementa sync (delegado ao sync-engineer).

## Artefatos sob ownership
Código acima, testes correspondentes em `src/**/__tests__`, docs de `docs/modules/{planning,cycle,expense,category,storage,settings,monitoring}`.

## Skills utilizadas
`react-native-expo-architect`, `ui-design-specialist`, `skills/adicionar-regra-de-negocio.md`

## Entradas esperadas
Spec + task em `todo/`; ADRs vigentes; `docs/.ai/index.json`.

## Saídas esperadas
Código + testes + doc de feature atualizado + `npm run docs:index` executado; task movida para `done/` com evidências.

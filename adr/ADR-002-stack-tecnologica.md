# ADR-002 — Stack: Expo SDK 54 + Zustand + Supabase

- **Status:** ACCEPTED · **Fase:** F2 · **Data:** 2026-10-01

## Contexto

A stack atual (Expo 54, React Native 0.81, TypeScript estrito, Zustand, React Hook Form + Zod,
date-fns) funciona e é adequada. Falta escolher o backend de auth e sync e as bibliotecas de suporte.

## Opções consideradas (backend)

| Opção | Prós | Contras |
|---|---|---|
| **Supabase** | Postgres + RLS testável em SQL; Auth com OTP; região sa-east-1; migrations versionadas; faixa gratuita | Sync offline precisa ser implementado no cliente |
| Firebase | Cache offline nativo no Firestore | NoSQL; lock-in; regras menos testáveis; custo por leitura |
| NestJS próprio | Controle total | Operar servidor, banco e auth sozinho |

## Decisão

| Camada | Tecnologia | Motivo |
|---|---|---|
| App | Expo SDK 54 (managed) + EAS Build | Já em uso; builds Android e iOS na nuvem |
| Linguagem | TypeScript `strict` + `noUncheckedIndexedAccess` | Já em uso |
| Estado | Zustand 5 | Já em uso; simples |
| Formulários | React Hook Form + Zod 4 | Já em uso; Zod também valida o documento persistido |
| Datas | date-fns 4 | Já em uso |
| Backend | **Supabase** (Postgres 15+, Auth, PostgREST), região **sa-east-1** | Escolha do dono do produto; ver tabela acima |
| Cliente | `@supabase/supabase-js` v2 | SDK oficial |
| Sessão | `expo-secure-store` + criptografia AES (`aes-js`) | Ver ADR-006 |
| Conectividade | `@react-native-community/netinfo` | Disparo de sync ao reconectar |
| Crash reporting | `@sentry/react-native` | Ver ADR-007 |
| Testes | Jest (`jest-expo`) + Testing Library RN | Ver ADR-010 |
| Lint/format | ESLint (`eslint-config-expo`) + Prettier | Padrão Expo |
| CI | GitHub Actions | Repositório no GitHub |

Versões nativas são instaladas com `npx expo install` para respeitar a matriz do SDK 54.

## Consequências

- Sem conta Supabase ou Sentry configurada, o app roda em **modo local**: sync e crash reporting
  ficam desligados quando as variáveis `EXPO_PUBLIC_*` estão ausentes.
- Troca de backend no futuro fica restrita a `src/infrastructure/sync` (porta `SyncRemote`).

## Relações

ADR-001, ADR-004, ADR-005, ADR-006, ADR-007, ADR-010

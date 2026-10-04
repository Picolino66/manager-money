---
id: architecture.overview
type: module
module: architecture
title: Visão de arquitetura
summary: >
  Padrão arquitetural, mapa de camadas, integrações externas e estratégia de infraestrutura do
  Manager Money v1.0.
code:
  - packages/core/src/domain/financial/financial.calculations.ts
  - packages/core/src/application/cycle.use-cases.ts
  - app/src/infrastructure/storage/local-store.ts
  - app/src/infrastructure/sync/sync-engine.ts
  - app/src/store/financial.store.ts
adrs: [ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-006, ADR-007]
last_verified_commit: 3b9bf25+T-033
---

# Visão de arquitetura

## 1. Padrão

Monólito modular **no cliente** + **BaaS** (Supabase), em camadas
([ADR-001](../../adr/ADR-001-padrao-arquitetural.md)). As regras de negócio rodam no aparelho;
o servidor garante isolamento (RLS) e integridade estrutural.

```
┌───────────────────────── App (Expo / React Native) ─────────────────────────┐
│  presentation   screens · components · navigation · design                   │
│        │ lê estado / chama ações                                              │
│  store          financial.store.ts  ·  session.store.ts   (Zustand)          │
│        │ compõe                                                               │
│  application    cycle.use-cases.ts  (estado, comando, agora) → estado         │
│        │ usa                                                                  │
│  domain         financial.calculations.ts · financial.types.ts   (puro)       │
│                                                                               │
│  infrastructure storage/ (documento único v8) · sync/ (outbox + pull)         │
│                 supabase/ (cliente + sessão criptografada) · monitoring/      │
└───────────────────────────────┬───────────────────────────────────────────────┘
                                │ HTTPS (PostgREST + GoTrue)
                    ┌───────────▼────────────┐        ┌────────────────┐
                    │ Supabase sa-east-1     │        │ Sentry         │
                    │ Auth (e-mail + senha)  │        │ crash + health │
                    │ Postgres + RLS         │        └────────────────┘
                    └────────────────────────┘
```

## 2. Mapa de camadas

| Camada | Pasta | Responsabilidade | Pode depender de |
|---|---|---|---|
| Domain | `packages/core/src/domain/` | Cálculos e invariantes financeiros (BR-FIN-*) | — |
| Application | `packages/core/src/application/` | Casos de uso puros: abrir, fechar, receber antecipado, CRUD de gasto, salvar config | domain |
| Contrato (core) | `packages/core/src/contract/` | DTOs das linhas, mappers, `collectDirty`/`acknowledge`, `mapSupabaseError` | domain, application |
| Infrastructure | `app/src/infrastructure/` (mobile) · `client/src/infrastructure/` (web) | Persistência local e sync (mobile); leitura/gravação direta (web); cliente Supabase, monitoramento | domain, application, contrato |
| Store | `app/src/store/` | Estado reativo; aplica caso de uso → persiste → agenda sync | todas as anteriores |
| Presentation | `app/src/screens`, `app/src/components`, `app/src/navigation`, `app/src/design` | UI | store, domain (somente leitura de cálculos) |

Domain, application, contrato e `utils` formam o pacote `@manager-money/core` (ADR-022), usado pelo
app mobile e pelo client web. Regra verificada por lint (`packages/core/eslint.config.mjs`): o núcleo
não importa React, React Native, AsyncStorage nem Supabase.

## 3. Integrações externas

| Integração | Uso | Contrato | Falha |
|---|---|---|---|
| Supabase Auth (GoTrue) | E-mail + senha, sessão, refresh (ADR-011) | `signInWithPassword`, `signUp`, `signOut` | App segue em modo local; mensagem ao usuário |
| Supabase PostgREST | Push (upsert) e pull incremental | [contracts.md](contracts.md) | Outbox mantém pendências; retry com backoff |
| Supabase RPC | `delete_my_account()` | [contracts.md](contracts.md) | Erro exibido; nada é apagado localmente |
| Sentry | Crashes e release health | SDK | Silencioso (não afeta o uso) |
| EAS Build/Submit | Builds e publicação | `eas.json` | — |

## 4. Estratégia de infraestrutura

| Item | Decisão |
|---|---|
| Ambientes | `local` (Supabase CLI em Docker), `production` (projeto Supabase sa-east-1) |
| Banco | Migrations SQL versionadas em `supabase/migrations/`, aplicadas via `supabase db push` |
| Builds | EAS: `development` (dev client), `preview` (APK interno), `production` (AAB/IPA, autoIncrement) |
| Configuração | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN` via EAS env; ausentes = modo local |
| CI | GitHub Actions: lint, typecheck, testes com cobertura, `npm audit`, gitleaks |
| Escala | Free tier do Supabase até ~1.000 MAU; gatilho de upgrade: 80% da cota de banco ou de egress |
| Atualização OTA | Fora da v1.0 (`expo-updates` é candidato à v1.1 para hotfix) |

## 5. Segurança

Resumo em [ADR-006](../../adr/ADR-006-modelo-de-seguranca.md): RLS por `auth.uid()`, sessão
criptografada no SecureStore, nenhum segredo de servidor no app, Sentry higienizado e LGPD
(exclusão e exportação).

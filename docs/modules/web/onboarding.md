---
id: web.onboarding
type: feature
module: web
title: Onboarding de conta nova (web)
summary: >
  Conta sem configuração vai para /comecar: fontes de renda, meta e despesas fixas, gravadas pelos
  casos de uso saveConfig e openCycle do núcleo, abrindo o primeiro ciclo.
keywords: [onboarding, começar, configuração, primeiro ciclo, conta nova]
code:
  - client/src/features/onboarding/OnboardingPage.tsx
  - client/src/lib/onboarding.ts
symbols: [OnboardingPage, toConfigInput]
business_rules: [BR-FIN-002, BR-FIN-018, BR-FIN-024, BR-ACC-002]
adrs: [ADR-020, ADR-016]
tests: [client/src/lib/onboarding.test.ts, client/src/features/features.test.tsx]
last_verified_commit: 3b9bf25+T-040
---

# Onboarding (CLIENT-009A)

- Gatilho: `selectConfig(doc) === null` → `/comecar` (e `/comecar` com configuração → `/`).
- Campos: fontes de renda (nome, valor em centavos, dia 1–28), meta de economia, despesas fixas
  permanentes opcionais. Parcelamentos e cartões ficam para o app ou para o P1 do web.
- Uma única ação `run((s, ctx) => openCycle(saveConfig(s, input, ctx), ctx))` grava `settings`,
  `fixed_expenses` e `cycles`. Falha no meio → recarrega do servidor e mostra o erro.
- Conta com configuração e **sem ciclo ativo** (fechado no celular) não volta ao onboarding: a visão geral
  orienta abrir o próximo ciclo no app (abrir/fechar ciclo no web é P1).
- No mobile, o primeiro login dessa conta encontra dados no servidor e baixa tudo (BR-ACC-002).

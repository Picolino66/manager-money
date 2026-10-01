---
id: sync.first-login
type: feature
module: sync
title: Primeiro login e vínculo de dados
summary: >
  Decide entre enviar os dados locais, baixar os da nuvem ou perguntar ao usuário quando os dois
  lados têm dados.
keywords: [primeiro login, migrar dados, vincular conta, mesclar]
code:
  - src/infrastructure/sync/sync-engine.ts
  - src/store/session.store.ts
  - src/screens/AccountScreen.tsx
symbols: [planFirstLogin, linkKeepingLocal, linkUsingRemote, unlinkAccount, resolveFirstLogin]
business_rules: [BR-ACC-002]
tests: [src/infrastructure/sync/sync-engine.test.ts, src/store/session.store.test.ts]
last_verified_commit: F5-PENDING
---

# Primeiro login

| Remoto | Local | Ação |
|---|---|---|
| vazio | qualquer | envia tudo (`linkKeepingLocal`) |
| com dados | vazio | baixa tudo (`linkUsingRemote`) |
| com dados | com dados | pergunta: **Usar dados da nuvem** (descarta locais) ou **Manter dados deste aparelho** (marca remoto como excluído e envia) |

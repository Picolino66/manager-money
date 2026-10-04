---
id: settings.hub
type: feature
module: settings
title: Aba Ajustes e status de sincronização
summary: >
  Quinta aba com atalhos para configuração, cartões de crédito, conta (com status de sync),
  exportação, política de privacidade e versão do app.
keywords: [ajustes, configurações, status, versão]
code:
  - app/src/screens/SettingsScreen.tsx
  - app/src/screens/syncStatus.ts
  - app/src/navigation/AppNavigator.tsx
symbols: [describeSyncStatus, SettingsRow]
tests: [app/src/screens/syncStatus.test.ts]
last_verified_commit: bfe9de6+T-028r2
---

# Aba Ajustes

Spec: [SPEC-007](../../../specs/SPEC-007-ajustes-e-textos.md). Status possíveis: Indisponível nesta
versão · Somente neste aparelho · Sincronizando… · Sessão expirada · Sem conexão · N alterações
pendentes · Sincronizado às HH:mm.

---
id: settings.hub
type: feature
module: settings
title: Aba Ajustes e status de sincronização
summary: >
  Quinta aba com atalhos para configuração, cartões de crédito, conta (com status de sync),
  exportação, política de privacidade, aparência (tema) e versão do app.
keywords: [ajustes, configurações, status, versão, tema, escuro, aparência]
code:
  - app/src/screens/SettingsScreen.tsx
  - app/src/screens/syncStatus.ts
  - app/src/navigation/AppNavigator.tsx
  - app/src/components/ThemePreferenceSelector.tsx
symbols: [describeSyncStatus, SettingsRow]
adrs: [ADR-021]
tests: [app/src/screens/syncStatus.test.ts, app/src/components/ThemePreferenceSelector.test.tsx]
last_verified_commit: 455a4b1+T-031
---

# Aba Ajustes

Spec: [SPEC-007](../../../specs/SPEC-007-ajustes-e-textos.md). Status possíveis: Indisponível nesta
versão · Somente neste aparelho · Sincronizando… · Sessão expirada · Sem conexão · N alterações
pendentes · Sincronizado às HH:mm.

**Aparência** (ADR-021): seletor Sistema / Claro / Escuro, aplicado na hora e salvo só no aparelho.

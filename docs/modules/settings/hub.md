---
id: settings.hub
type: feature
module: settings
title: Aba Ajustes e status de sincronização
summary: >
  Quinta aba com atalhos para configuração, categorias, conta (com status de sync), exportação, política de
  privacidade, aparência (tema) e versão do app. Cartões saíram daqui para a aba Cartões (ADR-024).
keywords: [ajustes, configurações, status, versão, tema, escuro, aparência]
code:
  - app/src/screens/SettingsScreen.tsx
  - app/src/screens/syncStatus.ts
  - app/src/navigation/AppNavigator.tsx
  - app/src/components/ThemePreferenceSelector.tsx
  - app/src/screens/ManageCategoriesScreen.tsx
symbols: [describeSyncStatus, SettingsRow]
adrs: [ADR-021, ADR-024]
tests: [app/src/screens/syncStatus.test.ts, app/src/components/ThemePreferenceSelector.test.tsx]
last_verified_commit: 7b1b7b1+T-043
---

# Aba Ajustes

Spec: [SPEC-007](../../../specs/SPEC-007-ajustes-e-textos.md). Status possíveis: Indisponível nesta
versão · Somente neste aparelho · Sincronizando… · Sessão expirada · Sem conexão · N alterações
pendentes · Sincronizado às HH:mm.

**Abas (ADR-024):** Hoje · Histórico · Cartões · Relatórios · Ajustes. Em Ajustes, **Categorias** abre
`ManageCategoriesScreen` (criar categoria de gasto); a análise por categoria fica em Relatórios.

**Aparência** (ADR-021): seletor Sistema / Claro / Escuro, aplicado na hora e salvo só no aparelho.

---
id: category.manage
type: feature
module: category
title: Gerenciar categorias
summary: >
  Categorias padrão (Moradia, Alimentação etc.) mais as categorias personalizadas criadas pelo
  usuário, sem duplicatas.
keywords: [categoria, criar categoria, personalizada]
code:
  - app/src/screens/ManageCategoriesScreen.tsx
  - packages/core/src/application/cycle.use-cases.ts
  - packages/core/src/domain/financial/financial.calculations.ts
symbols: [addCategory, normalizeCategory, getAvailableCategories, getSortedCategories]
business_rules: [BR-FIN-012]
last_verified_commit: 7b1b7b1+T-043
---

# Gerenciar categorias

- 11 categorias padrão (`DEFAULT_EXPENSE_CATEGORIES`) + `customCategories` do usuário.
- Criar uma categoria rejeita nome vazio, "Outros" e nomes já existentes. No app fica em **Ajustes › Categorias**
  (`ManageCategoriesScreen`, ADR-024), com a lista das categorias.

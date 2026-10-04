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
  - app/src/screens/CategoriesScreen.tsx
  - packages/core/src/application/cycle.use-cases.ts
  - packages/core/src/domain/financial/financial.calculations.ts
symbols: [addCategory, normalizeCategory, getAvailableCategories, getSortedCategories]
business_rules: [BR-FIN-012]
last_verified_commit: 3b9bf25+T-040
---

# Gerenciar categorias

- 11 categorias padrão (`DEFAULT_EXPENSE_CATEGORIES`) + `customCategories` do usuário.
- Criar uma categoria rejeita nome vazio, "Outros" e nomes já existentes.

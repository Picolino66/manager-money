---
id: design.system
type: module
module: design
title: Design system
summary: >
  Tokens de cor, espaçamento, raio e tipografia e o catálogo de componentes reutilizáveis do app.
code:
  - src/design/theme.ts
  - src/components/AppButton.tsx
last_verified_commit: F5-PENDING
---

# Design system

Fonte: [`src/design/theme.ts`](../../src/design/theme.ts). Nenhuma cor ou espaçamento literal
em telas novas: usar sempre os tokens.

## Tokens

| Grupo | Tokens |
|---|---|
| Superfícies | `background` #f7f8fa · `surface` #ffffff · `surfaceMuted` #eef2f3 · `border` #dbe1e7 |
| Texto | `ink` #111827 (títulos) · `text` #24303f · `muted` #697586 |
| Marca | `primary` #1f7a5a · `primaryDark` · `primarySoft` |
| Status do dia | `healthy`, `warning`, `critical`, `negative` + variantes `*Soft` (BR-FIN-009) |
| Espaçamento | xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 |
| Raio | sm 6 · md 8 |
| Tipografia | title 28 · sectionTitle 20 · body 16 · small 13 · metric 40 |

## Componentes

| Componente | Uso |
|---|---|
| `Screen` | Contêiner com scroll, safe area, teclado e rodapé opcional |
| `Card` | Agrupador de seção |
| `AppButton` | Variantes `primary`, `secondary`, `ghost`, `danger`; `isLoading`; altura ≥ 48 |
| `MetricRow` | Par rótulo/valor; `tone` e `indent` |
| `StatusBadge` | Status do dia com texto + cor |
| `EmptyState` | Estado vazio com ação |
| `CurrencyInput` | Entrada em centavos (BR-FIN-001) |
| `TextInputField`, `SelectField`, `CategoryPicker` | Formulários |

## Diretrizes
- O status nunca é comunicado só pela cor.
- Ações destrutivas (`danger`) sempre pedem confirmação.
- Tema claro apenas na v1.0 (`userInterfaceStyle: light`); o tema escuro é candidato à v1.1.

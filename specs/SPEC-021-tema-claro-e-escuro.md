---
spec: SPEC-021
features: [design.system, settings.hub]
---
# SPEC-021 — Tema claro e escuro

## Objetivo
Oferecer tema escuro no app mobile (e, no futuro, no client web), com escolha Sistema / Claro / Escuro,
sem alterar layout, regras de negócio, documento local ou sincronização.

## Docs relacionados
[ADR-021](../adr/ADR-021-tema-claro-e-escuro.md) · [design-system](../docs/design/design-system.md) ·
[settings.hub](../docs/modules/settings/hub.md) · [client-web-plan](../docs/architecture/client-web-plan.md)

## Requisitos relacionados
Nenhum RF/BR alterado (requisito de UX novo, sem regra financeira).

## Regras
- Padrão: "Sistema" (segue o aparelho; sem informação, claro).
- A escolha vale na hora e fica salva só no aparelho; não vai para a nuvem nem para o documento.
- Todas as telas, modais, barra de abas, cabeçalhos, status bar e splash seguem o tema.
- Status continuam comunicados por texto + cor nos dois temas; contraste ≥ 4,5 no tema escuro.

## Critérios de aceite
- Ajustes → Aparência com as três opções, acessíveis como `radiogroup`.
- Nenhum `colors` estático nem cor literal em telas/componentes.
- `npm run verify` (app) e `npm run docs:check` verdes; testes de resolução do tema, persistência,
  store e troca de tema na interface.
- QA manual em aparelho: percorrer as abas e os modais nos dois temas.

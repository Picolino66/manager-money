---
spec: SPEC-007
features: [settings.hub, legal.privacy-policy]
---
# SPEC-007 — Aba Ajustes, política de privacidade e textos pt-BR

## Objetivo
Centralizar configuração, conta e dados; publicar a política de privacidade; corrigir a acentuação (DEF-005).

## Docs relacionados
[journeys](../docs/flows/journeys.md) · [ADR-006](../adr/ADR-006-modelo-de-seguranca.md)

## Requisitos relacionados
RNF-05, RNF-07, RNF-08 · DEF-004, DEF-005, U1, U5, U9

## Regras
- A nova aba "Ajustes" tem: Configuração financeira, Conta e sincronização (com o status), Exportar dados, Política de privacidade e a versão do app.
- Todos os textos visíveis ficam em pt-BR com acentuação correta.
- A política de privacidade aparece em uma tela do app (texto de `src/legal/privacy-policy.ts`) e é espelhada em `docs/legal/politica-de-privacidade.md` para publicação na URL exigida pelas lojas.

## Comportamento
Ver o wireframe "Ajustes".

## Fluxos
FLOW-ativar-sync, FLOW-sair-e-excluir

## Critérios de aceite
- [ ] Nenhuma ocorrência das grafias sem acento listadas em U1 nas telas.
- [ ] A política cobre os dados coletados, a finalidade, a base legal, o compartilhamento (Supabase), a retenção, os direitos do titular e o contato.
- [ ] Todo `Pressable` novo tem `accessibilityRole` e `accessibilityLabel`.

## Tasks derivadas
T-007, T-011

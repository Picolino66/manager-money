# Skill: adicionar ou alterar uma regra de negócio

1. Registrar ou alterar a regra em `docs/business/business-rules.md` com um novo ID `BR-<DOM>-NNN` (nunca reutilizar um ID).
2. Atualizar ou criar a spec em `specs/` e os critérios de aceite.
3. Implementar a função pura em `packages/core/src/domain` (cálculo) ou em `packages/core/src/application` (efeito de escrita). Erros: `DomainError` com mensagem pt-BR.
4. Escrever o teste **antes** de ligar na UI: um caso feliz, os limites e a violação.
5. Ligar na store ou na tela; nenhuma regra em componente.
6. Atualizar `business_rules:` no frontmatter do doc da feature → `npm run docs:index`.
7. `npm run verify` em `app/` e `npm run docs:check` na raiz.

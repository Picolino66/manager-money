# ADR-009 — Estrutura agentic e knowledge layer

- **Status:** ACCEPTED · **Fase:** F4 · **Data:** 2026-10-01

## Contexto
O projeto será evoluído por agentes de IA e por um desenvolvedor solo. Sem uma estrutura persistente, cada sessão relê o código inteiro e decisões se perdem.

## Opções consideradas
| Opção | Prós | Contras |
|---|---|---|
| Só README | Simples | Não escala; sem rastreabilidade |
| **docs/specs/tasks/agents/skills/adr + `docs/.ai` gerado** | Rastreabilidade; retrieval barato (INDEX → DOCS → CODE) | Disciplina para manter |

## Decisão
- Estrutura: `docs/` (business, architecture, flows, design, modules, legal, operations, quality), `specs/`, `tasks/{backlog,todo,doing,done}`, `agents/`, `skills/`, `adr/`.
- `repository_id: manager-money` (repositório único; sem `system_id`).
- IDs estáveis `<module>.<feature>`, `BR-<DOM>-NNN`, `ADR-NNN`, `FLOW-<slug>`, `SPEC-NNN`, `T-NNN`, `RF-NN`, `RNF-NN`, `DEF-NNN`.
- **Rastreabilidade:** RF/DEF → BR → SPEC (`features:`) → T (`Spec relacionada`) → código (`code:`/`symbols:` no doc da feature) → teste (`tests:`) → doc (`last_verified_commit`).
- `docs/.ai/{index,features,freshness}.json` são **gerados** por `scripts/ai-docs/build-index.mjs`; nunca editados à mão. O hash é por símbolo listado em `symbols:` e cai para o hash do arquivo quando não houver símbolos.
- Gate local e na CI: `npm run docs:check` (gerador em modo verificação + validador oficial).

## Trade-offs
Custo de manter o frontmatter; compensado pela verificação automática.

## Consequências
Feature sem doc ou entrada no índice não conta como entregue (gate F5).

## Relações
Todas as specs; agents/docs-keeper.md; skills/atualizar-knowledge-layer.md

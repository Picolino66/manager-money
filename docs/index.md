# Manager Money — documentação

Ponto de entrada humano. Agentes: comecem por [`.ai/index.json`](.ai/index.json)
(**INDEX FIRST → DOCS SECOND → CODE LAST**).

| Área | Documentos |
|---|---|
| Negócio | [Produto e personas](business/product.md) · [Regras BR-*](business/business-rules.md) · [Requisitos, escopo e métricas](business/requirements.md) |
| Arquitetura | [Visão geral](architecture/overview.md) · [Contratos de dados e API](architecture/contracts.md) · [ADRs](../adr/README.md) |
| UX | [Jornadas, wireframes e usabilidade](flows/journeys.md) · [Design system](design/design-system.md) |
| Módulos | [planejamento](modules/planning/index.md) · [ciclo](modules/cycle/index.md) · [gastos](modules/expense/index.md) · [categorias](modules/category/index.md) · [conta](modules/account/index.md) · [sync](modules/sync/index.md) · [persistência](modules/storage/index.md) · [ajustes](modules/settings/index.md) · [legal](modules/legal/index.md) · [observabilidade](modules/monitoring/index.md) · [aplicação](modules/application/index.md) · [ferramentas](modules/tooling/index.md) |
| Legal | [Política de privacidade](legal/politica-de-privacidade.md) |
| Execução | [Specs](../specs/README.md) · [Tasks](../tasks/README.md) · [Agentes](../agents/README.md) · [Skills](../skills/README.md) |

## Precedência de fontes de verdade

`código executável e contratos > ADRs > .orchestrator/context.json > documentação Markdown > docs/.ai (derivado)`

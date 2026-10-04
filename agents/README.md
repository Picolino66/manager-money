# Agentes

Estrutura (ADR-019/022): `app/` mobile · `client/` web · `packages/core` núcleo compartilhado ·
`supabase/` backend compartilhado.

| Agente | Ownership |
|---|---|
| [mobile-engineer](mobile-engineer.md) | domínio, aplicação, store, UI, storage local |
| [sync-engineer](sync-engineer.md) | auth, sync, contratos remotos, Supabase |
| [qa-engineer](qa-engineer.md) | CI, gates, QA |
| [docs-keeper](docs-keeper.md) | knowledge layer |
| [web-engineer](web-engineer.md) | client web (`client/`), uso do núcleo `packages/core` |

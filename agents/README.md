# Agentes

Estrutura (ADR-019): `app/` mobile · `client/` web (planejado) · `supabase/` backend compartilhado.
Ao implementar o client, criar o agente `web-engineer` (ver `docs/architecture/client-web-plan.md`).

| Agente | Ownership |
|---|---|
| [mobile-engineer](mobile-engineer.md) | domínio, aplicação, store, UI, storage local |
| [sync-engineer](sync-engineer.md) | auth, sync, contratos remotos, Supabase |
| [qa-engineer](qa-engineer.md) | CI, gates, QA |
| [docs-keeper](docs-keeper.md) | knowledge layer |

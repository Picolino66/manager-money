# client — aplicação web do Manager Money

**Implementação pendente.** Nada aqui roda ainda.

- Plano técnico, escopo P0/P1/P2, rotas, segurança e backlog `CLIENT-*`:
  [docs/architecture/client-web-plan.md](../docs/architecture/client-web-plan.md)
- Decisões: [ADR-019](../adr/ADR-019-estrutura-do-repositorio-app-client-supabase.md) (estrutura) ·
  [ADR-020](../adr/ADR-020-client-web-stack-e-integracao.md) (stack proposta: React + Vite SPA)
- Backend: o mesmo Supabase do app, em [`../supabase`](../supabase) (fonte única; não duplicar migrations).

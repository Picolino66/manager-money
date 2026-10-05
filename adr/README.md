# Architecture Decision Records

Fonte primária das decisões arquiteturais. ADRs nunca são apagadas: só passam para `SUPERSEDED` ou
`DEPRECATED`. Toda nova decisão referencia as anteriores que afeta.

| ADR | Título | Fase | Status |
|---|---|---|---|
| [ADR-001](ADR-001-padrao-arquitetural.md) | Monólito modular no cliente + BaaS, em camadas | F2 | ACCEPTED |
| [ADR-002](ADR-002-stack-tecnologica.md) | Stack: Expo SDK 54 + Zustand + Supabase | F2 | ACCEPTED |
| [ADR-003](ADR-003-persistencia-local.md) | Persistência local em documento único versionado | F2 | ACCEPTED |
| [ADR-004](ADR-004-sincronizacao.md) | Sync offline-first com outbox e last-write-wins | F2 | ACCEPTED |
| [ADR-005](ADR-005-autenticacao.md) | Autenticação por OTP de e-mail; login opcional | F2 | SUPERSEDED (ADR-011) |
| [ADR-006](ADR-006-modelo-de-seguranca.md) | Modelo de segurança e threat model | F2 | ACCEPTED |
| [ADR-007](ADR-007-observabilidade.md) | Observabilidade com Sentry e métricas no servidor | F2 | ACCEPTED |
| [ADR-008](ADR-008-modelo-de-dados-e-consistencia.md) | Modelo de dados e consistência | F3 | ACCEPTED |
| [ADR-009](ADR-009-estrutura-agentic.md) | Estrutura agentic e knowledge layer | F4 | ACCEPTED |
| [ADR-010](ADR-010-testes-e-qualidade.md) | Testes, cobertura e quality gates | F4 | ACCEPTED |
| [ADR-011](ADR-011-autenticacao-email-senha.md) | Autenticação por e-mail e senha, sem envio de e-mail | F2 (evolução) | ACCEPTED |
| [ADR-012](ADR-012-upgrade-expo-sdk-57.md) | Upgrade do Expo SDK 54 para 57 | F2 (evolução) | ACCEPTED |
| [ADR-013](ADR-013-fontes-de-renda.md) | Múltiplas fontes de renda e documento local v3 | F3 (evolução) | ACCEPTED |
| [ADR-014](ADR-014-cartoes-de-credito.md) | Cartões de crédito e compras parceladas | F3 (evolução) | ACCEPTED (ciclo da fatura substituído pela ADR-017) |
| [ADR-015](ADR-015-pagamento-de-fixas-e-renda-avulsa.md) | Pagamento de despesas fixas e renda avulsa | F3 (evolução) | ACCEPTED (reserva de fixas pendentes pela ADR-017) |
| [ADR-016](ADR-016-dia-de-pagamento-por-fonte.md) | Dia de pagamento por fonte de renda | F3 (evolução) | ACCEPTED |
| [ADR-017](ADR-017-faturas-limite-e-situacao-inicial.md) | Faturas pelo vencimento, limite do cartão e situação inicial | F3 (evolução) | ACCEPTED (pagamento atualizado pela ADR-018) |
| [ADR-018](ADR-018-pagamento-parcial-e-total-da-fatura.md) | Pagamento parcial e total da fatura, encargos e restante transportado | F3 (evolução) | ACCEPTED |
| [ADR-019](ADR-019-estrutura-do-repositorio-app-client-supabase.md) | Estrutura do repositório: `app/`, `client/` e `supabase/` compartilhado | F2 (evolução) | ACCEPTED |
| [ADR-020](ADR-020-client-web-stack-e-integracao.md) | Client web: React + Vite SPA, online direto no Supabase (sem sync) e núcleo compartilhado | F2 (evolução) | ACCEPTED |
| [ADR-021](ADR-021-tema-claro-e-escuro.md) | Tema claro e escuro (mobile e web) | F4 (evolução) | ACCEPTED |
| [ADR-022](ADR-022-nucleo-compartilhado-packages-core.md) | Núcleo compartilhado em `packages/core` com npm workspaces | F2 (evolução) | ACCEPTED |
| [ADR-023](ADR-023-fixa-recorrente-no-cartao.md) | Despesa fixa recorrente no cartão: cobrança automática a cada virada de fatura | F3 (evolução) | ACCEPTED |

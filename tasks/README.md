# Tasks

Fluxo: `backlog/ → todo/ → doing/ → done/`. Toda task deriva de uma spec (`specs/`).

## Capacidade
Desenvolvedor solo (com agentes): **1 sprint = 1 semana ≈ 24 pontos**.

## Priorização (`prioritization-engine`)

Critério: **valor × risco ÷ esforço**. P0 = bloqueia o lançamento nas lojas ou corrompe dados;
P1 = importante para operar; P2 = melhoria.

| Task | Título | Spec | Prioridade | Sprint | Pontos |
|---|---|---|---|---|---|
| T-001 | Pipeline de qualidade local | SPEC-010 | P0 | S1 | 3 |
| T-002 | Camada de aplicação e estado v2 | SPEC-009 | P0 | S1 | 5 |
| T-003 | Documento local v2, migração e tela de erro | SPEC-004 | P0 | S1 | 3 |
| T-004 | Dia de pagamento configurável | SPEC-001 | P0 | S1 | 2 |
| T-005 | Correções de ciclo de vida | SPEC-002 | P0 | S1 | 3 |
| T-006 | Exclusão de gasto | SPEC-003 | P1 | S1 | 2 |
| T-007 | Textos pt-BR e acessibilidade | SPEC-007 | P0 | S1 | 3 |
| T-008 | Supabase: cliente, sessão criptografada e login OTP | SPEC-005 | P0 | S2 | 5 |
| T-009 | Motor de sync e primeiro login | SPEC-006 | P0 | S2 | 8 |
| T-010 | Exportação de dados e exclusão de conta | SPEC-005 | P0 | S2 | 3 |
| T-011 | Aba Ajustes e política de privacidade | SPEC-007 | P0 | S2 | 2 |
| T-012 | Logger estruturado e porta CrashReporter | SPEC-008 | P1 | S2 | 1 |
| T-013 | Integrar Sentry | SPEC-008 | P1 | bloqueada | 2 |
| T-014 | CI no GitHub Actions | SPEC-010 | P1 | S2 | 2 |
| T-015 | Knowledge layer: gerador e verificação | SPEC-010 | P0 | S1 | 2 |
| T-018 | Múltiplas fontes de renda | SPEC-012 | P1 | S3 | 3 |
| T-019 | Cartões de crédito e compras parceladas | SPEC-013 | P1 | S3 | 8 |
| T-020 | Pagamento de despesas fixas e renda avulsa | SPEC-014 | P1 | S3 | 8 |
| T-021 | Dia de pagamento por fonte de renda | SPEC-015 | P1 | S3 | 3 |
| T-022 | Faturas, limite e situação inicial: domínio, dados e sync | SPEC-016/017/018 | P1 | S4 | 8 |
| T-023 | Telas de cartão: limite, faturas, situação inicial e ativo/inativo | SPEC-016/017 | P1 | S4 | 5 |
| T-024 | Hoje enxuta, Registrar gasto, Configuração e Categorias | SPEC-018 | P1 | S4 | 5 |
| T-025 | Documentação: ADR-017, specs e knowledge layer | SPEC-016/017/018 | P1 | S4 | 2 |
| T-026 | Núcleo: pagamento parcial, encargos, total informado e invariantes | SPEC-019 | P1 | S5 | 8 |
| T-027 | UI de faturas parciais, encargos e onboarding com total informado | SPEC-019 | P1 | S5 | 5 |
| T-028 | Documentação: ADR-018, SPEC-019 e knowledge layer | SPEC-019 | P1 | S5 | 2 |
| T-032 | Client web: decisão e spec (CLIENT-001) | SPEC-022 | P0 | S7 | 2 |
| T-033 | Extrair `packages/core` com npm workspaces (CLIENT-003) | SPEC-022 | P0 | S7 | 8 |
| T-034 | Bootstrap do client, lint, CI e testes (CLIENT-002/004/005) | SPEC-022 | P0 | S7 | 5 |
| T-035 | Repositório Supabase, autenticação e guarda de rota (CLIENT-006/007/008) | SPEC-022 | P0 | S7 | 8 |
| T-036 | Shell, tema e onboarding (CLIENT-009/009A) | SPEC-022 | P0 | S7 | 5 |
| T-037 | Visão geral (CLIENT-010) | SPEC-022 | P0 | S7 | 3 |
| T-038 | Gastos e ciclos (CLIENT-011/012/013) | SPEC-022 | P0 | S7 | 8 |
| T-039 | Análise por categoria e período (CLIENT-014) | SPEC-022 | P0 | S7 | 3 |
| T-040 | Hardening do MVP web (CLIENT-015) | SPEC-022 | P0 | S7 | 3 |
| T-041 | Ajustes no client web: configuração, cartões e exportação (CLIENT-017/018) | SPEC-023 | P1 | S7 | 8 |

**S1 (23 pts):** fundação e correções de dados: T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-015.
**S2 (21 pts):** conta, sync e lojas: T-008, T-009, T-010, T-011, T-012, T-014.
**Bloqueada:** T-013 (depende da conta Sentry).

**S3 (evolução):** T-016 — login por e-mail e senha (ADR-011), concluída; T-018 — múltiplas fontes de renda (SPEC-012); T-019 — cartões de crédito (SPEC-013); T-020 — pagamento de fixas e renda avulsa (SPEC-014); T-021 — dia de pagamento por fonte (SPEC-015).

**S4 (visão de produto, ADR-017):** T-022 — núcleo de faturas, limite, situação inicial e projeção (concluída); T-023 — telas de cartão; T-024 — Hoje, Registrar, Configuração e Categorias; T-025 — documentação (todas concluídas; revisão financeira A1, A2, M1–M3, M5–M7 corrigida).

**S5 (pagamento parcial e invariantes, ADR-018):** T-026 — núcleo (concluída); T-027 — UI de faturas e onboarding; T-028 — documentação (todas concluídas; revisão financeira v2 com M1–M3, B1–B4 e B7 corrigidos).

**S6 (estrutura e tema):** T-029 — reorganização em `app/`, `client/` e `supabase/` + plano do client web (ADR-019); T-030 — decisões do plano do client (ADR-020); T-031 — tema claro e escuro no mobile (ADR-021) (todas concluídas).

**S7 (client web P0, ADR-020/022):** T-032 — decisão e spec; T-033 — `packages/core`; T-034 — bootstrap; T-035 — Supabase e auth; T-036 — shell, tema e onboarding; T-037 — visão geral; T-038 — gastos e ciclos; T-039 — análise; T-040 — hardening; T-041 — ajustes no web (configuração, cartões, exportação, SPEC-023).

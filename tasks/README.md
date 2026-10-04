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

**S1 (23 pts):** fundação e correções de dados: T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-015.
**S2 (21 pts):** conta, sync e lojas: T-008, T-009, T-010, T-011, T-012, T-014.
**Bloqueada:** T-013 (depende da conta Sentry).

**S3 (evolução):** T-016 — login por e-mail e senha (ADR-011), concluída; T-018 — múltiplas fontes de renda (SPEC-012); T-019 — cartões de crédito (SPEC-013); T-020 — pagamento de fixas e renda avulsa (SPEC-014); T-021 — dia de pagamento por fonte (SPEC-015).

**S4 (visão de produto, ADR-017):** T-022 — núcleo de faturas, limite, situação inicial e projeção (concluída); T-023 — telas de cartão; T-024 — Hoje, Registrar, Configuração e Categorias; T-025 — documentação (todas concluídas; revisão financeira A1, A2, M1–M3, M5–M7 corrigida).

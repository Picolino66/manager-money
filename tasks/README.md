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

**S1 (23 pts):** fundação e correções de dados: T-001, T-002, T-003, T-004, T-005, T-006, T-007, T-015.
**S2 (21 pts):** conta, sync e lojas: T-008, T-009, T-010, T-011, T-012, T-014.
**Bloqueada:** T-013 (depende da conta Sentry).

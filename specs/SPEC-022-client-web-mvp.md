---
spec: SPEC-022
features: [core.shared-package, web.auth, web.onboarding, web.shell, web.overview, web.expenses, web.cycles, web.analysis]
---
# SPEC-022 — Client web: MVP (P0)

## Objetivo
Entregar a aplicação web em `client/` para **ver e corrigir o histórico com conforto**, usando o mesmo
Supabase e **as mesmas regras financeiras** do app mobile (núcleo compartilhado em `packages/core`),
sempre online e sem sincronismo.

## Docs relacionados
[client-web-plan](../docs/architecture/client-web-plan.md) (fonte do escopo, rotas, UI/UX e backlog
`CLIENT-*`) · [ADR-020](../adr/ADR-020-client-web-stack-e-integracao.md) ·
[ADR-022](../adr/ADR-022-nucleo-compartilhado-packages-core.md) ·
[ADR-021](../adr/ADR-021-tema-claro-e-escuro.md) · [contracts](../docs/architecture/contracts.md) ·
[business-rules](../docs/business/business-rules.md)

## Requisitos relacionados
RF-04, RF-05, RF-06, RF-09, RF-10, RF-13 (no web) · BR-FIN-001, BR-FIN-005, BR-FIN-013, BR-ACC-002,
BR-ACC-006 · INV-01..10 (garantidas pelo núcleo, não reimplementadas).

## Regras
- **Toda escrita passa por um caso de uso do núcleo** (`@manager-money/core`). Nenhuma tela grava em
  tabela diretamente; só `client/src/infrastructure` fala com o Supabase.
- **Sem sync:** ao entrar, lê as linhas vivas (`deleted_at is null`) das 9 tabelas e monta o
  `LocalState` em memória com os `mappers`; recalcula o saldo do ciclo ativo em memória e zera as
  marcações `dirty` (ler nunca grava).
- **Ação:** recarrega tudo → aplica o caso de uso → grava (upsert) **só os registros marcados `dirty`**
  pelo caso de uso (`collectDirty` do núcleo), tabela a tabela na ordem de `SYNC_TABLES`
  (`cycles`: `closed` antes de `active`). Sucesso: adota o novo estado sem marcações. Falha: estado
  anterior mantido e erro na tela; se alguma tabela já tiver sido gravada, recarrega do servidor.
- Recusa `23505` em `cycles_one_active_per_user`: mensagem "Outro aparelho já abriu um ciclo" e recarga.
- Nenhum dado financeiro no navegador (só a sessão do supabase-js e a preferência de tema).
- Conta sem `settings` vai para `/comecar` (onboarding: `saveConfig` + `openCycle`). Conta com
  configuração e sem ciclo ativo mostra o aviso para abrir o próximo ciclo no app (ação de ciclo é P1).
- Gastos de ciclo fechado são somente leitura.
- **Histórico (`/historico` no web e aba Histórico no app):** mostra tudo que foi pago (gasto à vista, compra no
  cartão, fixas, parcelados e fatura) a partir de `selectPaidHistory` do núcleo. Só o gasto à vista do ciclo
  ativo e a compra no cartão (BR-FIN-029) têm lápis e lixeira; fixa, parcelado e lançamento de fatura do ciclo
  ativo só têm lixeira (desfazer); pagamento de fatura é informativo e não soma. Coluna/linha "Meio": Crédito ou Saldo; Pix, débito e
  dinheiro não são distinguidos (todos Saldo). Os filtros (busca, categoria, tipo, período) são os mesmos nos dois, via
  `filterPaidHistory`; o app abre os filtros num modal pelo ícone de funil.
- Dinheiro em centavos inteiros; textos em português; temas Sistema/Claro/Escuro.

## Critérios de aceite
Os critérios do P0 do plano (`client-web-plan.md` → Escopo P0 e backlog CLIENT-001..015), em especial:
- criar conta, entrar, sair; sessão persiste no reload; sessão expirada volta ao login com aviso;
- números da visão geral, ciclos e análise iguais aos seletores do núcleo para a mesma fixture;
- falha de gravação não altera a tela; `23505` tratado;
- sem `dangerouslySetInnerHTML` (lint), CSP pronta, nenhum log de token/e-mail/valores;
- `cd app && npm run verify` verde (app intacto).

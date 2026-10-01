---
spec: SPEC-006
features: [sync.engine, sync.first-login]
---
# SPEC-006 — Sincronização offline-first

## Objetivo
Manter os dados iguais entre aparelhos sem perder o funcionamento offline.

## Docs relacionados
[ADR-004](../adr/ADR-004-sincronizacao.md) · [ADR-008](../adr/ADR-008-modelo-de-dados-e-consistencia.md) · [contracts](../docs/architecture/contracts.md)

## Requisitos relacionados
RF-14, RF-15 · BR-SYNC-001..003, BR-ACC-002, BR-FIN-013

## Regras
- O push envia apenas registros `dirty`, na ordem settings → fixed_expenses → cycles (closed antes de active) → expenses.
- O pull aplica um registro remoto **somente** se o local correspondente não estiver `dirty`. Ele avança o cursor por tabela até o maior `server_updated_at` recebido.
- Conflito `23505` no ciclo ativo: adota o ciclo remoto, reatribui os gastos locais do ciclo duplicado, exclui logicamente o duplicado e tenta de novo uma vez.
- **Primeiro login (BR-ACC-002):** remoto vazio → envia tudo. Local vazio → baixa tudo. Os dois com dados → pergunta: "Usar dados da nuvem" (descarta os locais e baixa) ou "Manter dados deste aparelho" (marca o remoto como excluído e envia os locais).
- Gatilhos: login, abertura do app, retorno ao primeiro plano, reconexão e 2 s após uma escrita. Backoff de 2 s a 60 s.
- Sync nunca bloqueia a UI. Falhas ficam em `sync.lastError`.

## Comportamento
Status visível: "Sincronizado às HH:mm", "N alterações pendentes", "Sem conexão", "Sessão expirada — entre novamente".

## Fluxos
FLOW-ativar-sync, FLOW-segundo-aparelho

## Critérios de aceite (testados com `MemoryRemote`)
- [ ] Dois aparelhos convergem após alternar escrita, push e pull.
- [ ] Um registro dirty local não é sobrescrito por pull.
- [ ] Receber antecipado gera push com closed antes de active, sem 23505.
- [ ] Conflito de ciclo ativo concorrente é resolvido sem perder gastos.
- [ ] As três estratégias de primeiro login produzem o estado esperado.

## Tasks derivadas
T-009

---
spec: SPEC-005
features: [account.auth, account.export, account.delete]
---
# SPEC-005 — Conta: login por código, exportação e exclusão

## Objetivo
Login opcional para habilitar o sync; atender às exigências das lojas e da LGPD (exportação e exclusão).

## Docs relacionados
[ADR-005](../adr/ADR-005-autenticacao.md) · [ADR-006](../adr/ADR-006-modelo-de-seguranca.md) · [journeys](../docs/flows/journeys.md)

## Requisitos relacionados
RF-13, RF-16, RF-17, RF-18 · BR-ACC-001..004

## Regras
- Sem `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`, a tela Conta informa "Sincronização indisponível nesta versão" e o app segue local.
- O e-mail é validado (Zod `email`). O código tem 6 dígitos. Reenvio só depois de 60 s.
- A sessão é persistida criptografada (AES-256-CTR; chave aleatória de 32 bytes no SecureStore).
- **Sair:** o usuário escolhe manter os dados locais (desvinculados da conta) ou apagá-los.
- **Excluir conta:** confirmação dupla → `rpc('delete_my_account')` → em caso de sucesso, encerra a sessão e desvincula os dados locais (os dados no aparelho continuam, a não ser que o usuário peça para apagar). Em caso de falha, nada local é alterado.
- **Exportar:** gera `manager-money-AAAA-MM-DD.json` com o documento v2 (sem tokens) e abre o compartilhamento nativo. Funciona sem login.

## Comportamento
Ver os wireframes "Conta e sincronização" em journeys.md §3.

## Fluxos
FLOW-ativar-sync, FLOW-sair-e-excluir

## Critérios de aceite
- [ ] Login com código válido leva ao status "Sincronizado".
- [ ] Código inválido mostra "Código inválido ou expirado."
- [ ] O JSON exportado contém os dados do documento v2 e nenhum token ou identificador de usuário.
- [ ] A exclusão de conta chama o RPC e, no sucesso, encerra a sessão.

## Tasks derivadas
T-008, T-010

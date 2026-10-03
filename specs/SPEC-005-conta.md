---
spec: SPEC-005
features: [account.auth, account.export, account.delete]
---
# SPEC-005 — Conta: login por e-mail e senha, exportação e exclusão

## Objetivo
Login opcional para habilitar o sync; atender às exigências das lojas e da LGPD (exportação e exclusão).

## Docs relacionados
[ADR-011](../adr/ADR-011-autenticacao-email-senha.md) (substitui ADR-005) · [ADR-006](../adr/ADR-006-modelo-de-seguranca.md) · [journeys](../docs/flows/journeys.md)

## Requisitos relacionados
RF-13, RF-16, RF-17, RF-18 · BR-ACC-001..004

## Regras
- Sem `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY`, a tela Conta informa "Sincronização indisponível nesta versão" e o app segue local.
- O e-mail é validado (Zod `email`). A senha tem no mínimo 8 caracteres. Botões **Entrar** (`signInWithPassword`) e **Criar conta** (`signUp`). Nenhum e-mail é enviado (confirmação desligada no Supabase).
- Se o Supabase exigir confirmação (`signUp` sem sessão), o app informa: "Confirme o cadastro pelo e-mail recebido e depois entre."
- A sessão é persistida criptografada (AES-256-CTR; chave aleatória de 32 bytes no SecureStore).
- **Sair:** o usuário escolhe manter os dados locais (desvinculados da conta) ou apagá-los.
- **Excluir conta:** confirmação dupla → `rpc('delete_my_account')` → em caso de sucesso, encerra a sessão e desvincula os dados locais (os dados no aparelho continuam, a não ser que o usuário peça para apagar). Em caso de falha, nada local é alterado.
- **Exportar:** gera `manager-money-AAAA-MM-DD.json` com o documento v2 (sem tokens) e abre o compartilhamento nativo. Funciona sem login.

## Comportamento
Ver os wireframes "Conta e sincronização" em journeys.md §3.

## Fluxos
FLOW-ativar-sync, FLOW-sair-e-excluir

## Critérios de aceite
- [ ] Entrar com credenciais válidas leva ao status "Sincronizado".
- [ ] Senha errada mostra "E-mail ou senha incorretos."
- [ ] Criar conta com e-mail já usado mostra "Já existe uma conta com este e-mail. Use Entrar."
- [ ] Senha com menos de 8 caracteres é rejeitada antes de chamar o servidor.
- [ ] O JSON exportado contém os dados do documento v2 e nenhum token ou identificador de usuário.
- [ ] A exclusão de conta chama o RPC e, no sucesso, encerra a sessão.

## Tasks derivadas
T-008, T-010, T-016

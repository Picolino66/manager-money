---
id: operations.runbook
type: module
module: operations
title: Runbook de operação
summary: >
  Como configurar Supabase e EAS, publicar nas lojas, monitorar, responder a incidentes e
  reverter versões.
code:
  - eas.json
  - app.json
  - supabase/migrations/20261001000000_init.sql
  - docs/operations/metrics.sql
last_verified_commit: F7-VERIFIED
---

# Runbook de operação

## 1. Ambientes e variáveis

| Variável | Onde | Pública? |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | EAS env (`preview`, `production`) e `.env.local` em dev | Sim (vai no app) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | idem | Sim (protegida por RLS) |
| `EXPO_PUBLIC_SENTRY_DSN` | idem (quando T-013 for feita) | Sim |
| `service_role` do Supabase | **Somente** no painel do Supabase. Nunca no app, no repositório nem no EAS | **Não** |

```bash
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <anon> --visibility plaintext
# repetir para --environment preview
```

Sem essas variáveis, o build sai em **modo local** (sem sync), que é o comportamento esperado.

## 2. Configurar o Supabase (uma vez)

1. Criar o projeto na região **South America (São Paulo) — sa-east-1**.
2. Aplicar o schema:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push          # aplica supabase/migrations/*
   ```
3. **Authentication → Sign In / Providers → Email:** habilitado; **"Confirm email" desligado**;
   **Minimum password length = 8** (ADR-011). Assim, nenhum e-mail é enviado.
4. **SMTP e templates (opcional):** só são necessários para adicionar "Esqueci a senha" no futuro.
   Sem SMTP próprio, o Supabase não permite editar templates e limita o envio a ~2 e-mails por hora.
5. **Auth → Rate limits:** manter os padrões; avaliar CAPTCHA se houver abuso.
6. **Backups:** o plano Free não oferece backup diário com restauração (PITR). Como os dados também
   ficam em cada aparelho e podem ser exportados, isso é aceitável no lançamento. Migrar para o
   plano Pro ao passar de ~500 usuários ativos.

Validação local do schema, sem projeto: `npm run test:db`.

## 3. Builds (EAS)

| Perfil | Uso | Saída |
|---|---|---|
| `development` | Dev client | APK/IPA interno |
| `preview` | Teste em aparelho | **APK** (Android) |
| `production` | Lojas | AAB (Android) / IPA (iOS), `autoIncrement` do número de build |

```bash
npx eas-cli build -p android --profile preview      # APK para instalar direto
npx eas-cli build -p android --profile production   # AAB para a Play Store
npx eas-cli build -p ios --profile production       # exige conta Apple Developer
```

A versão exibida (`app.json → expo.version`) é alterada manualmente a cada release (semver). O
número de build é controlado pelo EAS (`appVersionSource: remote`).

## 4. Checklist de publicação

### Comum

- [ ] E-mail de contato definido em `src/legal/privacy-policy.ts` e no espelho em `docs/legal/`
- [ ] Política de privacidade publicada em uma URL pública (GitHub Pages, Notion público ou site)
- [ ] Supabase configurado (§2), com SMTP próprio
- [ ] Campanha de QA manual (`docs/quality/manual-qa.md`) executada em pelo menos 1 aparelho Android e 1 iOS
- [ ] `npm run verify` e `npm run test:db` verdes no commit da release

### Google Play

- [ ] Conta Google Play Console (taxa única de US$ 25)
- [ ] Ficha: nome, descrição curta e longa, ícone 512 px, gráfico de destaque 1024×500, ao menos 2 capturas de tela
- [ ] **Segurança dos dados:** coleta de e-mail (gestão de conta) e informações financeiras (funcionalidade do app); criptografados em trânsito; o usuário pode pedir exclusão
- [ ] **Exclusão de conta:** o Google exige também um **link web** onde o usuário possa pedir a exclusão sem o app. Publicar uma página simples com instruções e o e-mail de contato
- [ ] Classificação de conteúdo (questionário) e público-alvo (18+, app financeiro)
- [ ] Teste fechado com **12 testadores por 14 dias** (exigência para contas pessoais novas) antes da produção

### App Store

- [ ] Conta Apple Developer (US$ 99/ano)
- [ ] Privacy Nutrition Labels: e-mail e dados financeiros, vinculados ao usuário, sem rastreamento
- [ ] Exclusão de conta dentro do app ✓ (diretriz 5.1.1(v))
- [ ] Sign in with Apple **não** é necessário: só há login por e-mail (ADR-005)
- [ ] Capturas de tela 6,7" e 6,5"

## 5. Monitoramento (ver F7)

- **Crash-free (M5):** Sentry release health, depois de T-013.
- **Métricas de produto (M1–M4, M6):** `docs/operations/metrics.sql` no SQL Editor do Supabase,
  semanalmente.
- **Supabase → Reports:** uso de banco, egress e requisições de Auth (gatilho de upgrade: 80% da cota).

## 6. Resposta a incidentes

| Severidade | Exemplo | Resposta |
|---|---|---|
| SEV1 | Perda ou corrupção de dados; vazamento entre contas | Imediata. Pausar o rollout, comunicar usuários, post-mortem em até 48 h |
| SEV2 | Sync ou login indisponível para todos | Em até 4 h |
| SEV3 | Erro em um fluxo com contorno | Próxima release |

### Playbooks

**Login: "não consigo entrar" / "esqueci a senha"**
1. Supabase → Auth → Logs: procurar `invalid_credentials` ou erros de rate limit.
2. Sem SMTP não há recuperação de senha (ADR-011). Contorno: o usuário segue no modo local com
   seus dados; um administrador pode redefinir a senha em Authentication → Users.
3. Se aparecer "Confirme o cadastro", o "Confirm email" foi religado: desligar (§2.3).

**Sync falhando para muitos usuários**
1. Supabase → API Logs: erros 4xx/5xx por tabela.
2. Erro `42501` em massa indica política RLS quebrada por uma migration recente. Fazer forward-fix (§7).
3. Erro `23505` frequente em `cycles` indica bug de cliente. Verificar a versão do app.
4. Os dados não se perdem: o outbox local mantém as pendências até o servidor voltar.

**Usuário relata "Erro ao carregar"**
1. Pedir "Exportar dados brutos" na própria tela de erro.
2. Analisar o JSON (é o documento v2 ou as chaves v1) e corrigir com uma migração no app.
3. Os dados originais nunca são sobrescritos (SPEC-004).

**Pico de crashes após uma release**
1. Play Console: **interromper o lançamento gradual**. App Store: **pausar a liberação em fases**.
2. Corrigir e publicar uma nova build (§7).

## 7. Rollback

| Componente | Como reverter |
|---|---|
| App Android | Interromper o rollout gradual; publicar uma nova build com o código anterior e `versionCode` maior (a loja não aceita versão menor) |
| App iOS | Pausar a liberação em fases; nova build com o código anterior |
| Banco | **Nunca** editar uma migration aplicada. Criar uma migration de correção (forward-fix). Antes de qualquer migration destrutiva: `supabase db dump` |
| Contrato remoto | Mudança incompatível exige nova migration + `CONTRACT_VERSION` + ADR (skill `criar-migration-supabase`) |

**Rollback testado:** a reversão de cliente é por build. A de banco foi validada pela recriação
completa do schema em ambiente descartável (`npm run test:db`), que é o mesmo procedimento usado
para validar um forward-fix antes de aplicá-lo.

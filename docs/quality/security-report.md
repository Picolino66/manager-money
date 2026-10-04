---
id: quality.security-report
type: module
module: quality
title: Relatório de segurança (F6)
summary: >
  Resultado do security-testing-engine: auditoria de dependências com triagem, testes de RLS,
  varredura de segredos, verificação do threat model e achados de revisão de código.
code:
  - supabase/migrations/20261001000000_init.sql
  - app/src/infrastructure/supabase/session-storage.ts
  - app/src/infrastructure/export/share-json.ts
  - packages/core/src/application/export-data.ts
  - client/security/headers.ts
  - client/src/infrastructure/repository.ts
  - client/src/infrastructure/monitoring/logger.ts
adrs: [ADR-006, ADR-020]
last_verified_commit: 7903717+T-041
---

# Relatório de segurança — F6

Data: 2026-10-01 · Escopo: app (bundle Android) + schema Supabase + CI.

## 1. Dependências (SCA)

| Momento | Crítica | Alta | Moderada | Baixa |
|---|---|---|---|---|
| Antes (`359de21`) | 1 | 7 | 13 | 1 |
| Depois de `npm audit fix` (sem `--force`, só lockfile) | **0** | 2 | 10 | 0 |

**Triagem das restantes** (todas exigem `--force` = troca de major do Expo SDK):

| Pacote | Caminho | Executa onde | Risco no app publicado | Decisão |
|---|---|---|---|---|
| `image-size` (alta) | expo → @expo/metro → metro | Metro (build/dev server) | Nenhum: não entra no bundle Hermes | Aceito até o SDK 55 |
| `postcss` (alta) | expo → @expo/metro-config | Metro (CSS web) | Nenhum | Aceito até o SDK 55 |
| `uuid` via `xcode` (moderada) | @expo/config-plugins | Prebuild iOS | Nenhum | Aceito até o SDK 55 |
| `@expo/*`, `expo`, `expo-asset`, `expo-constants` (moderada) | Propagação das acima | Build | Nenhum | Aceito até o SDK 55 |

A CI bloqueia vulnerabilidade **crítica** (`npm audit --omit=dev --audit-level=critical`).
**Gatilho de revisão:** upgrade para o Expo SDK 55 (`maintenance-engine`).

### Reavaliação após o upgrade para o Expo SDK 57 (ADR-012, 2026-10-03)

| Item | Resultado |
|---|---|
| `image-size`, `postcss` (altas acima) | **Resolvidas** pelo SDK 57 |
| Críticas | **0** |
| `braces` ≤ 3.0.3 (alta, DoS por expansão) | Via Metro e Jest (`micromatch`). **Sem versão corrigida publicada.** Tooling local; não entra no bundle |
| `node-forge` ≤ 1.4.0 (alta, verificação de assinatura RSA) | Via `@expo/code-signing-certificates` (CLI, assinatura de EAS Update, que não usamos). **Sem versão corrigida publicada** |
| `uuid` < 11.1.1 (moderada) | Via `xcode` (prebuild iOS). Falha em v3/v5/v6 com `buf`; o `xcode` usa só v4, então **não é explorável** |

O total do `npm audit` (24 altas e 9 moderadas) é quase todo propagação dessas três causas. A CI
continua bloqueando só vulnerabilidade crítica. **Gatilho:** quando `braces` ou `node-forge`
publicarem correção, rodar `npm audit fix` (`maintenance-engine`).

## 2. Isolamento de dados (DAST de banco)

`npm run test:db`: 12/12 asserções em Postgres 15 (isolamento A×B em leitura e escrita,
`anon` sem acesso, DELETE físico negado, índice de ciclo ativo, constraints de valor,
`delete_my_account` em cascata e negado para `anon`).

## 3. Segredos

Varredura por padrões (JWT, `service_role`, chaves privadas, AWS, atribuições de senha) nos arquivos
versionados: **0 achados**. `.env*` está no `.gitignore` (exceto `.env.example`, vazio). Na CI: gitleaks.

## 4. Verificação do threat model (ADR-006)

| Ameaça | Controle | Evidência |
|---|---|---|
| Token roubado do armazenamento | Sessão AES-256-CTR, chave no SecureStore | `session-storage.test.ts`: o texto do token não aparece no AsyncStorage |
| Escrita em nome de outro usuário | RLS `WITH CHECK` | RLS 12/12 |
| Vazamento em logs | Lista permitida no logger | `logger.test.ts` |
| Dados exportados residuais | Arquivo apagado após o compartilhamento | `share-json.test.ts` (corrigido na F6) |
| Força bruta de senha (ADR-011) | Mínimo de 8 caracteres + rate limit do Supabase Auth | `session.store.test.ts` + runbook §2 |

## 5. Achados de revisão de código

| # | Achado | Severidade | Status |
|---|---|---|---|
| S1 | JSON exportado permanecia no cache após o compartilhamento | Baixa | **Corrigido** |
| S2 | Campos de formulário sem rótulo acessível (descoberto pelos testes de UI) | Baixa (a11y) | **Corrigido** |
| S3 | AES-CTR sem MAC: um atacante com acesso de escrita ao armazenamento do app poderia corromper a sessão | Baixa | Aceito: o resultado é sessão inválida (novo login), nunca acesso indevido |
| S4 | SMTP padrão do Supabase tem limite baixo de e-mails por hora | Média (disponibilidade) | **Resolvido pela ADR-011**: o login não envia e-mail |
| S5 | E-mail não verificado no cadastro (confirmação desligada) | Baixa | Aceito na ADR-011: a conta só contém dados de quem a criou |
| S6 | Sem recuperação de senha | Média (usabilidade) | Aceito até haver SMTP; dados locais e exportação continuam disponíveis |

**Veredito:** nenhuma vulnerabilidade crítica ou alta sem mitigação no app publicado.

## 6. Client web (CLIENT-015, 2026-10-04)

Auditoria focada (`fullstack-security-guardian`) do `client/` (SPA React + Vite, supabase-js, sem sync).

| Verificação | Resultado |
|---|---|
| XSS: `dangerouslySetInnerHTML`, `innerHTML`, `eval` | nenhum uso; `dangerouslySetInnerHTML` proibido por lint (`no-restricted-syntax`) |
| CSP (`client/security/headers.ts`) | `script-src 'self'` sem `unsafe-inline`; `connect-src` só o Supabase; `frame-ancestors 'none'`; `object-src 'none'`. E2E confirma o cabeçalho no `vite preview` e nenhuma violação no console |
| Demais cabeçalhos | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP; HSTS nos exemplos Nginx/Caddy (só com HTTPS), testados para ficarem iguais a `headers.ts` |
| Bundle | sem `service_role`, sem sourcemap, um único `<script>` externo; build falha sem `VITE_SUPABASE_*` |
| Armazenamento no navegador | só a sessão do supabase-js e a preferência de tema; lint proíbe `localStorage` fora de `theme-preference.ts` e `sessionStorage`/`indexedDB`; E2E verifica as chaves |
| Logs | logger com lista permitida (`ok`, `durationMs`, `code`, `count`, `table`); teste garante que e-mail, token, valores e descrições são descartados |
| Autorização | RLS `(select auth.uid()) = user_id` nas 9 tabelas (mesma suíte `supabase/tests/rls.plain.sql`); `user_id` das linhas vem da sessão e o `WITH CHECK` recusa outro usuário. Guarda de rota é só UX |
| Escrita | só via casos de uso do núcleo + `collectDirty`; lint impede telas de importar `@supabase/supabase-js`, `infrastructure` ou o contrato |
| URLs | sem dados financeiros em URL (só `?novo=1`); redirecionamento pós-login usa estado interno do roteador (sem open redirect) |
| Dependências de produção do client | `npm audit --omit=dev -w client`: **0 vulnerabilidades** |

**Achados**

| ID | Severidade | Achado | Estado |
|---|---|---|---|
| WEB-01 | Média | Sessão no `localStorage` exposta a XSS (inerente à SPA, ADR-020) | Aceito com mitigação (CSP estrita, sem HTML dinâmico, dependências enxutas) |
| WEB-02 | Média | Login e cadastro sem CAPTCHA; força bruta depende do rate limit nativo do Supabase Auth, e o cadastro sem confirmação de e-mail (ADR-011) permite criar contas com qualquer e-mail | **Aberto**: decidir CAPTCHA (hCaptcha/Turnstile no Supabase Auth, exige liberar o domínio na CSP) antes da VPS |
| WEB-03 | Baixa | `style-src 'unsafe-inline'` (Radix e sonner aplicam estilos inline) | Aceito: não executa código |
| WEB-04 | Baixa | Texto da política de privacidade diz que a sessão fica "criptografada no aparelho" (verdade no mobile, não no navegador) | **Aberto** (revisão do dono do produto): a página web mostra uma nota explicando a diferença; o texto jurídico não foi alterado |
| WEB-05 | Info | Sair encerra só a sessão deste navegador (`scope: 'local'`), não a do celular | Por desenho |
| WEB-06 | Info | Exportar dados (SPEC-023) baixa um JSON financeiro sem proteção, iniciado pelo usuário; o conteúdo vem de `buildExportPayload` (núcleo, sem sessão, BR-ACC-004), vive só no `Blob` e o endereço temporário é liberado na hora; a tela avisa para guardar o arquivo com cuidado | Por desenho |

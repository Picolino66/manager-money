---
id: business.requirements
type: module
module: business
title: Requisitos, escopo, viabilidade e métricas
summary: >
  Requisitos funcionais e não funcionais da v1.0, limites de escopo, defeitos herdados do MVP,
  análise de viabilidade e métricas de sucesso.
code:
  - src/store/financial.store.ts
last_verified_commit: 5de5c5b
---

# Requisitos, escopo, viabilidade e métricas — v1.0 (lojas)

## 1. Requisitos funcionais

| ID | Requisito | Regras | Status |
|---|---|---|---|
| RF-01 | Configurar renda mensal, meta de economia e despesas fixas | BR-FIN-004, BR-FIN-015 | existente |
| RF-02 | Cadastrar parcelamentos com total e restantes | BR-FIN-010 | existente |
| RF-03 | Abrir ciclo com prévia (saldo, dias, limite inicial) | BR-FIN-002, 005, 013, 017 | existente → ajuste |
| RF-04 | Ver o limite de hoje, o gasto de hoje e o status no dashboard | BR-FIN-007, 008, 009 | existente |
| RF-05 | Registrar e editar gastos | BR-FIN-011, 012 | existente |
| RF-06 | **Excluir gasto** | BR-FIN-011 | **novo** |
| RF-07 | Histórico diário do ciclo com saldo por dia | BR-FIN-007, 008 | existente |
| RF-08 | Ciclos anteriores com resultado final | BR-FIN-006 | existente |
| RF-09 | Análise por categoria e período, com gráfico | BR-FIN-012 | existente |
| RF-10 | Recebimento antecipado ("Já recebi") | BR-FIN-003, 016 | existente → correção |
| RF-11 | Fechar ciclo manualmente | BR-FIN-006, 017 | existente → correção |
| RF-12 | **Dia de pagamento configurável** | BR-FIN-002 | **novo** |
| RF-13 | **Criar conta e entrar** com código OTP enviado por e-mail (login social na v1.1, ver ADR-005) | BR-ACC-001 | **novo** |
| RF-14 | **Sincronizar dados entre aparelhos**, offline-first | BR-SYNC-* | **novo** |
| RF-15 | **Migrar dados locais** no primeiro login | BR-ACC-002 | **novo** |
| RF-16 | **Excluir conta** e dados na nuvem | BR-ACC-003 | **novo** |
| RF-17 | **Exportar dados** em JSON | BR-ACC-004 | **novo** |
| RF-18 | **Sair da conta** mantendo ou apagando os dados locais | BR-ACC-001 | **novo** |

## 2. Requisitos não funcionais

| ID | Requisito | Meta |
|---|---|---|
| RNF-01 | Desempenho: abrir o app até o limite de hoje visível | ≤ 2 s em aparelho intermediário (cold start) |
| RNF-02 | Offline: todas as funções de RF-01 a RF-12 sem internet | 100% |
| RNF-03 | Integridade: nenhuma escrita parcial de estado após um crash | escrita atômica |
| RNF-04 | Segurança: isolamento por usuário no servidor; tokens em armazenamento seguro | RLS + SecureStore |
| RNF-05 | Privacidade: LGPD (base legal: execução de contrato); política publicada | obrigatório para as lojas |
| RNF-06 | Estabilidade | sessões sem crash ≥ 99,5% |
| RNF-07 | Acessibilidade: rótulos acessíveis, contraste AA, toques ≥ 44 pt | todas as telas |
| RNF-08 | Idioma: textos visíveis em pt-BR com acentuação correta | 100% |
| RNF-09 | Qualidade: cobertura de testes do domínio, store e sync | ≥ 80% de linhas |
| RNF-10 | Compatibilidade | Android 7+ (API 24), iOS 15.1+ (mínimos do Expo SDK 54) |

## 3. Defeitos herdados do MVP (identificados no discovery)

| ID | Defeito | Severidade | Regra violada |
|---|---|---|---|
| DEF-001 | "Já recebi" pode ser acionado várias vezes nos dias 1–6. Cada acionamento fecha um ciclo vazio, descarta o saldo positivo e **avança as parcelas de novo**. | Alta | BR-FIN-010 / BR-FIN-016 |
| DEF-002 | Escritas em várias chaves do AsyncStorage via `Promise.all` não são atômicas: um crash entre elas deixa config e ciclo inconsistentes. | Alta | RNF-03 |
| DEF-003 | Não é possível excluir um gasto lançado por engano. | Média | RF-06 |
| DEF-004 | Falha ao carregar dados (`error` na store) nunca é exibida; o app abre como se não houvesse dados. | Média | RNF-03 |
| DEF-005 | Textos da UI sem acentuação ("Configuracao", "Historico", "Divida"). | Média | RNF-08 |
| DEF-006 | Fechar o ciclo no meio do período e iniciar outro **recria o mesmo período**, duplicando datas no histórico e avançando parcelas. | Alta | BR-FIN-017 |
| DEF-007 | "Iniciar ciclo" não trata erro: a exceção é rejeitada sem feedback ao usuário. | Baixa | — |
| DEF-008 | Testes cobrem só o domínio, com um runner ad hoc e sem medição de cobertura. | Média | RNF-09 |
| DEF-009 | Dia 7 fixo no código impede o uso por quem recebe em outra data. Bloqueia o lançamento público. | Alta | BR-FIN-002 |

## 4. Escopo

### Incluído na v1.0

RF-01 a RF-18; correção de DEF-001 a DEF-009; publicação na Play Store e na App Store; política
de privacidade; crash reporting sem dados financeiros.

### Excluído da v1.0 (explicitamente)

- Renda variável ou múltiplas fontes de renda por ciclo
- Orçamento compartilhado entre usuários (família ou casal)
- Integração bancária / Open Finance / leitura de SMS e notificações
- Multimoeda
- Notificações push e lembretes (candidatos à v1.1)
- Versão web
- Edição de gastos de ciclos fechados
- Tema escuro (candidato à v1.1)
- Monetização (assinaturas, anúncios)

## 5. Viabilidade (`feasibility-analysis-engine`)

| Dimensão | Avaliação | Riscos e mitigação |
|---|---|---|
| Técnica | Viável | Sync offline-first é o maior risco. Mitigação: modelo de entidades simples, LWW por registro e BaaS com Postgres e RLS, sem servidor próprio |
| Financeira | Viável | Faixas gratuitas de BaaS e EAS cobrem o lançamento. Custo fixo: Apple Developer (US$ 99/ano) + Google Play (US$ 25, pagamento único) |
| Operacional | Viável com riscos | Desenvolvedor solo: CI, testes automatizados e runbooks reduzem a carga. Revisão das lojas pode rejeitar o app (exclusão de conta, Sign in with Apple, política de privacidade), o que é mitigado por checklist em F6 |
| Regulatória | Viável | LGPD: dados financeiros pessoais sem categoria sensível; política de privacidade + exclusão de conta + dados em região compatível |

**Veredito: `VIÁVEL_COM_RISCOS`.**

## 6. Métricas de sucesso (`metrics-definition-engine`)

| ID | Métrica | Definição | Meta (90 dias após o lançamento) |
|---|---|---|---|
| M1 | Ativação | % de instalações que configuram a base e abrem o 1º ciclo em até 24 h | ≥ 50% |
| M2 | Engajamento | Mediana de gastos registrados por usuário ativo por semana | ≥ 5 |
| M3 | Resultado | % de ciclos fechados com saldo final ≥ 0 | ≥ 60% |
| M4 | Retenção | D30 (usuários que abrem o app no 30º dia) | ≥ 25% |
| M5 | Estabilidade | Sessões sem crash | ≥ 99,5% |
| M6 | Sync | Operações de push/pull concluídas sem erro | ≥ 99% |

Todas as métricas são calculáveis por eventos **sem valores financeiros** (BR-ACC-006).

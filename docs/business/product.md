---
id: business.product
type: module
module: business
title: Visão de produto
summary: >
  Visão, mercado, modelo de negócio, personas e hipótese de MVP do Manager Money.
code:
  - app/src/domain/financial/financial.calculations.ts
  - app/src/domain/financial/projection.ts
last_verified_commit: bfe9de6+T-028
---

# Visão de produto — Manager Money

> Fase F1 (Discovery & Strategy). Discovery reverso: comportamento extraído do código em `5de5c5b`
> e restrições informadas pelo dono do produto em 2026-10-01.

## 1. Problema

Quem recebe uma renda mensal fixa tem dificuldade em transformar "quanto sobra no mês" em uma
decisão diária concreta. Planilhas e apps de controle financeiro mostram **o passado** (quanto foi
gasto por categoria), mas não respondem a pergunta que importa na hora da compra:

> **"Quanto eu ainda posso gastar hoje sem comprometer o resto do mês — e continuar atingindo minha
> meta financeira?"**

## 2. Proposta de valor

Um único número diário, recalculado automaticamente a cada gasto:

```
limite de hoje = (saldo disponível do ciclo − gastos anteriores a hoje) ÷ dias restantes do ciclo
```

Gastar menos hoje aumenta o limite dos próximos dias; gastar mais reduz. O saldo do ciclo já nasce
sem a **meta de economia** e sem as **despesas fixas** do ciclo (as pendentes ficam reservadas até o
pagamento); rendas avulsas somam, e a dívida de um ciclo negativo é herdada pelo próximo.

O cartão de crédito é tratado como **compromisso futuro**: cada compra entra numa fatura, e a fatura
pesa no ciclo em que **vence** — não no dia da compra. Por isso o app separa duas coisas que o
usuário costuma confundir:

| O app mostra | O que é | O que não é |
|---|---|---|
| **Ainda pode gastar hoje** | Dinheiro do ciclo, depois de meta, fixas, faturas do ciclo e dívida | — |
| **Limite disponível do cartão** | Quanto o banco ainda aceita no cartão (limite − parcelas ainda não amortizadas; pagamento parcial libera parcial) | **Não é dinheiro disponível**: gastar no cartão compromete ciclos futuros |

Para não haver surpresa, a tela Hoje mostra os **próximos compromissos** (faturas a pagar e fixas
pendentes) e a **projeção** dos próximos ciclos: renda − meta − fixas − faturas já contratadas =
"livre antes de novos gastos" ([SPEC-018](../../specs/SPEC-018-hoje-compromissos-e-projecao.md),
[ADR-017](../../adr/ADR-017-faturas-limite-e-situacao-inicial.md)). Quem já chega com fatura aberta
ou parcelamentos registra a **situação inicial** do cartão, sem contar de novo o que já pagou.

## 3. Contexto de mercado

| Segmento | Exemplos | Lacuna explorada |
|---|---|---|
| Controle por categoria | Mobills, Organizze, Minhas Economias | Foco em registro e relatório; não entregam limite diário dinâmico |
| Open Finance / agregadores | Apps de bancos, Guiabolso (descontinuado) | Dependem de integração bancária e de consentimento; complexos |
| Método de envelopes | YNAB (em inglês, pago, curva de aprendizado alta) | Pouco aderente ao público brasileiro |
| Planilhas | Google Sheets, Excel | Atrito alto no celular; sem recálculo diário automático |

**Diferencial:** simplicidade radical (um número), ciclo alinhado ao dia do pagamento, suporte
nativo a parcelamento no cartão (hábito brasileiro), com faturas, limite e projeção dos próximos
ciclos, e funcionamento offline.

## 4. Modelo de negócio

| Item | Decisão F1 |
|---|---|
| Distribuição | Google Play Store e Apple App Store |
| Monetização v1.0 | Gratuito, sem anúncios. Objetivo é validar retenção antes de monetizar |
| Monetização futura (hipótese) | Freemium: sync e backup gratuitos; recursos avançados (múltiplos orçamentos, relatórios, compartilhamento) pagos |
| Custo-alvo de infraestrutura | Faixa gratuita do provedor até ~1.000 usuários ativos mensais |

## 5. Personas

### P1 — Ana, assalariada com orçamento apertado (persona primária)

- 28 anos, CLT, recebe salário em data fixa; usa cartão de crédito com compras parceladas.
- **Objetivo:** chegar ao fim do mês sem entrar no cheque especial e guardar um valor fixo.
- **Dores:** perde a noção de quanto pode gastar no dia a dia; parcelas "somem" do radar; apps
  existentes exigem categorizar tudo e mostram só relatórios.
- **Comportamento:** abre o app no celular várias vezes por dia, registra o gasto na hora da compra,
  muitas vezes sem internet (metrô, mercado).
- **Critério de sucesso para ela:** ver "posso gastar R$ X hoje" em menos de 3 segundos.

### P2 — Bruno, usa dois aparelhos e tem medo de perder dados (persona secundária)

- 35 anos, alterna entre celular pessoal Android e iPhone do trabalho; já perdeu dados ao trocar de
  aparelho.
- **Objetivo:** ter os mesmos dados em qualquer aparelho e não perder o histórico.
- **Dores:** apps locais perdem tudo ao desinstalar; não confia em apps que pedem acesso ao banco.
- **Critério de sucesso para ele:** registrar no Android e ver no iPhone em segundos, com login
  simples e opção de excluir a conta.

### Não-persona (fora do público v1.0)

- **Autônomo com renda variável:** o modelo de cálculo assume renda mensal previsível (soma das fontes cadastradas).
- **Família com orçamento compartilhado:** exige permissões multiusuário; está fora do escopo v1.0.

## 6. Hipótese de MVP

> **H1:** Pessoas com renda mensal fixa que veem um limite diário recalculado automaticamente
> registram gastos com frequência (≥ 5 por semana) e terminam mais ciclos com saldo ≥ 0 do que no
> primeiro ciclo de uso.
>
> **H2:** Sync em nuvem com login simples aumenta a retenção D30 de usuários com mais de um
> aparelho e reduz o abandono por perda de dados.

### Validação (`mvp-validation-engine`)

| Critério | Evidência atual | Como validar após o lançamento |
|---|---|---|
| O núcleo de cálculo resolve o problema | Uso diário pelo autor desde abr/2026 com 7 telas funcionais | Métrica M3: % de ciclos fechados com saldo ≥ 0 |
| Registro rápido e frequente | Fluxo "Registrar" a 1 toque do dashboard | Métrica M2: gastos por usuário ativo por semana |
| Sync gera retenção | Ainda não há evidência; é hipótese | Comparar D30 entre usuários com 1 aparelho e com 2 ou mais |

**Veredito:** H1 está **pré-validada** (problema e solução verificados por uso real em pequena
escala). H2 está **declarada e não validada**: só será confirmada com métricas pós-lançamento.
Isso é aceitável para avançar, porque sync também cumpre um requisito de proteção de dados.

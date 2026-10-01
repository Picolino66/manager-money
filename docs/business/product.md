---
id: business.product
type: module
module: business
title: Visão de produto
summary: >
  Visão, mercado, modelo de negócio, personas e hipótese de MVP do Manager Money.
code:
  - src/domain/financial/financial.calculations.ts
last_verified_commit: F5-PENDING
---

# Visão de produto — Manager Money

> Fase F1 (Discovery & Strategy). Discovery reverso: comportamento extraído do código em `5de5c5b`
> e restrições informadas pelo dono do produto em 2026-10-01.

## 1. Problema

Quem recebe uma renda mensal fixa tem dificuldade em transformar "quanto sobra no mês" em uma
decisão diária concreta. Planilhas e apps de controle financeiro mostram **o passado** (quanto foi
gasto por categoria), mas não respondem a pergunta que importa na hora da compra:

> **"Quanto eu ainda posso gastar hoje sem comprometer o resto do mês?"**

## 2. Proposta de valor

Um único número diário, recalculado automaticamente a cada gasto:

```
limite de hoje = (saldo disponível do ciclo − gastos anteriores a hoje) ÷ dias restantes do ciclo
```

Gastar menos hoje aumenta o limite dos próximos dias; gastar mais reduz. Despesas fixas,
parcelamentos e meta de economia são descontados antes, e a dívida de um ciclo negativo é herdada
pelo próximo.

## 3. Contexto de mercado

| Segmento | Exemplos | Lacuna explorada |
|---|---|---|
| Controle por categoria | Mobills, Organizze, Minhas Economias | Foco em registro e relatório; não entregam limite diário dinâmico |
| Open Finance / agregadores | Apps de bancos, Guiabolso (descontinuado) | Dependem de integração bancária e de consentimento; complexos |
| Método de envelopes | YNAB (em inglês, pago, curva de aprendizado alta) | Pouco aderente ao público brasileiro |
| Planilhas | Google Sheets, Excel | Atrito alto no celular; sem recálculo diário automático |

**Diferencial:** simplicidade radical (um número), ciclo alinhado ao dia do pagamento, suporte
nativo a parcelamento no cartão (hábito brasileiro) e funcionamento offline.

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

- **Autônomo com renda variável:** o modelo de cálculo assume renda mensal única e previsível.
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

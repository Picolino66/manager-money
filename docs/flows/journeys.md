---
id: flows.journeys
type: flow
module: flows
title: Jornadas, wireframes e avaliação de usabilidade
summary: >
  Jornadas críticas por persona, wireframes dos fluxos novos da v1.0 (conta, sync, exclusão,
  exportação, dia de pagamento) e avaliação heurística das telas existentes.
code:
  - src/navigation/AppNavigator.tsx
last_verified_commit: 52be7e8
---

# Jornadas, wireframes e usabilidade

## 1. Mapa de navegação v1.0

```
Stack raiz
├── MainTabs
│   ├── Hoje (Dashboard)            ← tela inicial
│   ├── Histórico (DailyHistory)
│   ├── Ciclos (PreviousMonths)
│   ├── Categorias (Categories)
│   └── Ajustes (Settings)          ← NOVA aba
├── Config            (configuração financeira)
├── StartMonth        (abrir ciclo)
├── AddExpense        (registrar / editar / excluir gasto)
├── Account           (NOVA: entrar, sync, sair, excluir conta)
└── PrivacyPolicy     (NOVA: política de privacidade)
```

## 2. Jornadas críticas

### FLOW-primeiro-uso (P1)

1. Abre o app → Hoje mostra "Configuração inicial" → **Configurar**
2. Informa renda, meta e **dia de pagamento** (novo, padrão 7) → adiciona fixos e parcelamentos → **Salvar**
3. É levada a **Abrir ciclo** → vê a prévia (saldo, período, dias, limite inicial) → **Iniciar ciclo**
4. Volta a Hoje e vê "Ainda pode gastar R$ X"

**Meta:** concluir em ≤ 3 min (M1). **Risco:** formulário longo. Os fixos ficam recolhidos por
padrão, o que já reduz a carga.

### FLOW-registrar-gasto (P1, mais frequente)

1. Hoje → **Registrar** → valor (teclado numérico) → categoria → descrição → data (hoje por padrão)
2. **Salvar gasto** → volta a Hoje com o valor atualizado

**Meta:** ≤ 10 s. O lançamento errado é corrigido em Histórico → toque no gasto → **Editar** ou
**Excluir** (novo).

### FLOW-receber-antecipado (P1)

1. Antes do dia de pagamento, Hoje mostra **Já recebi** *somente* se o ciclo ativo terminar antes
   do próximo pagamento (BR-FIN-016)
2. Confirmação → o ciclo atual é fechado e um novo é aberto a partir de hoje

### FLOW-fim-de-ciclo (P1)

1. Depois do fim do período, Hoje mostra o aviso "Ciclo encerrado em dd/MM" e **Fechar ciclo**
2. Antes do fim, **Fechar ciclo** fica indisponível e mostra o motivo (BR-FIN-017)
3. Fechar → Ciclos mostra o resultado → Hoje oferece **Iniciar ciclo**

### FLOW-ativar-sync (P2)

1. Ajustes → **Conta e sincronização** → e-mail → **Enviar código**
2. Digita o código de 6 dígitos → **Entrar**
3. Se houver dados locais **e** na nuvem: escolhe "Usar dados da nuvem" ou "Manter dados deste
   aparelho" (BR-ACC-002), com o resumo de cada lado
4. Status: "Sincronizado agora" / "3 alterações pendentes" / "Sem conexão"

### FLOW-segundo-aparelho (P2)

1. Instala no iPhone → Ajustes → entra com o mesmo e-mail → dados da nuvem são baixados
2. Registra um gasto offline → reconecta → aparece no Android em segundos

### FLOW-sair-e-excluir (P2, exigência das lojas)

- **Sair:** escolher entre "Manter dados neste aparelho" ou "Apagar dados deste aparelho"
- **Excluir conta:** aviso irreversível → confirmação → RPC → dados locais de sync limpos →
  volta ao modo local

## 3. Wireframes (fluxos novos)

```
┌ Ajustes ─────────────────────┐   ┌ Conta e sincronização ───────┐
│ Configuração financeira    › │   │  (deslogado)                 │
│ Conta e sincronização      › │   │  Sincronize entre aparelhos  │
│   ana@email.com · em dia     │   │  e não perca seus dados.     │
│ Exportar dados (JSON)      › │   │  E-mail [______________]     │
│ Política de privacidade    › │   │  [   Enviar código   ]       │
│                              │   │  ─────────────────────────   │
│ Versão 1.0.0                 │   │  Código  [______]            │
└──────────────────────────────┘   │  [      Entrar      ]        │
                                   └──────────────────────────────┘
┌ Conta e sincronização ───────┐   ┌ Editar gasto ────────────────┐
│  (logado)                    │   │ Valor      [R$ 25,00]        │
│  ana@email.com               │   │ Categoria  [Alimentação ▾]   │
│  ● Sincronizado às 14:32     │   │ Descrição  [Almoço]          │
│  [ Sincronizar agora ]       │   │ Data       [08/10/2026]      │
│  [ Sair da conta ]           │   │ [  Salvar alterações  ]      │
│  ─────────────────────────   │   │ [  Excluir gasto  ] (perigo) │
│  [ Excluir conta ] (perigo)  │   └──────────────────────────────┘
└──────────────────────────────┘
┌ Configuração financeira ─────┐   ┌ Erro ao carregar ────────────┐
│ Renda mensal   [R$ 8.800,00] │   │  ⚠ Não foi possível ler os   │
│ Meta mensal    [R$ 1.500,00] │   │  dados salvos.               │
│ Dia do pagamento [ 7 ]  (1–28)│  │  [ Tentar novamente ]        │
│ ...                          │   │  [ Exportar dados brutos ]   │
└──────────────────────────────┘   └──────────────────────────────┘
```

## 4. Avaliação heurística (`usability-testing-engine`)

Método: heurísticas de Nielsen aplicadas às jornadas acima, sobre o código em `52be7e8`.
Severidade de 0 a 4.

| # | Achado | Heurística | Sev. | Ação v1.0 |
|---|---|---|---|---|
| U1 | Textos sem acento ("Configuracao", "Historico", "Divida", "Ja recebi") | Consistência e padrões | 3 | Revisar 100% dos textos (DEF-005) |
| U2 | Não há como excluir um gasto lançado errado | Controle e liberdade | 3 | Botão Excluir na edição (RF-06) |
| U3 | "Já recebi" aparece em situações em que corrompe dados | Prevenção de erros | 4 | Regra BR-FIN-016 na UI e no caso de uso |
| U4 | "Fechar ciclo" no meio do período recria o mesmo período | Prevenção de erros | 4 | BR-FIN-017: desabilitado com explicação |
| U5 | Falha de leitura dos dados aparece como app "vazio" | Visibilidade do status | 4 | Tela de erro com recuperação (DEF-004) |
| U6 | Datas digitadas como texto `DD/MM/AAAA` | Prevenção de erros | 2 | Mantido na v1.0, com validação e máscara; seletor nativo na v1.1 |
| U7 | Erro ao iniciar ciclo é silencioso | Visibilidade do status | 2 | Alert com mensagem (DEF-007) |
| U8 | Hero mostra o saldo do dia com selo de status colorido | Reconhecimento | 0 | Bom. Manter; o selo tem texto, não depende só da cor |
| U9 | Status de sync invisível | Visibilidade do status | 3 | Linha de status em Ajustes e na tela Conta |

**Veredito:** as jornadas críticas estão validadas, condicionadas à correção de U1–U5, U7 e U9
(todas no backlog P0/P1).

## 5. Acessibilidade (RNF-07)

- Todo `Pressable` com `accessibilityRole` e `accessibilityLabel` em pt-BR
- Áreas de toque ≥ 44 pt (`AppButton` já usa `minHeight` 48)
- O status do dia nunca depende só da cor (o `StatusBadge` tem texto)
- Contraste: tokens de `theme.ts` verificados para texto normal (`ink`/`text` sobre `surface` ≥ 7:1;
  `muted` #697586 sobre #ffffff ≈ 4,8:1 ✓ AA)

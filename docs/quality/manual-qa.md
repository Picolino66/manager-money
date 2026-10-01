---
id: quality.manual-qa
type: module
module: quality
title: Campanha de QA manual (v1.0)
summary: >
  Roteiro de testes manuais em aparelho real, por dia e sequência, cobrindo as telas e fluxos
  críticos antes da publicação nas lojas.
code:
  - src/navigation/AppNavigator.tsx
last_verified_commit: 27a0bd2
---

# Campanha de QA manual — v1.0

> Planejada na F6; **não executada**. Todos os itens começam em _Não iniciado_; só a execução humana
> muda o status. Execute em 1 aparelho Android (APK `preview`) e 1 iOS (quando houver conta Apple).
> Formato compatível com o padrão de quadro Notion (`Dxx.yy — ação`), se você quiser importar.

| ID | Prioridade | Ação | Resultado esperado |
|---|---|---|---|
| **Dia 1 — instalação, primeiro uso e migração** ||||
| D01.01 | Alta | Instalar o APK limpo e abrir | Hoje mostra "Configuração inicial"; nenhum erro |
| D01.02 | Alta | Configurar renda 3.000, meta 300, dia de pagamento 10, 1 fixo de 1.000 e 1 parcelamento 100 × 3 | Total de fixos R$ 1.100,00; vai para "Abrir ciclo" |
| D01.03 | Alta | Conferir a prévia e iniciar o ciclo | Período começa no dia 10; limite = saldo ÷ dias |
| D01.04 | Alta | Informar dia de pagamento 0 e depois 29 | Erro "Informe um dia entre 1 e 28." |
| D01.05 | Alta | Instalar a versão nova **por cima** de uma instalação do MVP com dados | Dados preservados; ciclo e gastos iguais aos de antes; dia de pagamento = 7 |
| D01.06 | Média | Fechar e reabrir o app em modo avião | Tudo carrega; sem mensagem de erro |
| **Dia 2 — gastos e ciclo** ||||
| D02.01 | Alta | Registrar um gasto de R$ 25,00 hoje | "Ainda pode gastar" diminui R$ 25,00 |
| D02.02 | Alta | Registrar com data fora do ciclo | Alert "Data fora do ciclo" |
| D02.03 | Alta | Histórico → tocar no gasto → editar o valor | Valores do dia atualizados |
| D02.04 | Alta | Editar → Excluir gasto → confirmar | Gasto some; limite recalculado |
| D02.05 | Alta | Tentar "Fechar ciclo" antes do fim | Botão desabilitado com a explicação da data |
| D02.06 | Alta | (Data do aparelho antes do dia de pagamento) tocar em "Já recebi" | Ciclo fechado na véspera; novo ciclo a partir de hoje; parcela 2/3 |
| D02.07 | Alta | Logo depois de D02.06 | Botão "Já recebi" **não** aparece |
| D02.08 | Média | Categorias: criar "Viagem", filtrar por período e tipo | Gráfico e total coerentes |
| **Dia 3 — conta e sync** (exige Supabase configurado) ||||
| D03.01 | Alta | Ajustes → Conta → e-mail → Enviar código | E-mail chega com código de 6 dígitos |
| D03.02 | Alta | Código errado | "Código inválido ou expirado." |
| D03.03 | Alta | Código certo (aparelho com dados, nuvem vazia) | "Sincronizado às HH:mm" |
| D03.04 | Alta | Segundo aparelho, mesmo e-mail, sem dados | Dados baixados iguais |
| D03.05 | Alta | Aparelho A em modo avião: registrar gasto; reconectar | "1 alteração pendente" → sincroniza; aparece em B |
| D03.06 | Alta | Aparelho com dados próprios entra em conta com dados | Pergunta "Usar dados da nuvem / Manter dados deste aparelho" |
| D03.07 | Alta | Sair → "Manter dados" | Volta para "Somente neste aparelho" com os dados |
| D03.08 | Alta | Excluir conta (2 confirmações) | Conta removida; app em modo local com os dados |
| D03.09 | Média | Sem variáveis do Supabase | Conta mostra "Modo local" |
| **Dia 4 — dados, legal e acessibilidade** ||||
| D04.01 | Alta | Ajustes → Exportar dados | Compartilhamento abre um `.json` com os dados e sem e-mail ou ID |
| D04.02 | Alta | Ajustes → Política de privacidade | Texto completo, com o e-mail de contato preenchido |
| D04.03 | Média | Revisar todas as telas | Nenhum texto sem acento |
| D04.04 | Média | TalkBack/VoiceOver na tela de gasto | Campos anunciados com o rótulo ("Valor", "Descrição") |
| D04.05 | Baixa | Fonte do sistema no tamanho máximo | Sem texto cortado no hero do Hoje |

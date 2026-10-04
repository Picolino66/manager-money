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
last_verified_commit: c47cf18+T-025
---

# Campanha de QA manual — v1.0

> Planejada na F6; **não executada**. Todos os itens começam em _Não iniciado_; só a execução humana
> muda o status. Execute em 1 aparelho Android (APK `preview`) e 1 iOS (quando houver conta Apple).
> Formato compatível com o padrão de quadro Notion (`Dxx.yy — ação`), se você quiser importar.

| ID | Prioridade | Ação | Resultado esperado |
|---|---|---|---|
| **Dia 1 — instalação, primeiro uso e migração** ||||
| D01.01 | Alta | Instalar o APK limpo e abrir | Hoje mostra "Configuração inicial"; nenhum erro |
| D01.02 | Alta | Configurar renda 3.000 (fonte com dia de pagamento 10), meta 300, 1 fixo de 1.000 e 1 parcelamento 100 × 3 | Total de fixos R$ 1.100,00; vai para "Abrir ciclo" |
| D01.03 | Alta | Conferir a prévia e iniciar o ciclo | Período começa no dia 10; limite = saldo ÷ dias |
| D01.04 | Alta | Informar dia de pagamento 0 e depois 29 em uma fonte de renda | Erro "Informe um dia entre 1 e 28." |
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
| D03.01 | Alta | Ajustes → Conta → e-mail + senha de 7 caracteres → Criar conta | Alerta "Senha curta"; nada é enviado |
| D03.02 | Alta | Entrar com senha errada | "E-mail ou senha incorretos." |
| D03.03 | Alta | Criar conta válida (aparelho com dados, nuvem vazia) | Entra direto, sem e-mail; "Sincronizado às HH:mm" |
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
| **Dia 5 — fontes de renda e cartões de crédito** ||||
| D05.01 | Alta | Configuração → Renda mensal → Adicionar uma 2ª fonte (Freela, R$ 500,00) | "Total" soma as duas fontes; ao salvar, "Renda mensal" do Hoje mostra o total |
| D05.02 | Alta | Remover a única fonte de renda | Botão Remover não aparece com uma fonte só; nome ou valor vazio mostra erro |
| D05.03 | Alta | Ajustes → Cartões de crédito → Adicionar (Nubank, fecha 25, vence 5) | Cartão listado com "Fecha dia 25 · Vence dia 5"; dia 29 mostra erro |
| D05.04 | Alta | Registrar gasto → Cartão de crédito, R$ 300,00 em 3x, data antes do fechamento | Mostra "3x de R$ 100,00 · a 1ª parcela entra neste ciclo"; "Saldo inicial" cai R$ 100,00 |
| D05.05 | Alta | Mesma compra com data depois do fechamento | Mostra que a 1ª parcela entra no próximo ciclo; saldo atual não muda |
| D05.06 | Média | Cartões → tocar no cartão → excluir a compra | Saldo inicial volta ao valor anterior; cartão com compras não pode ser excluído |
| **Dia 6 — pagar despesas fixas e rendas avulsas** ||||
| D06.01 | Alta | Hoje → "Despesas fixas do ciclo" (nasce encolhido, mostra Pagas/Pendentes) → tocar na seta com 1 fixa de R$ 1.000,00 | Expande e aparece como Pendente; "Saldo inicial" **já desconta** a fixa (reservada, BR-FIN-004/ADR-017) |
| D06.02 | Alta | Pagar → À vista (Pix, dinheiro ou débito) → Confirmar pagamento (sem outro menu) | Mostra "Pago · À vista"; "Saldo inicial" **não muda** (já estava reservado); resumo Pagas/Pendentes atualiza |
| D06.03 | Alta | Desfazer o pagamento | Volta a Pendente; o saldo continua com a fixa reservada |
| D06.05 | Alta | Pagar → Cartão de crédito, cartão Nubank, 3x, juros R$ 50,00 | Prévia "Total R$ 1.050,00 em 3x de R$ 350,00"; só a 1ª parcela (se cair neste ciclo) reduz o saldo |
| D06.06 | Alta | Pagar → Cartão de crédito sem cartão cadastrado | Mostra "Cadastre um cartão…" com atalho para Cartões |
| D06.07 | Alta | Hoje → Renda → Adicionar renda "Freela" R$ 500,00 | Soma ao saldo inicial; aparece em "Rendas avulsas"; nome/valor vazios mostram erro |
| D06.08 | Média | Excluir a renda avulsa | Saldo volta ao valor anterior |
| D06.09 | Alta | Fechar o ciclo e abrir o próximo | Fixas voltam a Pendente; o ciclo fechado manteve o resultado com os pagamentos |
| D06.10 | Alta | Atualizar o app por cima de uma versão com ciclo ativo | "Saldo inicial" volta a refletir a renda sem as fixas; confirme os pagamentos para descontá-las |
| D05.07 | Alta | Duas fontes: Salário R$ 5.000 (dia 5) e Freela R$ 800 (dia 20) | Tela mostra "O ciclo usa o dia 5 (Salário…)"; o próximo ciclo começa no dia 5; não existe campo global de dia |
| **Dia 7 — faturas, limite, situação inicial e projeção (ADR-017)** ||||
| D07.01 | Alta | Cartões → editar Nubank (fecha 20, vence 27) → limite R$ 6.000,00 | Mostra limite total, comprometido R$ 0,00 e "Limite disponível do cartão" R$ 6.000,00 — separado de "Ainda pode gastar hoje" |
| D07.02 | Alta | Registrar no crédito R$ 600,00 em 6x, data antes do fechamento | Disponível do cartão cai R$ 600,00 na hora; só a parcela da fatura que vence neste ciclo reduz o saldo |
| D07.03 | Alta | Registrar no crédito valor acima do limite disponível | Aviso de limite; a compra é registrada e o disponível fica negativo |
| D07.04 | Alta | Depois do fechamento, fatura fechada → **Paguei a fatura** | Fatura "Paga"; limite liberado no valor da fatura; saldo do ciclo não muda |
| D07.05 | Alta | Fatura vencida → Paguei a fatura → valor pago R$ 20,00 acima | Pede o valor pago; recusa valor menor que a fatura; a diferença (juros) reduz o saldo do ciclo |
| D07.06 | Alta | Cartões → Situação inicial: parcelamento 10x de R$ 100,00, 4 restantes, próxima fatura atual | Comprometido sobe R$ 400,00; parcelas pagas não pesam; próximos ciclos mostram as parcelas |
| D07.07 | Média | Tentar excluir cartão com compras | Pede para desativar; desativado some de Registrar gasto e as parcelas continuam |
| D07.08 | Média | Configuração → desativar uma fonte de renda e uma despesa fixa | Renda e fixas totais excluem as inativas; desativar a única fonte ativa é recusado |
| D07.09 | Alta | Hoje → Próximos compromissos e Próximos ciclos | Faturas a pagar e fixas pendentes listadas; "Livre antes de novos gastos" por ciclo |
| D07.10 | Alta | Atualizar o app por cima da versão anterior com ciclo ativo e fixas pendentes | Ao abrir, "Saldo inicial" cai no total das fixas pendentes (agora reservadas); compras antigas mantêm o ciclo; faturas que já tinham vencido aparecem pagas (sem juros) |
| D07.11 | Alta | Pagar uma fixa no crédito → Cartões → excluir a compra gerada | A fixa volta a Pendente e reservada; editar valor/parcelas/data dessa compra pede "Desfaça o pagamento" |
| D07.12 | Média | Dois aparelhos com a mesma conta marcam "Paguei a fatura" da mesma fatura | Após sincronizar, há um único pagamento; sync sem erro |

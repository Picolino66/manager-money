# Manager Money — Visão geral do produto

## Em uma frase

O Manager Money responde, todos os dias, à pergunta que importa na hora de uma compra:

> **"Quanto eu ainda posso gastar hoje e continuar atingindo minha meta financeira?"**

Em vez de só mostrar relatórios do que já foi gasto, o app mostra **um único número por dia**: o
quanto você pode gastar hoje sem comprometer a meta nem as contas do mês. Esse número é
recalculado sozinho a cada gasto, renda, conta ou compra no cartão.

## Para quem é

- **Quem recebe uma renda mensal previsível** (salário, por exemplo) e quer chegar ao fim do mês
  sem entrar no vermelho, guardando um valor fixo.
- **Quem usa cartão de crédito e parcela compras**, e costuma perder de vista quanto da renda dos
  próximos meses já está comprometida.
- **Quem usa mais de um celular** ou tem medo de perder os dados ao trocar de aparelho.

Ainda **não** é pensado para renda muito variável (autônomos) nem para orçamento compartilhado
entre várias pessoas (casal ou família).

## A ideia central

### O ciclo financeiro

O mês do app não vai do dia 1 ao dia 30. Ele vai **de um pagamento até a véspera do próximo**. Se
o seu salário principal cai todo dia 5, o ciclo vai do dia 5 até o dia 4 do mês seguinte.

### Quanto você tem para gastar no ciclo

```
Disponível no ciclo = suas rendas
                    + rendas extras do ciclo
                    − sua meta de economia
                    − despesas fixas do ciclo (pagas ou ainda a pagar)
                    − faturas de cartão que vencem neste ciclo
                    − juros e multas de faturas registrados neste ciclo
                    − parte de fatura que ficou sem pagar no ciclo anterior
                    − dívida que sobrou do ciclo anterior (se houver)
```

As contas do ciclo e as faturas que vencem nele ficam **reservadas** desde o primeiro dia, mesmo
antes de fecharem ou de serem pagas. Assim o app nunca mostra como "livre" um dinheiro que já tem
destino, e pagar uma conta já reservada **não desconta de novo**.

### O limite de hoje

```
Limite de hoje = (disponível no ciclo − o que você já gastou antes de hoje) ÷ dias que faltam
```

Exemplo: renda de R$ 5.000, meta de R$ 1.000 e contas fixas de R$ 1.500 deixam **R$ 2.500**
para o ciclo. Faltando 20 dias, você pode gastar **R$ 125 hoje**.

- Gastou **menos** hoje? O limite dos próximos dias **aumenta**.
- Gastou **mais**? O limite dos próximos dias **diminui**.
- Um selo mostra como está o seu dia: **Saudável**, **Atenção**, **Crítico** ou **Negativo**.

### Dinheiro disponível não é limite do cartão

O app separa sempre duas coisas:

- **"Você pode gastar hoje"** é a sua capacidade financeira: o dinheiro que cabe no orçamento.
- **"Limite disponível do cartão"** é capacidade de crédito: o quanto o banco ainda deixa você
  comprar.

Ter R$ 4.000 de limite no cartão **não** significa poder gastar R$ 4.000. O app nunca apresenta o
limite do cartão como dinheiro para gastar.

### Sobra e dívida entre ciclos

- **Sobrou dinheiro** no fim do ciclo? A sobra **não passa** para o próximo; ela é tratada como
  economia extra.
- **Terminou no negativo?** A dívida **passa** para o próximo ciclo e reduz o que você pode gastar
  nele.

## O que dá para fazer

### 1. Configurar sua base financeira

- **Fontes de renda:** cadastre uma ou mais (ex.: "Salário — R$ 5.000 — dia 5", "Renda
  complementar — R$ 800 — dia 10"), cada uma com valor e dia de recebimento.
  - O ciclo segue o dia da **maior** renda.
  - Uma fonte pode ser **desativada** sem ser apagada; ela deixa de contar até ser reativada.
  - Sempre precisa haver ao menos uma fonte ativa.
- **Meta de economia:** quanto você quer guardar por ciclo. Esse valor fica fora do que você pode
  gastar.
- **Despesas fixas:** contas que se repetem todo ciclo (aluguel, internet, energia, academia,
  escola, assinaturas...), com nome, valor e categoria. Cada uma pode ser **ativada ou
  desativada**.
- **Parcelamentos fora do cartão:** carnês e financiamentos, com valor da parcela, total e quantas
  faltam. Parcelamentos **do cartão** são cadastrados no próprio cartão (veja o item 7).
- Se as fixas somadas à meta passarem da renda, o app **avisa e pede confirmação**.
- Mudar a meta, uma renda ou uma conta no meio do ciclo recalcula o ciclo atual na hora.

### 2. Abrir um ciclo

- Antes de começar, o app mostra uma **prévia** fiel ao que vai acontecer: período, dias, contas
  reservadas, faturas do ciclo, saldo e limite diário inicial.
- Só existe **um ciclo ativo por vez**.

### 3. Acompanhar o dia (tela "Hoje")

A tela principal gira em torno de um número, **"Ainda pode gastar hoje: R$ X"**, com o selo de
status, quanto você já gastou hoje e qual era o limite previsto para o dia. Logo abaixo, de forma
simples:

- **Dias restantes**, **dinheiro disponível no ciclo** e **meta de economia**.
- **Próximos compromissos:** faturas a vencer (ex.: "Fatura Nubank · vence 27/10"), com destaque
  para as vencidas, e contas fixas ainda não pagas.
- **Despesas fixas do ciclo:** o que já foi pago e o que está pendente, com botão para pagar.
- **Próximos ciclos:** quanto da renda futura já está comprometida (veja o item 9).
- **Plano do ciclo** (recolhido): de onde vem e para onde vai o dinheiro.
- Atalhos para **registrar um gasto** e **lançar uma renda extra**.

### 4. Registrar gastos

Um gasto comum leva poucos segundos:

**valor → forma de pagamento → cartão e parcelas (se for crédito) → categoria → descrição → salvar**

- **À vista** (Pix, dinheiro ou débito): sai na hora do saldo do ciclo e entra no gasto do dia. A
  descrição é opcional.
- **Cartão de crédito:**
  - Você escolhe o cartão e o número de parcelas e informa o valor total já com juros.
  - O app mostra o **limite disponível do cartão**, quanto fica cada parcela, em qual fatura a
    compra entra e em qual ciclo ela vai pesar.
  - O limite do cartão cai **na hora**. O orçamento só é afetado quando a fatura daquela compra
    vencer.
  - Se a compra passar do limite disponível cadastrado, o app mostra um **alerta forte** ("excede
    em R$ 240 o limite disponível cadastrado… deseja registrar mesmo assim?"), mas deixa
    registrar: o banco pode ter liberado um limite diferente. O limite disponível fica negativo
    até você corrigir o limite cadastrado.
- Lançou errado? Dá para **editar ou excluir** o gasto, desde que ele seja do ciclo atual.
- Gasto sem categoria vai para **"Outros"**.

### 5. Pagar as despesas fixas

- Toda conta fixa ativa aparece como **pendente** no começo do ciclo, e o valor dela **já fica
  reservado** no orçamento.
- Ao pagar, você escolhe a forma:
  - **À vista:** a conta passa para "paga". O saldo não muda, porque o valor já estava reservado.
  - **No cartão de crédito:** você escolhe o cartão, as parcelas e os juros cobrados. A reserva sai
    deste ciclo e o valor passa a pesar **nas faturas** do cartão, sem contar duas vezes.
- Cada conta pode ser paga **uma vez por ciclo**. Dá para **desfazer** enquanto o ciclo está
  aberto.
- No ciclo seguinte, tudo volta para pendente (e reservado).

### 6. Lançar rendas extras

- Recebeu algo fora da renda normal (bônus, venda, reembolso, trabalho extra)? Lance como **renda
  avulsa**, com nome, valor e data. O valor **soma** ao saldo do ciclo e o limite diário sobe na
  hora.
- Pode ser excluída enquanto o ciclo está aberto.

### 7. Cartões de crédito

**Cadastro:** cada cartão tem **nome, limite total, dia de fechamento e dia de vencimento**. O app
**nunca** pede número do cartão, código de segurança ou validade: ele não é carteira digital, só
controla o cartão financeiramente.

**Visão de cada cartão.** Responde duas perguntas:

- *"Quanto ainda posso usar deste cartão?"* → **limite total**, **limite comprometido** e **limite
  disponível**. Mudar o limite total (quando o banco aumenta ou reduz) mexe só nessa capacidade de
  crédito: não muda a renda, o orçamento nem o limite diário.
- *"Quanto deste cartão vai pesar nos próximos ciclos?"* → as faturas e em qual ciclo cada uma pesa.

E mostra:

- **fatura atual**, com valor, fechamento, vencimento, quanto já foi pago, quanto falta e a situação
  (aberta, fechada, vencida, paga em parte ou paga);
- **próxima fatura** e **faturas futuras**;
- as **compras** e **parcelas** de cada fatura ("Parcela 2/6").

**Como uma compra vira compromisso:**

```
Compra → compromete o limite na hora → entra numa fatura → a fatura vence num ciclo
       → o ciclo reserva esse valor → o pagamento quita a fatura e libera o limite
```

1. A compra **compromete o limite** do cartão na hora, pelo valor total (uma compra de R$ 3.000
   em 10x ocupa R$ 3.000 do limite).
2. Ela entra na **fatura** que ainda está aberta na data da compra: feita até o dia do fechamento,
   entra na fatura do mês; depois dele, na seguinte.
3. A fatura pesa no **ciclo em que ela vence**. Se vence no ciclo atual, o valor já sai do que
   você pode gastar agora, mesmo com a fatura ainda aberta. Se vence no próximo, o ciclo atual
   não muda e o valor aparece na previsão do próximo ciclo.
4. Uma compra parcelada gera uma parcela por fatura, e cada parcela pesa no ciclo do seu
   vencimento. As parcelas somam exatamente o total: os centavos que sobram vão para as primeiras
   (R$ 100 em 3x = R$ 33,34 + R$ 33,33 + R$ 33,33).

**"Paguei a fatura":**

- Depois que a fatura fecha, você registra o pagamento. O dinheiro já estava reservado, então
  pagar **não tira nada de novo** do orçamento: só marca a fatura como paga e **libera no limite
  o valor pago**. Pagar a fatura com uma parcela de R$ 300 libera R$ 300, não a compra inteira.
- **Pagou só uma parte?** O app mostra fatura, valor pago e quanto falta. Só o que foi pago libera
  limite, e o resto continua devido. Se ainda faltar algo quando o ciclo terminar, essa parte
  **vira dívida do próximo ciclo**: volta ao resultado do ciclo que acabou e fica reservada no
  seguinte até ser quitada.
- **Juros e multa:** pagou depois do vencimento ou o banco cobrou encargos? Informe o valor final
  pago, ou registre os juros/multa à parte. Só o que passar do valor da fatura sai do orçamento,
  no ciclo em que for registrado (fatura de R$ 1.000 paga com R$ 1.080 → só R$ 80 a mais).
  O app não tenta calcular juros do banco.
- Enquanto você não registrar o pagamento, o limite continua comprometido.
- Dá para desfazer cada pagamento dentro do mesmo ciclo; o limite volta a ficar comprometido.

**Compras anteriores ao app (situação inicial):** ninguém começa com o cartão zerado. Ao
cadastrar um cartão, você informa:

- o **total da fatura em aberto**, como aparece no app do banco (ex.: "fatura atual de R$ 1.350");
- os **parcelamentos em andamento** (ex.: "Notebook, 10x de R$ 300, faltam 6").

O app gera sozinho a agenda das parcelas restantes, desconta o **limite já usado** e coloca cada
parcela no ciclo certo. As parcelas que você já pagou ficam de fora.

O total que você informa é a **fonte de verdade** daquela fatura. Se a parcela atual do
parcelamento já está dentro dele, o app pergunta (já vem marcado "sim") e não soma de novo: a
fatura continua R$ 1.350, nunca R$ 1.650. A parcela aparece só para explicar parte do total, e
as parcelas seguintes entram normalmente nas próximas faturas. O app não inventa o resto da
composição da fatura.

**Para proteger o histórico:**

- um cartão com compras não pode ser apagado, mas pode ser **desativado**: some das novas compras
  e as parcelas continuam valendo;
- mudar o fechamento ou o vencimento vale para as compras novas; as já registradas continuam onde
  estavam;
- uma compra só pode ser editada ou excluída (estorno) enquanto nenhuma parcela dela tiver pesado
  num ciclo encerrado ou numa fatura já paga;
- compras anteriores ao app só mudam descrição e categoria;
- excluir a compra que pagou uma conta fixa no cartão faz a conta voltar a "pendente" (e
  reservada), para o compromisso nunca sumir do orçamento.

### 8. Recebeu antes? "Já recebi"

- Se o pagamento caiu **antes** do dia de sempre, toque em **"Já recebi"**. O ciclo atual é
  encerrado na véspera e um novo começa no dia em que você recebeu.
- Só pode ser usado **uma vez por ciclo**, para evitar ciclos vazios ou parcelas contadas em dobro.

### 9. Previsão dos próximos ciclos

Como o app conhece suas rendas, sua meta, suas contas e as parcelas futuras do cartão, ele mostra
**quanto do seu dinheiro futuro já está comprometido**:

```
Próximo ciclo
Renda prevista            R$ 5.000
− Meta                    R$ 1.000
− Contas fixas            R$ 1.500
− Faturas de cartão       R$ 1.200
= Livre antes de novos gastos  R$ 1.300
```

A previsão é simples de propósito: serve para você saber, antes de parcelar algo, o quanto os
próximos meses já estão apertados.

### 10. Fechar o ciclo

- Depois que o período termina, o app avisa **"Ciclo encerrado em dd/MM"** e libera o botão
  **Fechar ciclo**.
- Antes do fim, o botão fica indisponível e o app explica o motivo. Se você recebeu antes, o
  caminho é o "Já recebi".
- Ao fechar, o resultado vai para o histórico e você já pode iniciar o próximo ciclo.

### 11. Histórico

- **Histórico do ciclo:** dia a dia, com o total gasto e o saldo de cada dia. Toque no dia para ver
  os gastos e corrigir algum.
- **Ciclos anteriores:** cada ciclo encerrado com o resultado final (positivo ou negativo), o saldo
  inicial e a quantidade de gastos.
- **Faturas e compras:** cada cartão guarda suas faturas, os pagamentos e encargos de cada uma e
  as compras.
- Ciclos encerrados **não podem ser alterados**, nem indiretamente por mudanças em compras.

### 12. Análise por categoria

- Veja **para onde o dinheiro foi** em um período (por padrão, o ciclo atual), filtrando por
  categoria e por tipo:
  - gasto à vista;
  - compra no cartão;
  - conta fixa paga;
  - parcelamento.
- Uma conta paga no cartão aparece **uma vez só**, como conta fixa.
- Um gráfico de barras compara as categorias.

### 13. Conta, sincronização e dados

- **Funciona sem conta:** dá para usar tudo só no aparelho, inclusive **sem internet**.
- **Criar conta (opcional):** com e-mail e senha, seus dados ficam guardados na nuvem e
  **sincronizados entre aparelhos** (Android e iPhone).
- **Sem internet?** Continue usando normalmente. As alterações ficam guardadas e são enviadas
  quando a conexão voltar, sem perder nada.
- **Primeiro login em um aparelho que já tem dados:** você escolhe entre **manter os dados deste
  aparelho** ou **usar os dados da nuvem**. O app nunca descarta dados sem perguntar.
- **Status visível:** "Sincronizado às 14:32", "3 alterações pendentes", "Sem conexão" etc.
- **Sair da conta:** escolha entre manter ou apagar os dados do aparelho.
- **Excluir conta:** apaga a conta e todos os dados da nuvem, de dentro do próprio app.
- **Exportar dados:** baixe uma cópia completa dos seus dados quando quiser.

### 14. Ajustes

Concentra a configuração financeira, os cartões de crédito, a conta e a sincronização, a
exportação de dados e a política de privacidade.

## As regras que o app nunca quebra

1. Limite do cartão **não** é dinheiro disponível.
2. Uma compra no cartão compromete o limite na hora.
3. O orçamento é afetado pelo ciclo em que a fatura vence, não pela data da compra.
4. Uma fatura que vence no ciclo atual já fica reservada antes de ser paga.
5. Pagar algo que já estava reservado não desconta de novo.
6. Pagar uma fatura libera no limite só o valor efetivamente pago.
7. Parcelas de faturas que vencem em ciclos futuros não afetam o ciclo atual.
8. Nenhuma compra, parcela, fatura ou conta é contada duas vezes.
9. O histórico de ciclos encerrados não é reescrito por alterações posteriores.
10. A soma das parcelas é sempre exatamente o valor da compra.

## Privacidade e confiança

- Você **não conecta o banco**: nada de Open Finance, leitura de SMS ou acesso a conta bancária.
- O app não guarda número do cartão, código de segurança nem validade.
- Cada pessoa vê **somente os próprios dados**.
- Nenhum valor ou descrição de gasto é enviado para ferramentas de terceiros (estatísticas ou
  relatórios de erro).
- Política de privacidade disponível dentro do app, em conformidade com a LGPD.

## Jornada típica

1. **Primeiro uso (poucos minutos):**
   - cadastra rendas, meta e contas fixas;
   - cadastra os cartões com limite, a fatura em aberto e os parcelamentos que já existem;
   - abre o ciclo e vê "Ainda pode gastar hoje R$ X".
2. **No dia a dia (segundos):** abre o app, olha o limite e registra o gasto na hora da compra.
3. **Quando paga uma conta:** marca a conta fixa como paga em "Hoje".
4. **Quando paga a fatura do cartão:** toca em "Paguei a fatura" (inteira ou só uma parte) e o
   limite do cartão é liberado no valor pago.
5. **Quando entra um dinheiro extra:** lança como renda avulsa.
6. **Antes de parcelar algo:** confere em "Próximos ciclos" quanto da renda futura já está
   comprometida.
7. **No dia do pagamento:** fecha o ciclo (ou usa "Já recebi" se recebeu antes), confere o
   resultado e abre o próximo.

## O que o app não faz (de propósito)

- Integração com banco, Open Finance, leitura de SMS ou conciliação bancária automática
- Guardar número do cartão, código de segurança ou validade
- Contabilidade complexa, dezenas de gráficos, investimentos, patrimônio ou criptomoedas
- Orçamento compartilhado (casal ou família)
- Várias moedas
- Notificações e lembretes *(previsto)*
- Tema escuro *(previsto)*
- Versão para navegador

O foco continua sendo **orçamento pessoal simples**.

## Modelo de negócio

- Distribuído na **Google Play** e na **App Store**.
- **Gratuito e sem anúncios** nesta versão. O foco agora é provar que as pessoas usam o app no dia
  a dia.
- Ideia para o futuro: sincronização e backup gratuitos, com recursos avançados pagos (vários
  orçamentos, relatórios, compartilhamento).

## Como medimos o sucesso

| O que medimos | Meta |
|---|---|
| Pessoas que configuram e abrem o 1º ciclo em até 24 h | ≥ 50% |
| Gastos registrados por pessoa por semana | ≥ 5 |
| Ciclos encerrados sem saldo negativo | ≥ 60% |
| Pessoas que ainda usam o app no 30º dia | ≥ 25% |

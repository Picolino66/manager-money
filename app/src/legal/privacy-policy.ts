/**
 * Política de privacidade exibida no app. Espelhada em docs/legal/politica-de-privacidade.md
 * (publicar na URL exigida pelas lojas). Manter os dois textos sincronizados.
 */
export const PRIVACY_POLICY_UPDATED_AT = '01/10/2026';

export const PRIVACY_POLICY_SECTIONS: { title: string; body: string }[] = [
  {
    title: 'Quem somos',
    body: 'O Manager Money é um aplicativo de planejamento financeiro pessoal. Esta política explica quais dados tratamos e por quê, conforme a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018).',
  },
  {
    title: 'Dados que tratamos',
    body: 'Sem conta: fontes de renda, meta de economia, dia de pagamento, despesas fixas, parcelamentos, cartões de crédito (apenas nome e dias de fechamento e vencimento, nunca o número do cartão), compras no cartão, pagamentos de despesas fixas, rendas avulsas, ciclos e gastos ficam somente no seu aparelho. Com conta: além desses dados, seu e-mail (para login) e um identificador de usuário, armazenados no nosso provedor de banco de dados.',
  },
  {
    title: 'Finalidade e base legal',
    body: 'Usamos os dados exclusivamente para calcular seu limite diário e, se você criar uma conta, sincronizá-los entre seus aparelhos. Base legal: execução de contrato (art. 7º, V, da LGPD). Não vendemos dados, não exibimos anúncios e não usamos seus dados financeiros para nenhum outro fim.',
  },
  {
    title: 'Compartilhamento',
    body: 'Com conta, os dados são armazenados no Supabase (servidores na região de São Paulo, Brasil), que atua como operador. Relatórios técnicos de falha, quando habilitados, não contêm valores, descrições de gastos nem e-mail.',
  },
  {
    title: 'Segurança',
    body: 'A comunicação usa HTTPS. Cada conta acessa somente os próprios dados (isolamento no banco). A senha é armazenada pelo provedor apenas em forma de hash, nunca em texto. A sessão fica criptografada no aparelho, com a chave guardada no armazenamento seguro do sistema.',
  },
  {
    title: 'Retenção',
    body: 'Os dados ficam armazenados enquanto sua conta existir. Ao excluir a conta, todos os dados na nuvem são apagados imediatamente e de forma definitiva.',
  },
  {
    title: 'Seus direitos',
    body: 'Você pode, a qualquer momento e dentro do app: acessar e exportar todos os seus dados (Ajustes → Exportar dados), corrigi-los e excluir sua conta e os dados na nuvem (Ajustes → Conta e sincronização → Excluir conta).',
  },
  {
    title: 'Contato',
    body: 'Dúvidas ou solicitações sobre privacidade: [DEFINIR E-MAIL DE CONTATO ANTES DE PUBLICAR].',
  },
];

/** Mensagens de erro em linguagem simples (pt-BR), sem detalhes técnicos nem dados do usuário. */
export type SaveErrorCode = 'conflict-active-cycle' | 'auth' | 'network' | 'unknown';

export function saveErrorMessage(code: SaveErrorCode, partial: boolean): string {
  if (code === 'conflict-active-cycle') {
    return 'Outro aparelho já abriu um ciclo. Recarregamos os dados; confira antes de tentar de novo.';
  }
  if (code === 'auth') return 'Sua sessão expirou. Entre de novo para continuar.';
  if (partial) {
    return 'A gravação foi interrompida no meio. Recarregamos os dados do servidor; confira e tente de novo.';
  }
  if (code === 'network') return 'Sem conexão com o servidor. Nada foi salvo; tente de novo.';
  return 'Não foi possível salvar. Nada foi alterado; tente de novo.';
}

export function loadErrorMessage(code: SaveErrorCode): string {
  if (code === 'auth') return 'Sua sessão expirou. Entre de novo para continuar.';
  if (code === 'network')
    return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return 'Não foi possível carregar seus dados. Tente de novo.';
}

export type AuthMessageCode =
  | 'invalid-credentials'
  | 'already-registered'
  | 'weak-password'
  | 'confirmation-required'
  | 'rate-limited'
  | 'network'
  | 'unknown';

export function authErrorMessage(code: AuthMessageCode): string {
  switch (code) {
    case 'invalid-credentials':
      return 'E-mail ou senha incorretos.';
    case 'already-registered':
      return 'Já existe uma conta com este e-mail. Entre com sua senha.';
    case 'weak-password':
      return 'Senha fraca. Use pelo menos 8 caracteres.';
    case 'confirmation-required':
      return 'A conta foi criada, mas precisa de confirmação por e-mail antes de entrar.';
    case 'rate-limited':
      return 'Muitas tentativas. Aguarde um pouco e tente de novo.';
    case 'network':
      return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    default:
      return 'Não foi possível entrar agora. Tente de novo.';
  }
}

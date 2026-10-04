/** Violação de regra de negócio. A mensagem é exibível ao usuário (pt-BR). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

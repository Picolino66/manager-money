import { authErrorMessage, loadErrorMessage, saveErrorMessage } from './messages';

describe('mensagens', () => {
  it('erros de gravação', () => {
    expect(saveErrorMessage('conflict-active-cycle', false)).toMatch(/Outro aparelho/);
    expect(saveErrorMessage('auth', true)).toMatch(/sessão expirou/);
    expect(saveErrorMessage('network', true)).toMatch(/interrompida no meio/);
    expect(saveErrorMessage('network', false)).toMatch(/Nada foi salvo/);
    expect(saveErrorMessage('unknown', false)).toMatch(/Nada foi alterado/);
  });

  it('erros de carregamento', () => {
    expect(loadErrorMessage('auth')).toMatch(/sessão/);
    expect(loadErrorMessage('network')).toMatch(/internet/);
    expect(loadErrorMessage('unknown')).toMatch(/carregar/);
  });

  it.each([
    'invalid-credentials',
    'already-registered',
    'weak-password',
    'confirmation-required',
    'rate-limited',
    'network',
    'unknown',
  ] as const)('auth: %s', (code) => {
    expect(authErrorMessage(code)).toMatch(/\.$/);
  });
});

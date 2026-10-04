import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SyncError } from '@manager-money/core/contract/types';

import { useDataStore } from '@/store/data.store';
import { setDependencies } from '@/store/dependencies';
import { useSessionStore } from '@/store/session.store';
import { userFixture } from '@/test/fixtures';
import { FakeAuth, MemoryGateway } from '@/test/memory-gateway';
import { renderApp } from '@/test/render';

const USER = 'user-1';
let gateway: MemoryGateway;
let auth: FakeAuth;
let sequence = 0;

function signedIn(seed = true) {
  gateway = new MemoryGateway();
  if (seed) gateway.seed(userFixture(), USER);
  auth = new FakeAuth();
  auth.user = { userId: USER };
  setDependencies({
    auth,
    remote: gateway,
    context: () => ({ now: new Date(), newId: (prefix) => `${prefix}-ui-${++sequence}` }),
  });
  useDataStore.getState().reset();
  useSessionStore.setState({ status: 'signed-in', userId: USER, notice: null });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 10, 12, 12));
});

afterEach(() => vi.useRealTimers());
afterAll(() => setDependencies(null));

describe('guarda de rota', () => {
  it('sem sessão vai para o login', async () => {
    signedIn();
    useSessionStore.setState({ status: 'signed-out', userId: null });
    const router = renderApp('/gastos');

    expect(await screen.findByRole('heading', { name: 'Manager Money' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('conta sem configuração vai para o onboarding', async () => {
    signedIn(false);
    const router = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Vamos começar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/comecar');
  });

  it('erro ao carregar mostra mensagem e permite tentar de novo', async () => {
    signedIn();
    gateway.failSelect = new SyncError('network');
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Sem conexão/);
    gateway.failSelect = null;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByRole('heading', { name: 'Visão geral' })).toBeInTheDocument();
  });

  it('rota inexistente mostra 404', async () => {
    signedIn();
    renderApp('/nao-existe');
    expect(
      await screen.findByRole('heading', { name: 'Página não encontrada' }),
    ).toBeInTheDocument();
  });
});

describe('login', () => {
  it('valida e-mail e senha mínima e entra', async () => {
    signedIn();
    useSessionStore.setState({ status: 'signed-out', userId: null });
    const router = renderApp('/login');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('E-mail'), 'pessoa@example.com');
    await user.type(screen.getByLabelText('Senha'), '1234567');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText(/pelo menos 8 caracteres/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Senha'), '8');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('criar conta exige confirmação igual e mostra aviso de sessão expirada', async () => {
    signedIn();
    useSessionStore.setState({ status: 'signed-out', userId: null, notice: 'Sua sessão expirou.' });
    renderApp('/login');
    const user = userEvent.setup();

    expect(await screen.findByRole('status')).toHaveTextContent('Sua sessão expirou.');
    await user.click(screen.getByRole('tab', { name: 'Criar conta' }));
    await user.type(screen.getByLabelText('E-mail'), 'nova@example.com');
    await user.type(screen.getByLabelText('Senha'), '12345678');
    await user.type(screen.getByLabelText('Confirme a senha'), '12345679');
    await user.click(screen.getByRole('button', { name: 'Criar conta' }));
    expect(await screen.findByText('As senhas não conferem.')).toBeInTheDocument();
  });
});

describe('visão geral', () => {
  it('mostra os KPIs do ciclo ativo', async () => {
    signedIn();
    renderApp('/');

    expect(await screen.findByText('Ainda pode gastar hoje')).toBeInTheDocument();
    expect(screen.getByText('Disponível no ciclo')).toBeInTheDocument();
    expect(screen.getByText(/Ciclo atual|Ciclo ativo/)).toBeInTheDocument();
  });
});

describe('gastos', () => {
  it('lista todos os ciclos e deixa o fechado somente leitura', async () => {
    signedIn();
    renderApp('/gastos');

    const table = await screen.findByRole('table');
    expect(within(table).getAllByText('Ciclo fechado')).toHaveLength(2);
    expect(within(table).getByRole('button', { name: 'Editar gasto Padaria' })).toBeInTheDocument();
    expect(within(table).queryByRole('button', { name: 'Editar gasto Mercado' })).toBeNull();
  });

  it('busca filtra a tabela e atualiza o total', async () => {
    signedIn();
    renderApp('/gastos');
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText('Buscar'), 'onibus');
    const table = screen.getByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
    expect(screen.getByText(/1 gasto\(s\)/)).toHaveTextContent('R$ 12,00');
  });

  it('registra gasto em centavos e grava só a linha nova', async () => {
    signedIn();
    renderApp('/gastos');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Registrar gasto' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialog).findByText('Informe um valor maior que zero.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Valor'), '1234');
    expect((within(dialog).getByLabelText('Valor') as HTMLInputElement).value).toMatch(
      /^R\$\s12,34$/,
    );
    await user.type(within(dialog).getByLabelText('Descrição (opcional)'), 'Livro');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(gateway.upserts).toEqual([{ table: 'expenses', count: 1 }]);
    expect(gateway.rows.expenses.find((row) => row.description === 'Livro')?.amount).toBe(1234);
    expect(await screen.findByText('Livro')).toBeInTheDocument();
  });

  it('falha ao gravar: mostra o erro e a tabela não muda', async () => {
    signedIn();
    renderApp('/gastos');
    const user = userEvent.setup();
    gateway.failOn = { table: 'expenses', error: new SyncError('network') };

    await user.click(await screen.findByRole('button', { name: 'Editar gasto Padaria' }));
    const dialog = await screen.findByRole('dialog');
    const description = within(dialog).getByLabelText('Descrição (opcional)');
    await user.clear(description);
    await user.type(description, 'Padaria nova');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/Nada foi salvo/);
    expect(screen.queryByText('Padaria nova')).toBeNull();
    expect(gateway.rows.expenses.some((row) => row.description === 'Padaria nova')).toBe(false);
  });

  it('exclui com confirmação', async () => {
    signedIn();
    renderApp('/gastos');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Excluir gasto Ração' }));
    const confirm = await screen.findByRole('alertdialog');
    await user.click(within(confirm).getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(screen.queryByText('Ração')).toBeNull());
    expect(
      gateway.rows.expenses.find((row) => row.description === 'Ração')?.deleted_at,
    ).not.toBeNull();
  });
});

describe('ciclos e análise', () => {
  it('lista fechados e abre o detalhe por dia', async () => {
    signedIn();
    renderApp('/ciclos');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: /Detalhe do ciclo 07\/10/ }));
    expect(await screen.findByText('Dia a dia')).toBeInTheDocument();
    expect(screen.getByText('Ciclo fechado · somente leitura')).toBeInTheDocument();
    expect(screen.getByText('Ônibus')).toBeInTheDocument();
  });

  it('análise mostra os totais por categoria do período', async () => {
    signedIn();
    renderApp('/analise');

    const table = await screen.findByRole('table', { name: 'Totais por categoria no período' });
    expect(within(table).getByText('Pets')).toBeInTheDocument();
    expect(within(table).getByText('R$ 30,00')).toBeInTheDocument();
  });

  it('política de privacidade mostra o texto do núcleo', async () => {
    signedIn();
    renderApp('/privacidade');
    expect(
      await screen.findByRole('heading', { name: 'Política de privacidade' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quem somos' })).toBeInTheDocument();
  });
});

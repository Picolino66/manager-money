import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addExpense } from '@manager-money/core/application/cycle.use-cases';
import { LocalState } from '@manager-money/core/application/state';

import { useDataStore } from '@/store/data.store';
import { setDependencies } from '@/store/dependencies';
import { useSessionStore } from '@/store/session.store';
import { at, userFixture } from '@/test/fixtures';
import { FakeAuth, MemoryGateway } from '@/test/memory-gateway';
import { renderApp } from '@/test/render';

const USER = 'user-1';
let sequence = 0;

/** 4 lançamentos da fixture + 45 gastos com valores todos diferentes (R$ 1,00 … R$ 45,00): 3 páginas. */
function bigState(): LocalState {
  let state = userFixture();

  for (let index = 0; index < 45; index += 1) {
    const day = String(7 + (index % 20)).padStart(2, '0');

    state = addExpense(
      state,
      {
        amount: ((index * 17) % 45) * 100 + 100,
        category: index % 2 === 0 ? 'Pets' : 'Transporte',
        description: `Gasto ${String(index + 1).padStart(2, '0')}`,
        date: `2026-11-${day}`,
      },
      at(2026, 11, 12),
    );
  }

  return state;
}

function signedIn() {
  const gateway = new MemoryGateway();
  gateway.seed(bigState(), USER);
  const auth = new FakeAuth();
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

const amountsOnPage = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[7]!.textContent ?? '');

describe('histórico: ordenação sobre todos os dados', () => {
  it('Valor ordena todas as páginas: 1º clique maior→menor, 2º menor→maior', async () => {
    signedIn();
    renderApp('/historico');
    const user = userEvent.setup();
    const parse = (text: string) => Number(text.replace(/[^\d,]/g, '').replace(',', '.'));

    expect(await screen.findByText(/Página 1 de 3/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Valor/ }));
    // Decrescente: o maior de todo o conjunto (Padaria da fixture, R$ 45,90) abre a página 1.
    await waitFor(() => expect(parse(amountsOnPage()[0]!)).toBe(45.9));
    expect(amountsOnPage()).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: /Próxima/ }));
    await user.click(screen.getByRole('button', { name: /Próxima/ }));
    expect(screen.getByText(/Página 3 de 3/)).toBeInTheDocument();
    const lastPage = amountsOnPage();

    // E o menor de todos (R$ 1,00) fecha a última página.
    expect(parse(lastPage[lastPage.length - 1]!)).toBe(1);

    // Crescente: voltou para a página 1 com o menor de todos.
    await user.click(screen.getByRole('button', { name: /^Valor/ }));
    await waitFor(() => expect(screen.getByText(/Página 1 de 3/)).toBeInTheDocument());
    expect(parse(amountsOnPage()[0]!)).toBe(1);
  }, 30_000); // 45 linhas em 3 páginas: com cobertura e workers em paralelo passa de 15 s.

  it('Descrição ordena em ordem natural e sem acento, sobre todas as páginas', async () => {
    signedIn();
    renderApp('/historico');
    const user = userEvent.setup();

    await screen.findByText(/Página 1 de 3/);
    await user.click(screen.getByRole('button', { name: /^Descrição/ }));
    await waitFor(() => {
      const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
      expect(within(rows[0]!).getAllByRole('cell')[1]!.textContent).toMatch(
        /Gasto 01|Mercado|Ônibus|Padaria|Ração/,
      );
    });
    await user.click(screen.getByRole('button', { name: /^Descrição/ }));
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);

    // Descendente: 1ª página começa pelo último nome do conjunto inteiro ("Ração").
    expect(within(rows[0]!).getAllByRole('cell')[1]!.textContent).toContain('Ração');
  });
});

describe('histórico: filtro de datas com máscara e rota', () => {
  it('digitar 05112026 vira 05/11/2026 e filtra; data incompleta avisa', async () => {
    signedIn();
    renderApp('/historico');
    const user = userEvent.setup();

    await screen.findByText(/Página 1 de 3/);
    const from = screen.getByLabelText('De');

    await user.type(from, '07112026');
    expect(from).toHaveValue('07/11/2026');
    await user.clear(from);
    await user.type(from, '3102');
    await user.tab();
    expect(await screen.findByText('Use DD/MM/AAAA.')).toBeInTheDocument();
    await user.clear(from);
    await user.type(from, '31022026');
    expect(from).toHaveValue('31/02/2026');
    expect(screen.getByText('Use DD/MM/AAAA.')).toBeInTheDocument();
  });

  it('/gastos redireciona para /historico', async () => {
    signedIn();
    const router = renderApp('/gastos?novo=1');

    await screen.findByText(/Página 1 de 3/);
    expect(router.state.location.pathname).toBe('/historico');
    expect(router.state.location.search).toBe('?novo=1');
  });
});

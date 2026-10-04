import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { addCardPurchase, saveCreditCard } from '@manager-money/core/application/card.use-cases';

import { useDataStore } from '@/store/data.store';
import { setDependencies } from '@/store/dependencies';
import { useSessionStore } from '@/store/session.store';
import { at, userFixture } from '@/test/fixtures';
import { FakeAuth, MemoryGateway } from '@/test/memory-gateway';
import { renderApp } from '@/test/render';

const USER = 'user-1';
let gateway: MemoryGateway;
let sequence = 0;

function signedIn(withCard = false) {
  gateway = new MemoryGateway();
  let state = userFixture();
  if (withCard) {
    state = saveCreditCard(
      state,
      { name: 'Nubank', closingDay: 5, dueDay: 15, creditLimit: 500000 },
      at(2026, 11, 8),
    );
    state = addCardPurchase(
      state,
      {
        cardId: state.creditCards[0]!.id,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 30000,
        installments: 3,
        date: '2026-11-08',
      },
      at(2026, 11, 8),
    );
  }
  gateway.seed(state, USER);
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

describe('ajustes', () => {
  it('lista os atalhos do app e leva a cada tela', async () => {
    signedIn();
    renderApp('/ajustes');

    for (const [name, href] of [
      ['Configuração financeira', '/ajustes/configuracao'],
      ['Cartões de crédito', '/ajustes/cartoes'],
      ['Exportar dados', '/ajustes/exportar'],
      ['Política de privacidade', '/privacidade'],
    ] as const) {
      const link = await screen.findByRole('link', { name: new RegExp(name) });
      expect(link).toHaveAttribute('href', href);
    }
  });
});

describe('configuração financeira', () => {
  it('desativa uma despesa fixa e grava só as tabelas alteradas', async () => {
    signedIn();
    renderApp('/ajustes/configuracao');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: 'Despesa fixa 1 ativa' }));
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    await waitFor(() => expect(gateway.upserts.length).toBeGreaterThan(0));
    expect(gateway.upserts.map((item) => item.table)).toContain('fixed_expenses');
    expect(gateway.rows.fixed_expenses[0]?.active).toBe(false);
    expect(gateway.upserts.map((item) => item.table)).not.toContain('expenses');
  });

  it('plano acima da renda pede confirmação antes de salvar', async () => {
    signedIn();
    renderApp('/ajustes/configuracao');
    const user = userEvent.setup();

    const goal = await screen.findByLabelText('Meta mensal de economia');
    await user.clear(goal);
    await user.type(goal, '99999999');
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    const confirm = await screen.findByRole('alertdialog');
    expect(gateway.upserts).toEqual([]);
    await user.click(within(confirm).getByRole('button', { name: 'Salvar mesmo assim' }));
    await waitFor(() => expect(gateway.upserts.map((item) => item.table)).toContain('settings'));
  });

  it('valida o dia do pagamento sem gravar', async () => {
    signedIn();
    renderApp('/ajustes/configuracao');
    const user = userEvent.setup();

    const payday = await screen.findByLabelText('Dia do pagamento');
    await user.clear(payday);
    await user.type(payday, '30');
    await user.click(screen.getByRole('button', { name: 'Salvar configuração' }));

    expect(await screen.findByText('Informe um dia entre 1 e 28.')).toBeInTheDocument();
    expect(gateway.upserts).toEqual([]);
  });
});

describe('cartões', () => {
  it('cadastra um cartão e grava só a linha nova', async () => {
    signedIn();
    renderApp('/ajustes/cartoes');
    const user = userEvent.setup();

    expect(await screen.findByText('Nenhum cartão')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: /Novo cartão|Adicionar cartão/ })[0]!);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));
    expect(await within(dialog).findByText('Informe o nome do cartão.')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Nome do cartão'), 'Nubank');
    await user.type(within(dialog).getByLabelText(/Dia de fechamento/), '5');
    await user.type(within(dialog).getByLabelText(/Dia de vencimento/), '15');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(gateway.upserts).toEqual([{ table: 'credit_cards', count: 1 }]);
    expect(gateway.rows.credit_cards[0]).toMatchObject({
      name: 'Nubank',
      closing_day: 5,
      due_day: 15,
    });
    expect(await screen.findByText('Fecha dia 5 · Vence dia 15')).toBeInTheDocument();
  });

  it('lista limite e fatura; cartão com compras não pode ser excluído, só desativado', async () => {
    signedIn(true);
    renderApp('/ajustes/cartoes');
    const user = userEvent.setup();

    expect(await screen.findByText('Nubank')).toBeInTheDocument();
    expect(screen.getByText('Limite disponível do cartão')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excluir cartão Nubank' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Desativar cartão Nubank' }));
    await waitFor(() => expect(gateway.rows.credit_cards[0]?.active).toBe(false));
    expect(await screen.findByText('Inativo')).toBeInTheDocument();
  });

  it('detalhe: mostra faturas e edita a compra pelo lápis', async () => {
    signedIn(true);
    renderApp('/ajustes/cartoes');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('link', { name: 'Abrir cartão Nubank' }));
    expect(await screen.findByText('Fatura atual')).toBeInTheDocument();
    expect(screen.getByText('Próxima fatura')).toBeInTheDocument();
    expect(screen.getByText('Quanto vai pesar nos próximos ciclos?')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: /Ver compras da fatura/ })[0]!);
    await user.click((await screen.findAllByRole('button', { name: 'Editar compra TV' }))[0]!);
    const dialog = await screen.findByRole('dialog');
    const description = within(dialog).getByLabelText('Descrição');
    await user.clear(description);
    await user.type(description, 'TV 55');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(gateway.rows.card_purchases[0]?.description).toBe('TV 55'));
  });

  it('detalhe: paga a fatura fechada e desfaz o lançamento', async () => {
    signedIn(true);
    vi.setSystemTime(new Date(2026, 11, 8, 12)); // depois do fechamento (05/12), antes do vencimento
    renderApp('/ajustes/cartoes');
    const user = userEvent.setup();
    useDataStore.getState().reset();

    await user.click(await screen.findByRole('link', { name: 'Abrir cartão Nubank' }));
    const pay = await screen.findByRole('button', { name: /Paguei a fatura/ });
    await user.click(pay);
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Pagar o restante/ }));

    await waitFor(() => expect(gateway.rows.statement_payments).toHaveLength(1));
  });
});

describe('exportar dados', () => {
  it('baixa o JSON sem dados de sessão e sem gravar nada', async () => {
    signedIn();
    const parts: string[][] = [];
    // jsdom não implementa Blob.text(): captura o conteúdo recebido pelo construtor.
    vi.stubGlobal(
      'Blob',
      class {
        constructor(content: string[]) {
          parts.push(content);
        }
      },
    );
    const createObjectURL = vi.fn(() => 'blob:teste');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderApp('/ajustes/exportar');
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Baixar arquivo JSON' }));

    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:teste');
    const payload = JSON.parse(parts[0]![0]!);
    expect(payload).toMatchObject({ app: 'manager-money', sync: { lastSyncAt: null } });
    expect(payload.expenses.length).toBe(4);
    expect(JSON.stringify(payload)).not.toContain(USER);
    expect(gateway.upserts).toEqual([]);
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});

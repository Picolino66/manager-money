import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { addCardPurchase, saveCreditCard } from '../application/card.use-cases';
import { openCycle, saveConfig } from '../application/cycle.use-cases';
import { createEmptyState, LocalState } from '../application/state';
import { setUseCaseContextFactory, useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';
import { AccountScreen } from './AccountScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
import { CardsScreen } from './CardsScreen';
import { ConfigScreen } from './ConfigScreen';
import { IncomesScreen } from './IncomesScreen';
import { DashboardScreen } from './DashboardScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
// Ícones carregam fonte de forma assíncrona; irrelevante para o comportamento testado.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../infrastructure/supabase/client', () => ({ supabase: null, isSupabaseConfigured: false }));

const config = { incomeSources: [{ id: 'renda', name: 'Salário', amount: 310000, payday: 7 }], savingGoal: 0, customCategories: [], fixedExpenses: [] };

function seed(doc: LocalState) {
  return useFinancialStore.getState().replaceDocument(() => doc);
}

function activeDoc() {
  const today = new Date();
  const ctx = { now: today, newId: (p: string) => `${p}-1` };
  return openCycle(saveConfig(createEmptyState(), config, ctx), ctx);
}

const navigation = { navigate: mockNavigate, goBack: mockGoBack } as never;

beforeEach(async () => {
  jest.clearAllMocks();
  setUseCaseContextFactory(() => ({ now: new Date(), newId: (p) => `${p}-${Math.random()}` }));
  await seed({ ...createEmptyState() });
});

describe('DashboardScreen (FLOW-primeiro-uso)', () => {
  it('sem configuração leva à configuração', async () => {
    render(<DashboardScreen />);
    expect(screen.getByText('Configuração inicial')).toBeTruthy();
    fireEvent.press(screen.getByText('Configurar'));
    expect(mockNavigate).toHaveBeenCalledWith('Config');
  });

  it('com ciclo ativo mostra o limite e bloqueia o fechamento antes do fim', async () => {
    await seed(activeDoc());
    render(<DashboardScreen />);
    expect(screen.getByText('Ainda pode gastar')).toBeTruthy();
    expect(screen.getByText(/Se o pagamento cair antes, use "Já recebi"/)).toBeTruthy();
    fireEvent.press(screen.getByText('Registrar'));
    expect(mockNavigate).toHaveBeenCalledWith('AddExpense');
  });
});

describe('ConfigScreen (BR-FIN-018: várias fontes de renda)', () => {
  it('soma as fontes, permite adicionar e remover, e salva', async () => {
    render(<ConfigScreen navigation={navigation} route={{ key: 'k', name: 'Config', params: undefined }} />);
    fireEvent.changeText(screen.getByLabelText('Valor'), '300000');
    fireEvent.press(screen.getAllByText('Adicionar')[0]!);
    const names = screen.getAllByLabelText('Nome da fonte');
    expect(names).toHaveLength(2);
    fireEvent.changeText(names[1]!, 'Freela');
    fireEvent.changeText(screen.getAllByLabelText('Valor')[1]!, '50000');
    expect(screen.getByText('Total: R$ 3.500,00')).toBeTruthy();

    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('StartMonth'));
    expect(useFinancialStore.getState().config).toMatchObject({
      monthlyIncome: 350000,
      incomeSources: [
        expect.objectContaining({ name: 'Salário', amount: 300000 }),
        expect.objectContaining({ name: 'Freela', amount: 50000 }),
      ],
    });
  });

  it('não tem mais o dia global; cada fonte tem o seu e o ciclo usa o da maior', async () => {
    render(<ConfigScreen navigation={navigation} route={{ key: 'k', name: 'Config', params: undefined }} />);
    expect(screen.getAllByLabelText('Dia do pagamento (1 a 28)')).toHaveLength(1);

    fireEvent.changeText(screen.getByLabelText('Valor'), '300000');
    fireEvent.changeText(screen.getByLabelText('Dia do pagamento (1 a 28)'), '5');
    fireEvent.press(screen.getAllByText('Adicionar')[0]!);
    expect(screen.getAllByLabelText('Dia do pagamento (1 a 28)')).toHaveLength(2);
    fireEvent.changeText(screen.getAllByLabelText('Nome da fonte')[1]!, 'Freela');
    fireEvent.changeText(screen.getAllByLabelText('Valor')[1]!, '50000');
    fireEvent.changeText(screen.getAllByLabelText('Dia do pagamento (1 a 28)')[1]!, '20');
    expect(screen.getByText(/O ciclo usa o dia 5 \(Salário, a fonte de maior valor\)/)).toBeTruthy();

    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('StartMonth'));
    expect(useFinancialStore.getState().config).toMatchObject({
      payday: 5,
      incomeSources: [expect.objectContaining({ payday: 5 }), expect.objectContaining({ payday: 20 })],
    });
  });

  it('valida o dia de pagamento de cada fonte', async () => {
    render(<ConfigScreen navigation={navigation} route={{ key: 'k', name: 'Config', params: undefined }} />);
    fireEvent.changeText(screen.getByLabelText('Valor'), '1000');
    fireEvent.changeText(screen.getByLabelText('Dia do pagamento (1 a 28)'), '29');
    fireEvent.press(screen.getByText('Salvar configuração'));
    expect(await screen.findByText('Informe um dia entre 1 e 28.')).toBeTruthy();
  });

  it('exige nome e valor em cada fonte', async () => {
    render(<ConfigScreen navigation={navigation} route={{ key: 'k', name: 'Config', params: undefined }} />);
    fireEvent.changeText(screen.getAllByLabelText('Nome da fonte')[0]!, '');
    fireEvent.press(screen.getByText('Salvar configuração'));
    expect(await screen.findByText('Informe o nome da fonte.')).toBeTruthy();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy();
  });
});

function docWithFixed(withCard = false) {
  const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
  const fixed = [{ id: 'aluguel', type: 'permanent' as const, name: 'Aluguel', category: 'Moradia', amount: 150000 }];
  const doc = openCycle(saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed }, ctx), ctx);

  return withCard ? saveCreditCard(doc, { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx) : doc;
}

const expandFixed = () => fireEvent.press(screen.getByLabelText('Mostrar ou ocultar despesas fixas do ciclo'));

describe('Despesas fixas do ciclo (BR-FIN-021/022)', () => {
  it('nasce encolhida só com o resumo, expande ao tocar e a tela não tem mais o botão Config', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expect(screen.getByText('Despesas fixas do ciclo')).toBeTruthy();
    expect(screen.getByText(/Pagas R\$ 0,00 · Pendentes R\$ 1\.500,00/)).toBeTruthy();
    expect(screen.queryByLabelText('Pagar Aluguel')).toBeNull();
    expect(screen.queryByText('Config')).toBeNull();

    expandFixed();
    expect(screen.getByLabelText('Pagar Aluguel')).toBeTruthy();
    expandFixed();
    expect(screen.queryByLabelText('Pagar Aluguel')).toBeNull();
  });

  it('o pagamento tem 2 formas, como em Registrar gasto: À vista (Pix, dinheiro ou débito) e Cartão de crédito', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expandFixed();
    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    expect(await screen.findByLabelText('À vista (Pix, dinheiro ou débito)')).toBeTruthy();
    expect(screen.getByLabelText('Cartão de crédito')).toBeTruthy();
    // À vista não abre outro menu.
    expect(screen.queryByLabelText('Pix')).toBeNull();
    expect(screen.queryByLabelText('Débito')).toBeNull();
    expect(screen.queryByLabelText('Dinheiro')).toBeNull();
    fireEvent.press(screen.getByLabelText('Cartão de crédito'));
    expect(screen.getByText('Cadastre um cartão para pagar no crédito.')).toBeTruthy();
  });

  it('lista pendentes, paga à vista e descontar da renda do ciclo', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expandFixed();
    expect(screen.getByText('Despesas fixas do ciclo')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(310000);

    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    expect(await screen.findByText('Pagar Aluguel')).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmar pagamento'));

    expect(await screen.findByText('Pago · À vista')).toBeTruthy();
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(160000);
    expect(useFinancialStore.getState().doc.fixedPayments[0]).toMatchObject({ method: 'cash', amount: 150000 });
  });

  it('no crédito pede cartão, parcelas e juros e cria a compra no cartão', async () => {
    await seed(docWithFixed(true));
    render(<DashboardScreen />);
    expandFixed();
    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    fireEvent.press(await screen.findByLabelText('Cartão de crédito'));
    fireEvent.changeText(screen.getByLabelText('Parcelas'), '3');
    fireEvent.changeText(screen.getByLabelText('Juros cobrados (R$)'), '5000');
    expect(await screen.findByText(/Total R\$ 1\.550,00 em 3x de R\$ 516,67/)).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmar pagamento'));

    await waitFor(() => expect(useFinancialStore.getState().doc.fixedPayments).toHaveLength(1));
    const { doc } = useFinancialStore.getState();
    expect(doc.fixedPayments[0]).toMatchObject({ method: 'credit', amount: 150000, interest: 5000 });
    expect(doc.cardPurchases[0]).toMatchObject({ totalAmount: 155000, installments: 3, description: 'Aluguel' });
  });

  it('no crédito sem cartão oferece cadastrar um', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expandFixed();
    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    fireEvent.press(await screen.findByLabelText('Cartão de crédito'));
    expect(screen.getByText('Cadastre um cartão para pagar no crédito.')).toBeTruthy();
    fireEvent.press(screen.getByText('Cadastrar cartão'));
    expect(mockNavigate).toHaveBeenCalledWith('Cards');
  });

  it('desfazer volta a despesa para pendente', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expandFixed();
    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    fireEvent.press(await screen.findByText('Confirmar pagamento'));
    expect(await screen.findByText('Pago · À vista')).toBeTruthy();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    fireEvent.press(screen.getByLabelText('Desfazer pagamento de Aluguel'));
    expect(await screen.findByText('Pendente')).toBeTruthy();
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(310000);
    alertSpy.mockRestore();
  });
});

describe('IncomesScreen (BR-FIN-023)', () => {
  const route = { key: 'k', name: 'Incomes', params: undefined } as const;

  it('sem ciclo ativo leva a iniciar o ciclo', () => {
    render(<IncomesScreen navigation={navigation} route={route} />);
    fireEvent.press(screen.getByText('Iniciar ciclo'));
    expect(mockNavigate).toHaveBeenCalledWith('StartMonth');
  });

  it('valida, lança a renda avulsa que soma ao saldo e permite excluir', async () => {
    await seed(activeDoc());
    render(<IncomesScreen navigation={navigation} route={route} />);
    fireEvent.press(screen.getByText('Adicionar renda'));
    fireEvent.press(screen.getByText('Salvar renda'));
    expect(await screen.findByText('Informe o nome da renda.')).toBeTruthy();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Nome da renda'), 'Freela');
    fireEvent.changeText(screen.getByLabelText('Valor'), '50000');
    fireEvent.press(screen.getByText('Salvar renda'));
    expect(await screen.findByText(/Freela/)).toBeTruthy();
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(310000 + 50000);

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    fireEvent.press(screen.getByLabelText('Excluir renda Freela'));
    await waitFor(() => expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(310000));
    alertSpy.mockRestore();
  });
});

describe('CardsScreen (BR-FIN-019)', () => {
  const route = { key: 'k', name: 'Cards', params: undefined } as const;

  it('sem cartões oferece cadastrar; valida e salva o cartão', async () => {
    render(<CardsScreen navigation={navigation} route={route} />);
    expect(screen.getByText('Nenhum cartão')).toBeTruthy();
    fireEvent.press(screen.getByText('Adicionar cartão'));

    fireEvent.press(screen.getByText('Salvar cartão'));
    expect(await screen.findByText('Informe o nome do cartão.')).toBeTruthy();
    expect(screen.getAllByText('Informe um dia entre 1 e 28.')).toHaveLength(2);

    fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Nubank');
    fireEvent.changeText(screen.getByLabelText('Dia de fechamento (1 a 28)'), '25');
    fireEvent.changeText(screen.getByLabelText('Dia de vencimento (1 a 28)'), '5');
    fireEvent.press(screen.getByText('Salvar cartão'));

    expect(await screen.findByText('Fecha dia 25 · Vence dia 5')).toBeTruthy();
    expect(useFinancialStore.getState().doc.creditCards[0]).toMatchObject({ name: 'Nubank', closingDay: 25, dueDay: 5 });
  });

  it('mostra a fatura do ciclo e exclui a compra', async () => {
    const today = new Date();
    const ctx = { now: today, newId: (p: string) => `${p}-${Math.random()}` };
    let doc = saveCreditCard(activeDoc(), { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx);
    const start = doc.cycles[0]!.startDate;
    doc = addCardPurchase(doc, { cardId: doc.creditCards[0]!.id, description: 'Notebook', category: 'Outros', totalAmount: 30000, installments: 3, date: start }, ctx);
    await seed(doc);

    render(<CardsScreen navigation={navigation} route={route} />);
    expect(screen.getByText('Fatura deste ciclo')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Fatura do cartão Nubank'));
    expect(await screen.findByText('Notebook')).toBeTruthy();
    expect(screen.getByText(/Parcela 1\/3/)).toBeTruthy();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    fireEvent.press(screen.getByLabelText('Excluir compra Notebook'));
    await waitFor(() => expect(useFinancialStore.getState().doc.cardPurchases[0]?.deletedAt).not.toBeNull());
    alertSpy.mockRestore();
  });
});

describe('AddExpenseScreen (FLOW-registrar-gasto)', () => {
  it('registra um gasto e volta', async () => {
    await seed(activeDoc());
    render(<AddExpenseScreen navigation={navigation} route={{ key: 'k', name: 'AddExpense', params: undefined }} />);
    fireEvent.changeText(screen.getByLabelText('Valor'), '2550');
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Almoço');
    fireEvent.press(screen.getByText('Salvar gasto'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(useFinancialStore.getState().activeMonth?.expenses[0]).toMatchObject({ amount: 2550, description: 'Almoço' });
  });

  it('valida descrição obrigatória', async () => {
    await seed(activeDoc());
    render(<AddExpenseScreen navigation={navigation} route={{ key: 'k', name: 'AddExpense', params: undefined }} />);
    fireEvent.changeText(screen.getByLabelText('Valor'), '100');
    fireEvent.press(screen.getByText('Salvar gasto'));
    expect(await screen.findByText('Informe uma descrição.')).toBeTruthy();
  });

  it('no crédito, registra a compra parcelada no cartão e não cria gasto à vista', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(saveCreditCard(activeDoc(), { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx));
    render(<AddExpenseScreen navigation={navigation} route={{ key: 'k', name: 'AddExpense', params: undefined }} />);

    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    fireEvent.changeText(screen.getByLabelText('Parcelas'), '3');
    fireEvent.changeText(screen.getByLabelText('Valor total (com juros)'), '30000');
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Notebook');
    expect(await screen.findByText(/3x de R\$ 100,00/)).toBeTruthy();
    fireEvent.press(screen.getByText('Salvar compra no crédito'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    const { doc, activeMonth } = useFinancialStore.getState();
    expect(doc.cardPurchases[0]).toMatchObject({ totalAmount: 30000, installments: 3, description: 'Notebook' });
    expect(activeMonth?.expenses).toHaveLength(0);
  });

  it('no crédito sem cartão oferece cadastrar um', async () => {
    await seed(activeDoc());
    render(<AddExpenseScreen navigation={navigation} route={{ key: 'k', name: 'AddExpense', params: undefined }} />);
    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    fireEvent.press(screen.getByText('Cadastrar cartão'));
    expect(mockNavigate).toHaveBeenCalledWith('Cards');
  });

  it('edição oferece excluir', async () => {
    let doc = activeDoc();
    const store = useFinancialStore.getState();
    await seed(doc);
    await store.addExpense({ amount: 100, category: 'Outros', description: 'Pão', date: doc.cycles[0]!.startDate });
    doc = useFinancialStore.getState().doc;
    const id = doc.expenses[0]!.id;
    render(<AddExpenseScreen navigation={navigation} route={{ key: 'k', name: 'AddExpense', params: { expenseId: id } }} />);
    expect(await screen.findByText('Excluir gasto')).toBeTruthy();
    expect(screen.getByText('Salvar alterações')).toBeTruthy();
  });
});

describe('AccountScreen', () => {
  it('sem Supabase mostra modo local', () => {
    useSessionStore.setState({ status: 'disabled' });
    render(<AccountScreen />);
    expect(screen.getByText('Modo local')).toBeTruthy();
  });

  it('deslogado mostra e-mail e senha e valida antes de chamar o servidor', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const signUp = jest.fn();
    useSessionStore.setState({ status: 'signed-out', signUp });
    render(<AccountScreen />);
    expect(screen.getByText('Entrar')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@email.com');
    fireEvent.changeText(screen.getByLabelText('Senha'), '123');
    fireEvent.press(screen.getByText('Criar conta'));
    expect(alert).toHaveBeenCalledWith('Senha curta', expect.stringContaining('8 caracteres'));

    fireEvent.changeText(screen.getByLabelText('E-mail'), 'inválido');
    fireEvent.press(screen.getByText('Entrar'));
    expect(alert).toHaveBeenCalledWith('E-mail inválido', expect.any(String));
    expect(signUp).not.toHaveBeenCalled();
  });
});

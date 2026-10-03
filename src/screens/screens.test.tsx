import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { openCycle, saveConfig } from '../application/cycle.use-cases';
import { createEmptyState, LocalState } from '../application/state';
import { setUseCaseContextFactory, useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';
import { AccountScreen } from './AccountScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
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

const config = { monthlyIncome: 310000, savingGoal: 0, payday: 7, customCategories: [], fixedExpenses: [] };

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

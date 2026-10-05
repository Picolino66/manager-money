import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { addMonths, format } from 'date-fns';
import { Alert } from 'react-native';

import {
  addCardPurchase,
  saveCreditCard,
  setCreditCardActive,
} from '@manager-money/core/application/card.use-cases';
import { addExpense, openCycle, saveConfig } from '@manager-money/core/application/cycle.use-cases';
import {
  openCycleAndLaunch,
  payFixedExpense,
} from '@manager-money/core/application/payment.use-cases';
import {
  CardPurchaseRecord,
  createEmptyState,
  LocalState,
} from '@manager-money/core/application/state';
import { setUseCaseContextFactory, useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';
import { formatCurrency } from '@manager-money/core/utils/currency';
import { AccountScreen } from './AccountScreen';
import { AddExpenseScreen } from './AddExpenseScreen';
import { CardsScreen } from './CardsScreen';
import { selectPaidHistory } from '@manager-money/core/application/paid-history';
import { ManageCategoriesScreen } from './ManageCategoriesScreen';
import { CategoriesReport } from './reports/CategoriesReport';
import { CreditReport } from './reports/CreditReport';
import { CyclesReport } from './reports/CyclesReport';
import { ConfigScreen } from './ConfigScreen';
import { IncomesScreen } from './IncomesScreen';
import { DailyHistoryScreen } from './DailyHistoryScreen';
import { DashboardScreen } from './DashboardScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));
// Ícones carregam fonte de forma assíncrona; irrelevante para o comportamento testado.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../infrastructure/supabase/client', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

const config = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 310000, payday: 7 }],
  savingGoal: 0,
  customCategories: [],
  fixedExpenses: [],
};

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

  it('ciclo no negativo mostra R$ 0,00 e quanto falta cobrir (BR-FIN-040)', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    // Fixa maior que a renda: o ciclo já começa no negativo.
    const doc = openCycle(
      saveConfig(
        createEmptyState(),
        {
          ...config,
          fixedExpenses: [
            {
              id: 'aluguel',
              type: 'permanent' as const,
              name: 'Aluguel',
              category: 'Moradia',
              amount: 400000,
            },
          ],
        },
        ctx,
      ),
      ctx,
    );
    await seed(doc);
    render(<DashboardScreen />);

    // Renda R$ 3.100,00 − fixa R$ 4.000,00 = faltam R$ 900,00.
    expect(screen.getAllByText('R$ 0,00').length).toBeGreaterThan(0);
    expect(screen.getByText(/^Ciclo no negativo: faltam R\$\s900,00 para cobrir até/)).toBeTruthy();
  });

  it('com ciclo ativo mostra o limite e bloqueia o fechamento antes do fim', async () => {
    await seed(activeDoc());
    render(<DashboardScreen />);
    expect(screen.getByText('Ainda pode gastar hoje')).toBeTruthy();
    expect(screen.queryByText('Já gastou hoje')).toBeNull();
    expect(screen.getByText('Disponível no ciclo')).toBeTruthy();
    expect(screen.getByText('Disponível no crédito')).toBeTruthy();
    expect(screen.getByText('Gasto do saldo')).toBeTruthy();
    expect(screen.getByText('Gasto no crédito')).toBeTruthy();
    expect(screen.getByText(/^Saldo em conta: R\$/)).toBeTruthy();
    expect(screen.queryByText('Limite previsto para hoje')).toBeNull();
    expect(screen.getByText('Dias restantes')).toBeTruthy();
    expect(screen.getByText('Meta de economia (guardada)')).toBeTruthy();
    // Plano do ciclo nasce recolhido, só com o saldo inicial.
    expect(screen.getByText('Saldo inicial R$ 3.100,00')).toBeTruthy();
    expect(screen.queryByText('− Despesas fixas reservadas')).toBeNull();
    expect(screen.getByText(/Se o pagamento cair antes, use "Já recebi"/)).toBeTruthy();
    fireEvent.press(screen.getByText('Registrar'));
    expect(mockNavigate).toHaveBeenCalledWith('AddExpense');
  });
});

describe('ConfigScreen (BR-FIN-018: várias fontes de renda)', () => {
  it('soma as fontes, permite adicionar e remover, e salva', async () => {
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
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
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    expect(screen.getAllByLabelText('Dia do pagamento (1 a 28)')).toHaveLength(1);

    fireEvent.changeText(screen.getByLabelText('Valor'), '300000');
    fireEvent.changeText(screen.getByLabelText('Dia do pagamento (1 a 28)'), '5');
    fireEvent.press(screen.getAllByText('Adicionar')[0]!);
    expect(screen.getAllByLabelText('Dia do pagamento (1 a 28)')).toHaveLength(2);
    fireEvent.changeText(screen.getAllByLabelText('Nome da fonte')[1]!, 'Freela');
    fireEvent.changeText(screen.getAllByLabelText('Valor')[1]!, '50000');
    fireEvent.changeText(screen.getAllByLabelText('Dia do pagamento (1 a 28)')[1]!, '20');
    expect(
      screen.getByText(/O ciclo usa o dia 5 \(Salário, a fonte de maior valor\)/),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('StartMonth'));
    expect(useFinancialStore.getState().config).toMatchObject({
      payday: 5,
      incomeSources: [
        expect.objectContaining({ payday: 5 }),
        expect.objectContaining({ payday: 20 }),
      ],
    });
  });

  it('valida o dia de pagamento de cada fonte', async () => {
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Valor'), '1000');
    fireEvent.changeText(screen.getByLabelText('Dia do pagamento (1 a 28)'), '29');
    fireEvent.press(screen.getByText('Salvar configuração'));
    expect(await screen.findByText('Informe um dia entre 1 e 28.')).toBeTruthy();
  });

  it('BR-FIN-018: fonte inativa não soma; grava active=false e exige ao menos uma ativa', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-1` };
    await seed(
      saveConfig(
        createEmptyState(),
        {
          ...config,
          incomeSources: [
            { id: 'renda', name: 'Salário', amount: 300000, payday: 7 },
            { id: 'freela', name: 'Freela', amount: 50000, payday: 20 },
          ],
        },
        ctx,
      ),
    );
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    expect(screen.getByText('Total: R$ 3.500,00')).toBeTruthy();
    fireEvent(screen.getByLabelText('Fonte de renda 2 ativa'), 'valueChange', false);
    expect(await screen.findByText('Total: R$ 3.000,00')).toBeTruthy();
    expect(screen.getByText('Inativa')).toBeTruthy();

    fireEvent(screen.getByLabelText('Fonte de renda 1 ativa'), 'valueChange', false);
    fireEvent.press(screen.getByText('Salvar configuração'));
    expect(await screen.findByText('Mantenha ao menos uma fonte de renda ativa.')).toBeTruthy();

    fireEvent(screen.getByLabelText('Fonte de renda 1 ativa'), 'valueChange', true);
    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('StartMonth'));
    const saved = useFinancialStore.getState().config;
    expect(saved?.monthlyIncome).toBe(300000);
    expect(saved?.incomeSources[0]).not.toHaveProperty('active');
    // Os demais campos (dia de pagamento) são reenviados intactos.
    expect(saved?.incomeSources[1]).toMatchObject({ id: 'freela', payday: 20, active: false });
  });

  it('desativar parcelamento em andamento preserva o início e as parcelas e libera a reserva', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-1` };
    const fixed = [
      {
        id: 'carne',
        type: 'installment' as const,
        name: 'Carnê',
        category: 'Outros',
        installmentAmount: 20000,
        totalInstallments: 5,
        remainingInstallments: 4,
      },
    ];
    await seed(
      openCycle(saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed }, ctx), ctx),
    );
    const startedAt = useFinancialStore.getState().doc.fixedExpenses[0];
    expect(startedAt).toMatchObject({ startedAtCycleId: 'cycle-1' });
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(290000);

    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    expect(
      screen.getByText(/Parcelamentos do cartão de crédito são cadastrados no próprio cartão/),
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Parcelamentos'));
    fireEvent(screen.getByLabelText('Parcelamento 1 ativo'), 'valueChange', false);
    expect(
      await screen.findByText('Não reserva dinheiro no ciclo e as parcelas ficam pausadas.'),
    ).toBeTruthy();
    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('MainTabs'));

    const { doc, activeMonth } = useFinancialStore.getState();
    expect(doc.fixedExpenses[0]).toMatchObject({
      active: false,
      startedAtCycleId: 'cycle-1',
      remainingInstallments: 4,
      totalInstallments: 5,
    });
    expect(activeMonth?.initialAvailableAmount).toBe(310000);
  });

  it('despesa fixa tem interruptor e reativar não grava active', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-1` };
    const fixed = [
      {
        id: 'aluguel',
        type: 'permanent' as const,
        name: 'Aluguel',
        category: 'Moradia',
        amount: 150000,
        active: false,
      },
    ];
    await seed(saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed }, ctx));
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    expect(screen.getByText('Total: R$ 0,00')).toBeTruthy();
    fireEvent.press(screen.getByText('Despesas fixas'));
    fireEvent(screen.getByLabelText('Despesa fixa 1 ativa'), 'valueChange', true);
    expect(await screen.findByText('Total: R$ 1.500,00')).toBeTruthy();
    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('StartMonth'));
    expect(useFinancialStore.getState().doc.fixedExpenses[0]).not.toHaveProperty('active');
  });

  it('despesa fixa recorrente no cartão: liga o interruptor, escolhe o cartão e salva', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    const fixed = [
      {
        id: 'netflix',
        type: 'permanent' as const,
        name: 'Netflix',
        category: 'Lazer',
        amount: 5000,
      },
    ];
    let doc = saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed }, ctx);
    doc = saveCreditCard(doc, { name: 'Nubank', closingDay: 5, dueDay: 15 }, ctx);
    doc = saveCreditCard(doc, { name: 'Inter', closingDay: 8, dueDay: 18 }, ctx);
    await seed(doc);
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('Despesas fixas'));

    // Desligada por padrão: sem escolha de cartão.
    expect(screen.queryByText('Cartão da despesa recorrente')).toBeNull();
    fireEvent(
      screen.getByLabelText('Despesa fixa 1 recorrente no cartão de crédito'),
      'valueChange',
      true,
    );
    expect(await screen.findByText('Cartão da despesa recorrente')).toBeTruthy();
    fireEvent.press(screen.getAllByText('Nubank')[0]!);
    fireEvent.press(await screen.findByText('Inter'));

    fireEvent.press(screen.getByText('Salvar configuração'));
    await waitFor(() =>
      expect(useFinancialStore.getState().doc.fixedExpenses[0]).toHaveProperty('recurringCardId'),
    );
    const { doc: saved } = useFinancialStore.getState();
    const inter = saved.creditCards.find((card) => card.name === 'Inter')!;
    expect(saved.fixedExpenses[0]).toMatchObject({ recurringCardId: inter.id, dirty: true });
  });

  it('sem cartão ativo o interruptor fica desabilitado com a dica', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(
      saveConfig(
        createEmptyState(),
        {
          ...config,
          fixedExpenses: [
            {
              id: 'n',
              type: 'permanent' as const,
              name: 'Netflix',
              category: 'Lazer',
              amount: 5000,
            },
          ],
        },
        ctx,
      ),
    );
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('Despesas fixas'));

    expect(screen.getByText('Cadastre um cartão em Cartões para usar.')).toBeTruthy();
    expect(
      screen.getByLabelText('Despesa fixa 1 recorrente no cartão de crédito').props.disabled,
    ).toBe(true);
  });

  it('exige nome e valor em cada fonte', async () => {
    render(
      <ConfigScreen
        navigation={navigation}
        route={{ key: 'k', name: 'Config', params: undefined }}
      />,
    );
    fireEvent.changeText(screen.getAllByLabelText('Nome da fonte')[0]!, '');
    fireEvent.press(screen.getByText('Salvar configuração'));
    expect(await screen.findByText('Informe o nome da fonte.')).toBeTruthy();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy();
  });
});

function docWithFixed(withCard = false) {
  const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
  const fixed = [
    {
      id: 'aluguel',
      type: 'permanent' as const,
      name: 'Aluguel',
      category: 'Moradia',
      amount: 150000,
    },
  ];
  const doc = openCycle(
    saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed }, ctx),
    ctx,
  );

  return withCard ? saveCreditCard(doc, { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx) : doc;
}

const expandFixed = () =>
  fireEvent.press(screen.getByLabelText('Mostrar ou ocultar despesas fixas do ciclo'));

describe('Hoje: fixa recorrente no cartão (BR-FIN-035)', () => {
  function recurringDoc(cardActive: boolean) {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    const fixed = (recurringCardId?: string) => [
      {
        id: 'netflix',
        type: 'permanent' as const,
        name: 'Netflix',
        category: 'Lazer',
        amount: 5000,
        ...(recurringCardId ? { recurringCardId } : {}),
      },
    ];
    let doc = saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed() }, ctx);
    // Fecha dia 6: a fatura vira no dia 7, o início do ciclo (payday 7), então já lança ao abrir.
    doc = saveCreditCard(doc, { name: 'Nubank', closingDay: 6, dueDay: 15 }, ctx);
    const cardId = doc.creditCards[0]!.id;
    doc = saveConfig(doc, { ...config, fixedExpenses: fixed(cardId) }, ctx);
    if (!cardActive) doc = setCreditCardActive(doc, cardId, false, ctx);

    return openCycleAndLaunch(doc, ctx);
  }

  it('quando a fatura vira a fixa aparece paga no cartão, lançada automaticamente', async () => {
    await seed(recurringDoc(true));
    render(<DashboardScreen />);
    expandFixed();

    expect(await screen.findByText(/Pago · Crédito · lançada automaticamente/)).toBeTruthy();
    expect(screen.queryByLabelText('Pagar Netflix')).toBeNull();
    expect(useFinancialStore.getState().doc.cardPurchases).toHaveLength(1);
  });

  it('cartão inativo: fica pendente com o motivo e pode ser paga manualmente', async () => {
    await seed(recurringDoc(false));
    render(<DashboardScreen />);
    expandFixed();

    expect(
      await screen.findByText('O cartão Nubank está inativo: a despesa não foi lançada.'),
    ).toBeTruthy();
    expect(screen.getByLabelText('Pagar Netflix')).toBeTruthy();
  });
});

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

  it('BR-FIN-004: pendente já está reservada; pagar à vista não muda o saldo', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expandFixed();
    expect(screen.getByText('Despesas fixas do ciclo')).toBeTruthy();
    expect(screen.getByText('Pendente')).toBeTruthy();
    expect(screen.getByText(/As pendentes já estão reservadas no seu saldo/)).toBeTruthy();
    // 310.000 − 150.000 (aluguel reservado) = 160.000
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(160000);

    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    expect(await screen.findByText('Pagar Aluguel')).toBeTruthy();
    expect(screen.getByText(/já estava reservado no saldo do ciclo/)).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmar pagamento'));

    expect(await screen.findByText('Pago · À vista')).toBeTruthy();
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(160000);
    expect(useFinancialStore.getState().doc.fixedPayments[0]).toMatchObject({
      method: 'cash',
      amount: 150000,
    });
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
    expect(doc.fixedPayments[0]).toMatchObject({
      method: 'credit',
      amount: 150000,
      interest: 5000,
    });
    expect(doc.cardPurchases[0]).toMatchObject({
      totalAmount: 155000,
      installments: 3,
      description: 'Aluguel',
    });
  });

  it('no crédito mostra o limite do cartão e avisa (sem bloquear) quando passa dele', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(
      saveCreditCard(
        docWithFixed(),
        { name: 'Nubank', closingDay: 28, dueDay: 5, creditLimit: 100000 },
        ctx,
      ),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Registrar mesmo assim')?.onPress?.();
    });
    render(<DashboardScreen />);
    expandFixed();
    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    fireEvent.press(await screen.findByLabelText('Cartão de crédito'));
    expect(screen.getByText('Limite disponível do cartão: R$ 1.000,00')).toBeTruthy();
    expect(screen.getByText('Esta compra passa do limite disponível do cartão.')).toBeTruthy();
    expect(screen.getByText(/entra na fatura que vence/)).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmar pagamento'));

    await waitFor(() => expect(useFinancialStore.getState().doc.fixedPayments).toHaveLength(1));
    expect(alertSpy).toHaveBeenCalledWith(
      'Passa do limite do cartão',
      expect.any(String),
      expect.any(Array),
      expect.any(Object),
    );
    alertSpy.mockRestore();
  });

  it('não mostra fixa inativa, mas mantém o pagamento já feito visível', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    const fixed = [
      {
        id: 'aluguel',
        type: 'permanent' as const,
        name: 'Aluguel',
        category: 'Moradia',
        amount: 150000,
      },
      {
        id: 'academia',
        type: 'permanent' as const,
        name: 'Academia',
        category: 'Saúde',
        amount: 10000,
        active: false,
      },
    ];
    const doc = openCycle(
      saveConfig(createEmptyState(), { ...config, fixedExpenses: fixed }, ctx),
      ctx,
    );
    await seed(doc);
    const { unmount } = render(<DashboardScreen />);
    expandFixed();
    expect(screen.getByLabelText('Pagar Aluguel')).toBeTruthy();
    expect(screen.queryByText('Academia')).toBeNull();
    // Só a ativa fica reservada: 310.000 − 150.000.
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(160000);
    unmount();

    // Pago à vista e depois desativado: o pagamento continua visível no ciclo.
    const paid = payFixedExpense(doc, { fixedExpenseId: 'aluguel', method: 'cash' }, ctx);
    await seed(
      saveConfig(
        paid,
        { ...config, fixedExpenses: fixed.map((item) => ({ ...item, active: false })) },
        ctx,
      ),
    );
    render(<DashboardScreen />);
    expandFixed();
    expect(screen.getByText('Aluguel')).toBeTruthy();
    expect(screen.getByText('Pago · À vista')).toBeTruthy();
  });

  it('no crédito sem cartão oferece cadastrar um', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    expandFixed();
    fireEvent.press(screen.getByLabelText('Pagar Aluguel'));
    fireEvent.press(await screen.findByLabelText('Cartão de crédito'));
    expect(screen.getByText('Cadastre um cartão para pagar no crédito.')).toBeTruthy();
    fireEvent.press(screen.getByText('Cadastrar cartão'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Cards' });
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
    // Volta a ficar reservada: o saldo não muda.
    expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(160000);
    alertSpy.mockRestore();
  });
});

function overduePurchase(cardId: string): CardPurchaseRecord {
  const statementKey = format(addMonths(new Date(), -2), 'yyyy-MM');
  const now = new Date().toISOString();

  return {
    id: 'compra-antiga',
    cardId,
    description: 'Geladeira',
    category: 'Moradia',
    totalAmount: 40000,
    installments: 1,
    purchaseDate: `${statementKey}-01`,
    firstStatementKey: statementKey,
    firstCycleKey: statementKey,
    settledInstallments: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: false,
  };
}

describe('Hoje: plano do ciclo com fatura parcial (SPEC-018)', () => {
  it('o plano traz juros e a fatura pendente do ciclo anterior', async () => {
    const doc = docWithFixed(true);
    const cycle = doc.cycles[0]!;
    const purchase = overduePurchase(doc.creditCards[0]!.id);
    const now = new Date().toISOString();
    await seed({
      ...doc,
      cycles: [{ ...cycle, carriedStatementDebt: 5000 }],
      cardPurchases: [purchase],
      statementPayments: [
        {
          id: 'lancamento-parcial',
          cardId: purchase.cardId,
          statementKey: purchase.firstStatementKey,
          cycleId: cycle.id,
          statementAmount: 40000,
          paidAmount: 10000,
          charges: 1500,
          paidAt: now.slice(0, 10),
          updatedAt: now,
          deletedAt: null,
          dirty: false,
        },
      ],
    });
    render(<DashboardScreen />);
    fireEvent.press(screen.getByLabelText('Mostrar ou ocultar o plano do ciclo'));
    expect(screen.getByText('− Juros/multas de faturas')).toBeTruthy();
    expect(screen.getByText('− Fatura pendente do ciclo anterior')).toBeTruthy();
    expect(screen.getByText('R$ 50,00')).toBeTruthy();
  });

  it('plano do ciclo expande e mostra fixas reservadas (pagas + pendentes)', async () => {
    await seed(docWithFixed());
    render(<DashboardScreen />);
    fireEvent.press(screen.getByLabelText('Mostrar ou ocultar o plano do ciclo'));
    expect(screen.getByText('− Despesas fixas reservadas')).toBeTruthy();
    expect(screen.getByText('Pendentes (reservadas)')).toBeTruthy();
    expect(screen.getByText('= Saldo inicial do ciclo')).toBeTruthy();
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
    await waitFor(() =>
      expect(useFinancialStore.getState().activeMonth?.initialAvailableAmount).toBe(310000),
    );
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
    expect(useFinancialStore.getState().doc.creditCards[0]).toMatchObject({
      name: 'Nubank',
      closingDay: 25,
      dueDay: 5,
    });
  });
});

describe('AddExpenseScreen (FLOW-registrar-gasto)', () => {
  it('registra um gasto e volta', async () => {
    await seed(activeDoc());
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Valor'), '2550');
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Almoço');
    fireEvent.press(screen.getByText('Salvar gasto'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(useFinancialStore.getState().activeMonth?.expenses[0]).toMatchObject({
      amount: 2550,
      description: 'Almoço',
    });
  });

  it('à vista a descrição é opcional (usa a categoria); no crédito é obrigatória', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(saveCreditCard(activeDoc(), { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx));
    const { unmount } = render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Valor'), '100');
    fireEvent.press(screen.getByText('Salvar gasto'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(useFinancialStore.getState().activeMonth?.expenses[0]).toMatchObject({
      amount: 100,
      description: 'Outros',
    });
    unmount();

    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    fireEvent.changeText(screen.getByLabelText('Valor total (com juros)'), '100');
    fireEvent.press(screen.getByText('Salvar compra no crédito'));
    expect(await screen.findByText('Informe uma descrição.')).toBeTruthy();
    expect(useFinancialStore.getState().doc.cardPurchases).toHaveLength(0);
  });

  it('ordem do formulário: valor, forma de pagamento, cartão, parcelas, categoria, descrição, data', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(saveCreditCard(activeDoc(), { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx));
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    const labels = screen
      .getAllByText(
        /^(Valor total \(com juros\)|Forma de pagamento|Cartão|Parcelas|Categoria|Descrição|Data)$/,
      )
      .map((node) => node.props.children as string);
    expect(labels).toEqual([
      'Valor total (com juros)',
      'Forma de pagamento',
      'Cartão',
      'Parcelas',
      'Categoria',
      'Descrição',
      'Data',
    ]);
  });

  it('no crédito mostra o limite disponível e avisa sem bloquear quando a compra passa dele', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(
      saveCreditCard(
        activeDoc(),
        { name: 'Nubank', closingDay: 28, dueDay: 5, creditLimit: 20000 },
        ctx,
      ),
    );
    let choice = 'Cancelar';
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === choice)?.onPress?.();
    });
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    expect(screen.getByText('Limite disponível do cartão: R$ 200,00')).toBeTruthy();
    expect(screen.getByText(/Limite do cartão não é dinheiro para gastar/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Valor total (com juros)'), '30000');
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Notebook');
    expect(
      await screen.findByText('Esta compra passa do limite disponível do cartão.'),
    ).toBeTruthy();
    expect(screen.getByText(/entra na fatura que vence \d{2}\/\d{2}/)).toBeTruthy();

    fireEvent.press(screen.getByText('Salvar compra no crédito'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        'Passa do limite do cartão',
        `Esta compra excede em ${formatCurrency(10000)} o limite disponível cadastrado deste cartão. ` +
          'O banco pode ter autorizado um limite diferente. Deseja registrar mesmo assim?',
        expect.any(Array),
        expect.any(Object),
      ),
    );
    expect(useFinancialStore.getState().doc.cardPurchases).toHaveLength(0);
    expect(mockGoBack).not.toHaveBeenCalled();

    choice = 'Registrar mesmo assim';
    fireEvent.press(screen.getByText('Salvar compra no crédito'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(useFinancialStore.getState().doc.cardPurchases[0]).toMatchObject({ totalAmount: 30000 });
    alertSpy.mockRestore();
  });

  it('só oferece cartões ativos', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = saveCreditCard(activeDoc(), { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx);
    doc = saveCreditCard(doc, { name: 'Antigo', closingDay: 10, dueDay: 20, active: false }, ctx);
    await seed(doc);
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    fireEvent.press(screen.getByText('Nubank'));
    expect(screen.queryByText('Antigo')).toBeNull();
  });

  it('no crédito, registra a compra parcelada no cartão e não cria gasto à vista', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(saveCreditCard(activeDoc(), { name: 'Nubank', closingDay: 28, dueDay: 5 }, ctx));
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );

    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    fireEvent.changeText(screen.getByLabelText('Parcelas'), '3');
    fireEvent.changeText(screen.getByLabelText('Valor total (com juros)'), '30000');
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Notebook');
    expect(await screen.findByText(/3x de R\$ 100,00/)).toBeTruthy();
    fireEvent.press(screen.getByText('Salvar compra no crédito'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    const { doc, activeMonth } = useFinancialStore.getState();
    expect(doc.cardPurchases[0]).toMatchObject({
      totalAmount: 30000,
      installments: 3,
      description: 'Notebook',
    });
    expect(activeMonth?.expenses).toHaveLength(0);
  });

  it('no crédito sem cartão oferece cadastrar um', async () => {
    await seed(activeDoc());
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByText('À vista (Pix, dinheiro ou débito)'));
    fireEvent.press(await screen.findByText('Cartão de crédito'));
    fireEvent.press(screen.getByText('Cadastrar cartão'));
    expect(mockNavigate).toHaveBeenCalledWith('MainTabs', { screen: 'Cards' });
  });

  it('edição oferece excluir', async () => {
    let doc = activeDoc();
    const store = useFinancialStore.getState();
    await seed(doc);
    await store.addExpense({
      amount: 100,
      category: 'Outros',
      description: 'Pão',
      date: doc.cycles[0]!.startDate,
    });
    doc = useFinancialStore.getState().doc;
    const id = doc.expenses[0]!.id;
    render(
      <AddExpenseScreen
        navigation={navigation}
        route={{ key: 'k', name: 'AddExpense', params: { expenseId: id } }}
      />,
    );
    expect(await screen.findByText('Excluir gasto')).toBeTruthy();
    expect(screen.getByText('Salvar alterações')).toBeTruthy();
  });
});

describe('Relatórios › Categorias (compras no cartão e fixas pagas)', () => {
  it('período livre: conta a compra no cartão pelo total e a fixa paga no crédito uma vez só', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    const cardId = doc.creditCards[0]!.id;
    doc = addCardPurchase(
      doc,
      {
        cardId,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 3,
        date: doc.cycles[0]!.startDate,
      },
      ctx,
    );
    doc = payFixedExpense(
      doc,
      { fixedExpenseId: 'aluguel', method: 'credit', cardId, installments: 1, interest: 1000 },
      ctx,
    );
    await seed(doc);
    render(<CategoriesReport />);

    fireEvent.press(screen.getByText(/\(atual\)$/));
    fireEvent.press(await screen.findByText('Período livre'));
    expect(await screen.findByText('Cartão: TV (3x) - Lazer')).toBeTruthy();
    // A compra gerada pela fixa não aparece como "Cartão".
    expect(screen.queryByText('Cartão: Aluguel - Moradia')).toBeNull();
    expect(screen.queryByText(/Fixo: Aluguel/)).toBeNull();

    fireEvent.press(screen.getByLabelText('Mostrar itens do tipo Fixo'));
    expect(await screen.findByText('Fixo: Aluguel (no crédito) - Moradia')).toBeTruthy();
    expect(screen.getAllByText('R$ 1.510,00').length).toBeGreaterThan(0);
    // 900,00 (TV) + 1.510,00 (aluguel + juros) = 2.410,00
    expect(screen.getAllByText('R$ 2.410,00').length).toBeGreaterThan(0);
  });
});

describe('Relatórios › Crédito', () => {
  it('lista a fatura com período, vencimento e ciclo em que pesa', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    doc = addCardPurchase(
      doc,
      {
        cardId: doc.creditCards[0]!.id,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 3,
        date: doc.cycles[0]!.startDate,
      },
      ctx,
    );
    await seed(doc);
    render(<CreditReport />);

    expect(screen.getByText('Resumo')).toBeTruthy();
    expect(screen.getAllByText('R$ 900,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Fatura \d{2}\/\d{4} · /)).toHaveLength(3);
    expect(screen.getAllByText('Pesa no ciclo')).toHaveLength(3);
  });

  it('sem cartão mostra o aviso', async () => {
    await seed({ ...createEmptyState() });
    render(<CreditReport />);
    expect(screen.getByText('Nenhum cartão')).toBeTruthy();
  });
});

describe('Relatórios › Categorias (base Ciclo)', () => {
  it('conta a parcela da fatura que vence no ciclo, não o total da compra', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    doc = addCardPurchase(
      doc,
      {
        cardId: doc.creditCards[0]!.id,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 3,
        date: doc.cycles[0]!.startDate,
      },
      ctx,
    );
    await seed(doc);
    render(<CategoriesReport />);

    expect(screen.getByText(/O que pesou no ciclo/)).toBeTruthy();
    expect(screen.queryByText('Cartão: TV (3x) - Lazer')).toBeNull();
  });
});

describe('DailyHistoryScreen (tudo que foi pago no ciclo)', () => {
  it('mostra tudo que foi pago; lápis em gasto e compra, lixeira também em fixa (desfazer)', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    const cardId = doc.creditCards[0]!.id;
    const today = format(ctx.now, 'yyyy-MM-dd');
    doc = addExpense(
      doc,
      { amount: 1500, category: 'Alimentação', description: 'Padaria', date: today },
      ctx,
    );
    doc = addCardPurchase(
      doc,
      {
        cardId,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 1,
        date: today,
      },
      ctx,
    );
    doc = payFixedExpense(doc, { fixedExpenseId: 'aluguel', method: 'pix' }, ctx);
    await seed(doc);
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );

    // BR-FIN-039: a compra no cartão fica no ciclo em que a fatura vence. Conforme a data de hoje,
    // ela vence neste ciclo (entra no total do dia) ou depois ("Nas próximas faturas").
    const tvInCycle =
      selectPaidHistory(doc).find((item) => item.name === 'TV')?.cycleId === doc.cycles[0]!.id;
    // Total do dia = 15,00 + 1.500,00 (+ 900,00 se a fatura vence neste ciclo); nada em dobro.
    expect(screen.getByText(tvInCycle ? 'R$ 2.415,00' : 'R$ 1.515,00')).toBeTruthy();
    if (!tvInCycle) expect(screen.getByText('Nas próximas faturas')).toBeTruthy();
    fireEvent.press(screen.getByLabelText(/Alternar detalhes de/));
    expect(await screen.findByText('Padaria')).toBeTruthy();
    expect(screen.getByText(/Crédito · Cartão · Lazer · fatura \d{2}\/\d{4}, vence/)).toBeTruthy();
    expect(screen.getByText('Saldo · Fixo · Moradia')).toBeTruthy();
    expect(screen.getByLabelText('Editar gasto Padaria')).toBeTruthy();
    expect(screen.getByLabelText('Editar compra TV')).toBeTruthy();
    expect(screen.queryByLabelText(/Editar pagamento Aluguel/)).toBeNull();
    expect(screen.getByLabelText('Desfazer pagamento Aluguel')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Editar gasto Padaria'));
    expect(mockNavigate).toHaveBeenCalledWith('AddExpense', {
      expenseId: expect.any(String),
    });
    fireEvent.press(screen.getByLabelText('Editar compra TV'));
    expect(mockNavigate).toHaveBeenCalledWith('CardDetail', { cardId: expect.any(String) });
  });

  it('compra parcelada mostra a parcela de hoje como 1/3 e o lápis edita a compra inteira', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    const cardId = doc.creditCards[0]!.id;
    doc = addCardPurchase(
      doc,
      {
        cardId,
        description: 'Notebook',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 3,
        date: format(ctx.now, 'yyyy-MM-dd'),
      },
      ctx,
    );
    await seed(doc);
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );

    const firstInCycle =
      selectPaidHistory(doc).find((item) => item.name === 'Notebook (1/3)')?.cycleId ===
      doc.cycles[0]!.id;

    if (firstInCycle) fireEvent.press(screen.getByLabelText(/Alternar detalhes de/));
    expect(await screen.findByText('Notebook (1/3)')).toBeTruthy();
    // Uma linha por parcela, R$ 300,00 cada; as que vencem depois ficam em "Nas próximas faturas".
    expect(screen.getAllByText('R$ 300,00').length).toBeGreaterThan(0);
    expect(screen.getByText('Nas próximas faturas')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Editar compra Notebook (1/3)'));
    expect(mockNavigate).toHaveBeenCalledWith('CardDetail', { cardId });
  });

  it('ícone de filtro abre o gadget; a busca filtra e limpar restaura', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    const cardId = doc.creditCards[0]!.id;
    const today = format(ctx.now, 'yyyy-MM-dd');
    doc = addExpense(
      doc,
      { amount: 1500, category: 'Alimentação', description: 'Padaria', date: today },
      ctx,
    );
    doc = addCardPurchase(
      doc,
      {
        cardId,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 1,
        date: today,
      },
      ctx,
    );
    await seed(doc);
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByLabelText(/Alternar detalhes de/));
    expect(await screen.findByText('TV')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Filtros'));
    fireEvent.changeText(await screen.findByLabelText('Buscar'), 'padar');
    fireEvent.press(screen.getByText('Aplicar filtros'));

    expect(await screen.findByText('Padaria')).toBeTruthy();
    expect(screen.queryByText('TV')).toBeNull();
    expect(screen.getByLabelText('Filtros (ativos)')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Filtros (ativos)'));
    fireEvent.changeText(await screen.findByLabelText('Buscar'), 'zzz');
    fireEvent.press(screen.getByText('Aplicar filtros'));
    expect(await screen.findByText('Nada encontrado')).toBeTruthy();

    fireEvent.press(screen.getByText('Limpar filtros'));
    // O dia continua expandido: o filtro não mexe no estado dos grupos.
    expect(await screen.findByText('TV')).toBeTruthy();
  });

  it('filtro de cartão mostra só as linhas do cartão escolhido', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed(true);
    const cardId = doc.creditCards[0]!.id;
    const today = format(ctx.now, 'yyyy-MM-dd');
    doc = addExpense(
      doc,
      { amount: 1500, category: 'Alimentação', description: 'Padaria', date: today },
      ctx,
    );
    doc = addCardPurchase(
      doc,
      {
        cardId,
        description: 'TV',
        category: 'Lazer',
        totalAmount: 90000,
        installments: 1,
        date: today,
      },
      ctx,
    );
    await seed(doc);
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByLabelText(/Alternar detalhes de/));
    expect(await screen.findByText('Padaria')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Filtros'));
    await screen.findByText('Cartão');
    // O 1º "Todos" é o do campo Cartão (Categoria é "Todas").
    fireEvent.press(screen.getAllByText('Todos')[0]!);
    fireEvent.press(await screen.findByText('Nubank'));
    fireEvent.press(screen.getByText('Aplicar filtros'));

    expect(await screen.findByText('TV')).toBeTruthy();
    expect(screen.queryByText('Padaria')).toBeNull();
    expect(screen.getByLabelText('Filtros (ativos)')).toBeTruthy();
  });

  it('campos de data do filtro aplicam a máscara DD/MM/AAAA enquanto digita', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(
      addExpense(
        docWithFixed(),
        {
          amount: 1500,
          category: 'Alimentação',
          description: 'Padaria',
          date: format(ctx.now, 'yyyy-MM-dd'),
        },
        ctx,
      ),
    );
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Filtros'));
    const from = await screen.findByLabelText('De');

    fireEvent.changeText(from, '05102026');
    expect(screen.getByLabelText('De').props.value).toBe('05/10/2026');
    fireEvent.changeText(screen.getByLabelText('Até'), '3112');
    expect(screen.getByLabelText('Até').props.value).toBe('31/12');
  });

  it('data inválida no filtro mostra erro e não aplica', async () => {
    await seed(docWithFixed());
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    await seed(
      addExpense(
        docWithFixed(),
        {
          amount: 1500,
          category: 'Alimentação',
          description: 'Padaria',
          date: format(ctx.now, 'yyyy-MM-dd'),
        },
        ctx,
      ),
    );
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );

    fireEvent.press(screen.getByLabelText('Filtros'));
    fireEvent.changeText(await screen.findByLabelText('De'), '99/99/9999');
    fireEvent.press(screen.getByText('Aplicar filtros'));

    expect(await screen.findByText('Use o formato DD/MM/AAAA.')).toBeTruthy();
    expect(screen.getByLabelText('Filtros')).toBeTruthy();
  });

  it('lixeira confirma e exclui o gasto; desfazer remove o pagamento da fixa', async () => {
    const ctx = { now: new Date(), newId: (p: string) => `${p}-${Math.random()}` };
    let doc = docWithFixed();
    doc = addExpense(
      doc,
      {
        amount: 1500,
        category: 'Alimentação',
        description: 'Padaria',
        date: format(ctx.now, 'yyyy-MM-dd'),
      },
      ctx,
    );
    doc = payFixedExpense(doc, { fixedExpenseId: 'aluguel', method: 'pix' }, ctx);
    await seed(doc);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    render(
      <DailyHistoryScreen
        navigation={navigation}
        route={{ key: 'k', name: 'DailyHistory', params: undefined }}
      />,
    );
    fireEvent.press(screen.getByLabelText(/Alternar detalhes de/));

    fireEvent.press(await screen.findByLabelText('Excluir gasto Padaria'));
    await waitFor(() => expect(useFinancialStore.getState().activeMonth?.expenses).toHaveLength(0));
    fireEvent.press(await screen.findByLabelText('Desfazer pagamento Aluguel'));
    await waitFor(() =>
      expect(
        useFinancialStore.getState().doc.fixedPayments.filter((p) => p.deletedAt === null),
      ).toHaveLength(0),
    );
    expect(alertSpy).toHaveBeenCalledWith(
      'Desfazer pagamento?',
      expect.stringContaining('Aluguel'),
      expect.any(Array),
    );
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

describe('Relatórios › Ciclos: filtro de mês e ano', () => {
  it('abre no ciclo atual com a fatura que vence nele e as fixas pendentes', async () => {
    const doc = docWithFixed(true);
    const start = doc.cycles[0]!.startDate;
    await seed(
      addCardPurchase(
        doc,
        {
          cardId: doc.creditCards[0]!.id,
          description: 'TV',
          category: 'Lazer',
          totalAmount: 90000,
          installments: 3,
          date: start,
        },
        { now: new Date(), newId: (p) => `${p}-${Math.random()}` },
      ),
    );
    render(<CyclesReport />);
    expect(screen.getByText('Ciclo atual')).toBeTruthy();
    expect(screen.getByText('Fixas pendentes')).toBeTruthy();
    expect(screen.getByText('Aluguel')).toBeTruthy();
    expect(screen.queryByText('Sem dados neste ciclo')).toBeNull();
  });

  it('sem nenhum dado no ciclo exibe "Sem dados neste ciclo"', async () => {
    await seed({ ...createEmptyState() });
    render(<CyclesReport />);
    expect(screen.getByText('Sem dados neste ciclo')).toBeTruthy();
    expect(screen.getByText('Ciclos fechados ficam salvos aqui.')).toBeTruthy();
  });
});

describe('ManageCategoriesScreen (Ajustes › Categorias)', () => {
  it('cria categoria e recusa repetida', async () => {
    await seed(docWithFixed());
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<ManageCategoriesScreen />);

    fireEvent.changeText(screen.getByLabelText('Nome'), 'Viagem');
    fireEvent.press(screen.getAllByText('Criar categoria').at(-1)!);
    expect(await screen.findByText('Viagem')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Nome'), 'Viagem');
    fireEvent.press(screen.getAllByText('Criar categoria').at(-1)!);
    expect(alert).toHaveBeenCalledWith('Categoria existente', expect.any(String));
    alert.mockRestore();
  });
});

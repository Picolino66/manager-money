import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import {
  addCardPurchase,
  addExistingCardDebt,
  saveCreditCard,
} from '../application/card.use-cases';
import { openCycle, saveConfig } from '../application/cycle.use-cases';
import { selectCardLimitUsage, selectCardStatements } from '../application/selectors';
import { createEmptyState, LocalState } from '../application/state';
import { setUseCaseContextFactory, useFinancialStore } from '../store/financial.store';
import { CardDebtScreen } from './CardDebtScreen';
import { CardDetailScreen } from './CardDetailScreen';
import { CardsScreen } from './CardsScreen';

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

const navigation = { navigate: mockNavigate, goBack: mockGoBack } as never;
const config = {
  incomeSources: [{ id: 'renda', name: 'Salário', amount: 310000, payday: 7 }],
  savingGoal: 0,
  customCategories: [],
  fixedExpenses: [],
};
/** Hoje no cenário: ciclo 07/10 a 06/11; cartão fecha dia 5 e vence dia 15. */
const TODAY = '2026-10-10T12:00:00';

function ctxAt(iso: string) {
  return { now: new Date(iso), newId: (prefix: string) => `${prefix}-${Math.random()}` };
}

function cardDoc(creditLimit: number | null = 100000) {
  const ctx = ctxAt(TODAY);
  const doc = openCycle(saveConfig(createEmptyState(), config, ctx), ctx);

  return saveCreditCard(doc, { name: 'Nubank', closingDay: 5, dueDay: 15, creditLimit }, ctx);
}

/** Fatura 10/2026 (fechou 05/10, vence 15/10) com R$ 400,00 cadastrados na situação inicial. */
function docWithClosedStatement() {
  const doc = cardDoc();

  return addExistingCardDebt(
    doc,
    {
      cardId: doc.creditCards[0]!.id,
      description: 'Fatura de outubro',
      category: 'Outros',
      installmentAmount: 40000,
      totalInstallments: 1,
      remainingInstallments: 1,
      nextStatementKey: '2026-10',
    },
    ctxAt(TODAY),
  );
}

function docWithPurchase() {
  const doc = cardDoc();

  return addCardPurchase(
    doc,
    {
      cardId: doc.creditCards[0]!.id,
      description: 'Notebook',
      category: 'Outros',
      totalAmount: 30000,
      installments: 3,
      date: doc.cycles[0]!.startDate,
    },
    ctxAt(TODAY),
  );
}

function seed(doc: LocalState) {
  return useFinancialStore.getState().replaceDocument(() => doc);
}

const cardsRoute = { key: 'k', name: 'Cards', params: undefined } as const;
const detailRoute = (cardId: string) => ({
  key: 'k',
  name: 'CardDetail' as const,
  params: { cardId },
});
const debtRoute = (cardId: string) => ({ key: 'k', name: 'CardDebt' as const, params: { cardId } });
const cardId = () => useFinancialStore.getState().doc.creditCards[0]!.id;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.useFakeTimers({ advanceTimers: true });
  jest.setSystemTime(new Date(TODAY));
  setUseCaseContextFactory(() => ({ now: new Date(), newId: (p) => `${p}-${Math.random()}` }));
  await seed(createEmptyState());
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CardsScreen (SPEC-016/017)', () => {
  it('mostra o limite disponível do cartão depois de uma compra (BR-FIN-026)', async () => {
    await seed(docWithPurchase());
    render(<CardsScreen navigation={navigation} route={cardsRoute} />);

    expect(screen.getByText('Limite disponível do cartão')).toBeTruthy();
    expect(screen.getByText('R$ 700,00')).toBeTruthy();
    expect(screen.getByText('30% do limite comprometido')).toBeTruthy();
    expect(screen.getByText(/não é dinheiro para gastar/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Abrir cartão Nubank'));
    expect(mockNavigate).toHaveBeenCalledWith('CardDetail', { cardId: cardId() });
  });

  it('cadastra o cartão com limite e oferece cadastrar compras anteriores', async () => {
    render(<CardsScreen navigation={navigation} route={cardsRoute} />);
    fireEvent.press(screen.getByText('Adicionar cartão'));
    fireEvent.changeText(screen.getByLabelText('Nome do cartão'), 'Nubank');
    fireEvent.changeText(screen.getByLabelText('Dia de fechamento (1 a 28)'), '5');
    fireEvent.changeText(screen.getByLabelText('Dia de vencimento (1 a 28)'), '15');
    fireEvent.changeText(screen.getByLabelText('Limite total do cartão (opcional)'), '500000');
    fireEvent.press(screen.getByText('Salvar cartão'));

    expect(await screen.findByText('Cartão Nubank cadastrado')).toBeTruthy();
    expect(useFinancialStore.getState().doc.creditCards[0]).toMatchObject({
      name: 'Nubank',
      creditLimit: 500000,
      active: true,
    });
    expect(screen.getByText('R$ 5.000,00')).toBeTruthy();

    fireEvent.press(screen.getByText('Cadastrar compras anteriores'));
    expect(mockNavigate).toHaveBeenCalledWith('CardDebt', { cardId: cardId() });
  });

  it('cartão sem limite mostra "Limite não informado"', async () => {
    await seed(cardDoc(null));
    render(<CardsScreen navigation={navigation} route={cardsRoute} />);
    expect(screen.getByText('Limite não informado')).toBeTruthy();
  });

  it('cartão com compras não pode ser excluído: desativa e mostra "Inativo" (BR-FIN-028)', async () => {
    const doc = saveCreditCard(
      docWithPurchase(),
      { name: 'Inter', closingDay: 10, dueDay: 20 },
      ctxAt(TODAY),
    );
    await seed(doc);
    render(<CardsScreen navigation={navigation} route={cardsRoute} />);

    expect(screen.queryByLabelText('Excluir cartão Nubank')).toBeNull();
    expect(screen.getByLabelText('Excluir cartão Inter')).toBeTruthy();
    expect(screen.getByText(/Cartão com compras não pode ser excluído/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Desativar cartão Nubank'));
    await waitFor(() =>
      expect(useFinancialStore.getState().doc.creditCards[0]?.active).toBe(false),
    );
    expect(await screen.findByText('Inativo')).toBeTruthy();
    expect(screen.getByLabelText('Ativar cartão Nubank')).toBeTruthy();
  });
});

describe('CardDetailScreen (SPEC-016)', () => {
  it('"Paguei a fatura" em fatura fechada confirma, paga o valor e libera o limite', async () => {
    await seed(docWithClosedStatement());
    render(<CardDetailScreen navigation={navigation} route={detailRoute(cardId())} />);

    expect(screen.getByText('Fechada')).toBeTruthy();
    expect(screen.getByText('R$ 600,00')).toBeTruthy();
    expect(screen.getByText('pesa no ciclo de 10/2026')).toBeTruthy();

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Paguei')?.onPress?.();
    });
    fireEvent.press(screen.getByLabelText('Paguei a fatura 10/2026'));

    await waitFor(() => expect(useFinancialStore.getState().doc.statementPayments).toHaveLength(1));
    expect(useFinancialStore.getState().doc.statementPayments[0]).toMatchObject({
      statementKey: '2026-10',
      statementAmount: 40000,
      paidAmount: 40000,
    });
    expect(selectCardLimitUsage(useFinancialStore.getState().doc, cardId())?.available).toBe(
      100000,
    );
    expect(await screen.findByText(/Paga em 10\/10/)).toBeTruthy();
    // Limite total e limite disponível do cartão voltam a ser iguais.
    expect(screen.getAllByText('R$ 1.000,00')).toHaveLength(2);

    fireEvent.press(screen.getByLabelText('Desfazer pagamento da fatura 10/2026'));
    await waitFor(() =>
      expect(useFinancialStore.getState().doc.statementPayments[0]?.deletedAt).not.toBeNull(),
    );
    alertSpy.mockRestore();
  });

  it('fatura vencida pede o valor pago e registra os juros no ciclo atual', async () => {
    await seed(docWithClosedStatement());
    jest.setSystemTime(new Date('2026-10-20T12:00:00'));
    const before = useFinancialStore.getState().activeMonth!.initialAvailableAmount;
    render(<CardDetailScreen navigation={navigation} route={detailRoute(cardId())} />);

    expect(screen.getByText('Vencida')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Paguei a fatura 10/2026'));
    expect(await screen.findByText(/A diferença para o valor da fatura são juros/)).toBeTruthy();

    const input = screen.getByLabelText('Valor pago (com juros)');
    expect(input.props.value).toMatch(/400,00/);
    fireEvent.changeText(input, '30000');
    fireEvent.press(screen.getByText('Confirmar pagamento'));
    expect(
      await screen.findByText('O valor pago não pode ser menor que o valor da fatura.'),
    ).toBeTruthy();

    fireEvent.changeText(input, '42500');
    expect(screen.getByText('Juros: R$ 25,00')).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmar pagamento'));

    await waitFor(() => expect(useFinancialStore.getState().doc.statementPayments).toHaveLength(1));
    expect(useFinancialStore.getState().doc.statementPayments[0]).toMatchObject({
      statementAmount: 40000,
      paidAmount: 42500,
    });
    expect(useFinancialStore.getState().activeMonth!.initialAvailableAmount).toBe(before - 2500);
    expect(await screen.findByText(/Juros de R\$ 25,00/)).toBeTruthy();
  });

  it('sem ciclo ativo explica que é preciso iniciar o ciclo para pagar', async () => {
    const doc = docWithClosedStatement();
    await seed({
      ...doc,
      cycles: doc.cycles.map((cycle) => ({ ...cycle, status: 'closed' as const })),
    });
    render(<CardDetailScreen navigation={navigation} route={detailRoute(cardId())} />);

    expect(screen.queryByLabelText('Paguei a fatura 10/2026')).toBeNull();
    expect(screen.getByText(/é preciso iniciar o ciclo/)).toBeTruthy();
  });

  it('edita a descrição de uma compra feita no app', async () => {
    await seed(docWithPurchase());
    render(<CardDetailScreen navigation={navigation} route={detailRoute(cardId())} />);

    expect(screen.getByText(/Parcela 1\/3/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Editar compra Notebook'));
    fireEvent.changeText(await screen.findByLabelText('Descrição'), 'Notebook novo');
    fireEvent.press(screen.getByText('Salvar compra'));

    await waitFor(() =>
      expect(useFinancialStore.getState().doc.cardPurchases[0]?.description).toBe('Notebook novo'),
    );
  });
});

describe('CardDebtScreen (SPEC-017 / BR-FIN-027)', () => {
  it('parcelamento em andamento gera as parcelas futuras e mostra a prévia', async () => {
    await seed(cardDoc());
    render(<CardDebtScreen navigation={navigation} route={debtRoute(cardId())} />);

    fireEvent.press(screen.getByLabelText('Parcelamento em andamento'));
    fireEvent.changeText(screen.getByLabelText('Descrição'), 'Celular');
    fireEvent.changeText(screen.getByLabelText('Valor da parcela'), '30000');
    fireEvent.changeText(screen.getByLabelText('Total de parcelas'), '10');
    fireEvent.changeText(
      screen.getByLabelText('Parcelas restantes (incluindo a da fatura escolhida)'),
      '6',
    );
    expect(screen.getByText('6 parcelas de R$ 300,00 de 10/2026 a 03/2027')).toBeTruthy();
    expect(screen.getByText(/4 parcela\(s\) já paga\(s\)/)).toBeTruthy();

    fireEvent.press(screen.getByText('Salvar'));

    expect(await screen.findByText(/Celular cadastrado/)).toBeTruthy();
    const { doc } = useFinancialStore.getState();
    expect(doc.cardPurchases[0]).toMatchObject({
      description: 'Celular',
      totalAmount: 300000,
      installments: 10,
      settledInstallments: 4,
    });
    const statements = selectCardStatements(doc, cardId(), new Date());
    expect(statements.map((statement) => statement.key)).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
      '2027-03',
    ]);
    expect(selectCardLimitUsage(doc, cardId())?.committed).toBe(180000);
  });

  it('fatura em aberto cadastra 1 de 1 na fatura escolhida', async () => {
    await seed(cardDoc());
    render(<CardDebtScreen navigation={navigation} route={debtRoute(cardId())} />);

    fireEvent.changeText(screen.getByLabelText('Valor da fatura'), '45000');
    expect(screen.getByText('1 parcela de R$ 450,00 na fatura de 10/2026')).toBeTruthy();
    fireEvent.press(screen.getByText('Salvar'));

    await waitFor(() => expect(useFinancialStore.getState().doc.cardPurchases).toHaveLength(1));
    expect(useFinancialStore.getState().doc.cardPurchases[0]).toMatchObject({
      description: 'Fatura 10/2026',
      totalAmount: 45000,
      installments: 1,
      settledInstallments: 0,
      firstStatementKey: '2026-10',
    });
  });

  it('valida os campos do parcelamento', async () => {
    await seed(cardDoc());
    render(<CardDebtScreen navigation={navigation} route={debtRoute(cardId())} />);

    fireEvent.press(screen.getByLabelText('Parcelamento em andamento'));
    fireEvent.changeText(screen.getByLabelText('Total de parcelas'), '3');
    fireEvent.changeText(
      screen.getByLabelText('Parcelas restantes (incluindo a da fatura escolhida)'),
      '5',
    );
    fireEvent.press(screen.getByText('Salvar'));

    expect(await screen.findByText('Informe uma descrição.')).toBeTruthy();
    expect(screen.getByText('Informe um valor maior que zero.')).toBeTruthy();
    expect(screen.getByText('As parcelas restantes devem ficar entre 1 e o total.')).toBeTruthy();
    expect(useFinancialStore.getState().doc.cardPurchases).toHaveLength(0);
  });
});

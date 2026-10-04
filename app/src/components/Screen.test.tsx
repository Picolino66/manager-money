import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, ScrollView, Text } from 'react-native';

import { useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';
import { Screen } from './Screen';

jest.mock('../infrastructure/supabase/client', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

const originalSyncNow = useFinancialStore.getState().syncNow;

function setup(
  status: 'signed-in' | 'signed-out',
  syncNow = jest.fn().mockResolvedValue({ ok: true }),
) {
  useSessionStore.setState({ status });
  useFinancialStore.setState({ syncNow });

  return syncNow;
}

const scrollView = () => screen.UNSAFE_getByType(ScrollView);
/** Dispara o gesto de puxar: chama o `onRefresh` do RefreshControl da lista. */
const pull = () => act(() => scrollView().props.refreshControl.props.onRefresh());

afterEach(() => {
  useFinancialStore.setState({ syncNow: originalSyncNow });
  useSessionStore.setState({ status: 'disabled' });
  jest.restoreAllMocks();
});

describe('Screen: puxar para atualizar', () => {
  it('com a conta conectada, o gesto sincroniza e mostra o indicador até terminar', async () => {
    let finish: (outcome: { ok: true }) => void = () => undefined;
    const syncNow = setup(
      'signed-in',
      jest.fn(() => new Promise((resolve) => (finish = resolve))),
    );
    render(
      <Screen refreshable>
        <Text>conteúdo</Text>
      </Screen>,
    );

    expect(scrollView().props.refreshControl.props.refreshing).toBe(false);
    await pull();

    expect(syncNow).toHaveBeenCalledTimes(1);
    expect(scrollView().props.refreshControl.props.refreshing).toBe(true);
    await act(async () => finish({ ok: true }));
    await waitFor(() => expect(scrollView().props.refreshControl.props.refreshing).toBe(false));
  });

  it('falha de rede avisa o usuário; busy não avisa', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const syncNow = setup('signed-in', jest.fn().mockResolvedValue({ ok: false, code: 'network' }));
    render(
      <Screen refreshable>
        <Text>conteúdo</Text>
      </Screen>,
    );

    await pull();
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Sem conexão', expect.any(String)));

    alert.mockClear();
    syncNow.mockResolvedValue({ ok: false, code: 'busy' });
    await pull();
    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));
    expect(alert).not.toHaveBeenCalled();
  });

  it('erro inesperado não quebra a tela', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    setup('signed-in', jest.fn().mockRejectedValue(new Error('x')));
    render(
      <Screen refreshable>
        <Text>conteúdo</Text>
      </Screen>,
    );

    await pull();
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Não foi possível atualizar', expect.any(String)),
    );
  });

  it('modo local (sem conta) ou sem a opção refreshable: o gesto não é ligado', () => {
    setup('signed-out');
    const { rerender } = render(
      <Screen refreshable>
        <Text>conteúdo</Text>
      </Screen>,
    );

    expect(scrollView().props.refreshControl).toBeUndefined();

    act(() => {
      setup('signed-in');
    });
    rerender(
      <Screen>
        <Text>conteúdo</Text>
      </Screen>,
    );
    expect(scrollView().props.refreshControl).toBeUndefined();
  });
});

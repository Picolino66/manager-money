import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { describeRefreshFailure } from '../screens/syncStatus';
import { useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';

/**
 * Puxar para atualizar: envia o que está pendente e busca do banco o que mudou (`syncNow`). Só existe
 * com a conta conectada; no modo local devolve `null` e o gesto nem é ligado.
 */
export function useSyncRefresh(): { refreshing: boolean; onRefresh: () => void } | null {
  const signedIn = useSessionStore((state) => state.status === 'signed-in');
  const syncNow = useFinancialStore((state) => state.syncNow);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    syncNow()
      .then((outcome) => {
        const failure = outcome.ok ? null : describeRefreshFailure(outcome.code);

        if (failure) Alert.alert(failure.title, failure.message);
      })
      .catch(() => Alert.alert('Não foi possível atualizar', 'Tente novamente.'))
      .finally(() => setRefreshing(false));
  }, [syncNow]);

  return signedIn ? { refreshing, onRefresh } : null;
}

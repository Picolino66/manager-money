import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppButton } from './src/components/AppButton';
import { EmptyState } from './src/components/EmptyState';
import { Screen } from './src/components/Screen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { useTheme } from './src/design/useTheme';
import { logger } from './src/infrastructure/monitoring/logger';
import { useFinancialStore } from './src/store/financial.store';
import { useSessionStore } from './src/store/session.store';
import { useThemeStore } from './src/store/theme.store';

/** DEF-004: falha de leitura nunca aparece como app vazio nem sobrescreve os dados. */
function LoadErrorScreen({ message }: { message: string }) {
  const loadAppData = useFinancialStore((state) => state.loadAppData);
  const exportRawData = useFinancialStore((state) => state.exportRawData);

  return (
    <Screen>
      <EmptyState
        actionLabel="Tentar novamente"
        iconName="warning-outline"
        message={`${message} Nada foi apagado.`}
        onActionPress={() => void loadAppData()}
        title="Erro ao carregar"
      />
      <AppButton
        iconName="download-outline"
        onPress={() =>
          void exportRawData().catch(() =>
            Alert.alert('Não foi possível exportar', 'Tente novamente.'),
          )
        }
        title="Exportar dados brutos"
        variant="secondary"
      />
    </Screen>
  );
}

export default function App() {
  const loadAppData = useFinancialStore((state) => state.loadAppData);
  const isLoading = useFinancialStore((state) => state.isLoading);
  const loadError = useFinancialStore((state) => state.loadError);
  const initSession = useSessionStore((state) => state.init);
  const loadThemePreference = useThemeStore((state) => state.loadPreference);
  const { colors, scheme } = useTheme();

  useEffect(() => {
    void loadThemePreference();
    void loadAppData().then(() => initSession().catch((error) => logger.error(error)));
  }, [loadAppData, initSession, loadThemePreference]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {isLoading ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.background,
            }}
          >
            <ActivityIndicator
              accessibilityLabel="Carregando"
              color={colors.primary}
              size="large"
            />
          </View>
        ) : loadError ? (
          <LoadErrorScreen message={loadError} />
        ) : (
          <AppNavigator />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

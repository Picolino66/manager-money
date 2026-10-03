import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Application from 'expo-application';
import { ComponentProps } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { colors, spacing, typography } from '../design/theme';
import { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';
import { describeSyncStatus } from './syncStatus';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Settings'>,
  NativeStackScreenProps<RootStackParamList>
>;

type RowProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  subtitle?: string;
  onPress: () => void;
};

function SettingsRow({ icon, title, subtitle, onPress }: RowProps) {
  return (
    <Pressable
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Ionicons color={colors.primary} name={icon} size={22} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

export function SettingsScreen({ navigation }: Props) {
  const sessionStatus = useSessionStore((state) => state.status);
  const email = useSessionStore((state) => state.email);
  const isSyncing = useFinancialStore((state) => state.isSyncing);
  const pendingChanges = useFinancialStore((state) => state.pendingChanges);
  const sync = useFinancialStore((state) => state.doc.sync);
  const exportData = useFinancialStore((state) => state.exportData);
  const syncStatus = describeSyncStatus({
    sessionStatus,
    isSyncing,
    pendingChanges,
    lastSyncAt: sync.lastSyncAt,
    lastError: sync.lastError,
  });

  function handleExport() {
    exportData().catch((error: unknown) => {
      Alert.alert(
        'Não foi possível exportar',
        error instanceof Error ? error.message : 'Tente novamente.',
      );
    });
  }

  return (
    <Screen>
      <Text style={styles.title}>Ajustes</Text>
      <Card>
        <SettingsRow
          icon="wallet-outline"
          onPress={() => navigation.navigate('Config')}
          subtitle="Renda, meta, dia do pagamento e despesas fixas"
          title="Configuração financeira"
        />
        <SettingsRow
          icon="card-outline"
          onPress={() => navigation.navigate('Cards')}
          subtitle="Fechamento, vencimento e faturas"
          title="Cartões de crédito"
        />
        <SettingsRow
          icon="cloud-outline"
          onPress={() => navigation.navigate('Account')}
          subtitle={email ? `${email} · ${syncStatus}` : syncStatus}
          title="Conta e sincronização"
        />
        <SettingsRow
          icon="download-outline"
          onPress={handleExport}
          subtitle="Arquivo JSON com todos os seus dados"
          title="Exportar dados"
        />
        <SettingsRow
          icon="shield-checkmark-outline"
          onPress={() => navigation.navigate('PrivacyPolicy')}
          title="Política de privacidade"
        />
      </Card>
      <Text style={styles.version}>
        Versão {Application.nativeApplicationVersion ?? '1.0.0'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
  },
  rowPressed: {
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: 13,
  },
  version: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
});

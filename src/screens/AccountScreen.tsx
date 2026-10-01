import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { z } from 'zod';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { colors, typography } from '../design/theme';
import { useFinancialStore } from '../store/financial.store';
import { useSessionStore } from '../store/session.store';
import { describeSyncStatus } from './syncStatus';

const RESEND_SECONDS = 60;
const emailSchema = z.email();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Tente novamente.';
}

export function AccountScreen() {
  const session = useSessionStore();
  const isSyncing = useFinancialStore((state) => state.isSyncing);
  const pendingChanges = useFinancialStore((state) => state.pendingChanges);
  const sync = useFinancialStore((state) => state.doc.sync);
  const syncNow = useFinancialStore((state) => state.syncNow);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function guarded(action: () => Promise<void>, title: string) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert(title, errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function handleSendCode() {
    if (!emailSchema.safeParse(email.trim()).success) {
      Alert.alert('E-mail inválido', 'Confira o endereço digitado.');
      return;
    }

    void guarded(async () => {
      await session.sendCode(email);
      setCodeSent(true);
      setResendIn(RESEND_SECONDS);
    }, 'Não foi possível enviar o código');
  }

  function handleVerify() {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Código inválido', 'Digite os 6 dígitos recebidos por e-mail.');
      return;
    }

    void guarded(() => session.verifyCode(email, code), 'Não foi possível entrar');
  }

  function handleFirstLogin(choice: 'keep-local' | 'use-remote') {
    void guarded(() => session.resolveFirstLogin(choice), 'Não foi possível vincular os dados');
  }

  function handleSignOut() {
    Alert.alert('Sair da conta', 'O que fazer com os dados deste aparelho?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Manter dados',
        onPress: () => void guarded(() => session.signOut(false), 'Não foi possível sair'),
      },
      {
        text: 'Apagar dados',
        style: 'destructive',
        onPress: () => void guarded(() => session.signOut(true), 'Não foi possível sair'),
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      'Excluir conta?',
      'Sua conta e todos os dados na nuvem serão apagados definitivamente. Os dados deste aparelho continuam disponíveis no modo local.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Confirmar exclusão', 'Esta ação não pode ser desfeita.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Excluir conta',
                style: 'destructive',
                onPress: () =>
                  void guarded(() => session.deleteAccount(), 'Não foi possível excluir a conta'),
              },
            ]),
        },
      ],
    );
  }

  if (session.status === 'disabled') {
    return (
      <Screen>
        <EmptyState
          iconName="cloud-offline-outline"
          message="Sincronização indisponível nesta versão. Seus dados ficam salvos neste aparelho; use Exportar dados para fazer backup."
          title="Modo local"
        />
      </Screen>
    );
  }

  if (session.status === 'signed-in' && session.awaitingFirstLoginChoice) {
    return (
      <Screen>
        <Text style={styles.title}>Escolha seus dados</Text>
        <Card>
          <Text style={styles.body}>
            Encontramos dados neste aparelho e também na sua conta. Qual versão você quer manter?
          </Text>
          <AppButton
            iconName="cloud-download-outline"
            isLoading={busy}
            onPress={() => handleFirstLogin('use-remote')}
            title="Usar dados da nuvem"
          />
          <Text style={styles.hint}>Os dados deste aparelho serão substituídos.</Text>
          <AppButton
            iconName="phone-portrait-outline"
            isLoading={busy}
            onPress={() => handleFirstLogin('keep-local')}
            title="Manter dados deste aparelho"
            variant="secondary"
          />
          <Text style={styles.hint}>Os dados da nuvem serão substituídos.</Text>
        </Card>
      </Screen>
    );
  }

  if (session.status === 'signed-in') {
    const status = describeSyncStatus({
      sessionStatus: session.status,
      isSyncing,
      pendingChanges,
      lastSyncAt: sync.lastSyncAt,
      lastError: sync.lastError,
    });

    return (
      <Screen>
        <Text style={styles.title}>Conta e sincronização</Text>
        <Card>
          <Text style={styles.email}>{session.email}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {status}
          </Text>
          <AppButton
            iconName="sync-outline"
            isLoading={isSyncing}
            onPress={() => void syncNow()}
            title="Sincronizar agora"
            variant="secondary"
          />
          <AppButton
            iconName="log-out-outline"
            isLoading={busy}
            onPress={handleSignOut}
            title="Sair da conta"
            variant="ghost"
          />
        </Card>
        <AppButton
          iconName="trash-outline"
          isLoading={busy}
          onPress={handleDeleteAccount}
          title="Excluir conta"
          variant="danger"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Conta e sincronização</Text>
      <Card>
        <Text style={styles.body}>
          Entre com seu e-mail para sincronizar entre aparelhos e não perder seus dados. Enviaremos
          um código de 6 dígitos — sem senha.
        </Text>
        <TextInputField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="E-mail"
          onChangeText={setEmail}
          placeholder="voce@email.com"
          value={email}
        />
        <AppButton
          disabled={resendIn > 0}
          iconName="mail-outline"
          isLoading={busy && !codeSent}
          onPress={handleSendCode}
          title={resendIn > 0 ? `Reenviar em ${resendIn}s` : codeSent ? 'Reenviar código' : 'Enviar código'}
          variant={codeSent ? 'secondary' : 'primary'}
        />
      </Card>
      {codeSent ? (
        <Card>
          <TextInputField
            autoComplete="one-time-code"
            keyboardType="number-pad"
            label="Código"
            maxLength={6}
            onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
            placeholder="000000"
            value={code}
          />
          <AppButton iconName="log-in-outline" isLoading={busy} onPress={handleVerify} title="Entrar" />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.ink,
    fontSize: typography.title,
    fontWeight: '900',
  },
  email: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
  },
});

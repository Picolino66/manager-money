import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { z } from 'zod';

import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { TextInputField } from '../components/TextInputField';
import { typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { useFinancialStore } from '../store/financial.store';
import { MIN_PASSWORD_LENGTH, useSessionStore } from '../store/session.store';
import { describeSyncStatus } from './syncStatus';

const emailSchema = z.email();

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Tente novamente.';
}

export function AccountScreen() {
  const styles = useStyles();
  const session = useSessionStore();
  const isSyncing = useFinancialStore((state) => state.isSyncing);
  const pendingChanges = useFinancialStore((state) => state.pendingChanges);
  const sync = useFinancialStore((state) => state.doc.sync);
  const syncNow = useFinancialStore((state) => state.syncNow);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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

  /** Valida no app antes de chamar o servidor (SPEC-005). */
  function validCredentials() {
    if (!emailSchema.safeParse(email.trim()).success) {
      Alert.alert('E-mail inválido', 'Confira o endereço digitado.');
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Senha curta', `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return false;
    }

    return true;
  }

  function handleSignIn() {
    if (!validCredentials()) return;
    void guarded(() => session.signIn(email, password), 'Não foi possível entrar');
  }

  function handleSignUp() {
    if (!validCredentials()) return;
    void guarded(() => session.signUp(email, password), 'Não foi possível criar a conta');
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
          Entre ou crie uma conta para sincronizar entre aparelhos e não perder seus dados. O app
          continua funcionando sem conta.
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
        <TextInputField
          autoCapitalize="none"
          autoComplete="password"
          label="Senha"
          onChangeText={setPassword}
          placeholder={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres`}
          secureTextEntry
          value={password}
        />
        <AppButton iconName="log-in-outline" isLoading={busy} onPress={handleSignIn} title="Entrar" />
        <AppButton
          iconName="person-add-outline"
          isLoading={busy}
          onPress={handleSignUp}
          title="Criar conta"
          variant="secondary"
        />
        <Text style={styles.hint}>
          Guarde sua senha: a recuperação por e-mail ainda não está disponível. Seus dados continuam
          neste aparelho e podem ser exportados em Ajustes.
        </Text>
      </Card>
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
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
}));

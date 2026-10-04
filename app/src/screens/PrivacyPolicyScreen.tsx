import { Text } from 'react-native';

import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { typography } from '../design/theme';
import { makeStyles } from '../design/useTheme';
import { PRIVACY_POLICY_SECTIONS, PRIVACY_POLICY_UPDATED_AT } from '../legal/privacy-policy';

export function PrivacyPolicyScreen() {
  const styles = useStyles();
  return (
    <Screen>
      <Text style={styles.updated}>Última atualização: {PRIVACY_POLICY_UPDATED_AT}</Text>
      {PRIVACY_POLICY_SECTIONS.map((section) => (
        <Card key={section.title}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {section.title}
          </Text>
          <Text style={styles.body}>{section.body}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  updated: {
    color: colors.muted,
    fontSize: 13,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: typography.sectionTitle,
    fontWeight: '900',
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
}));

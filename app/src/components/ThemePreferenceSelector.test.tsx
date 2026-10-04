import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { darkColors, lightColors } from '../design/theme';
import { makeStyles, useTheme } from '../design/useTheme';
import { useThemeStore } from '../store/theme.store';
import { ThemePreferenceSelector } from './ThemePreferenceSelector';

const useProbeStyles = makeStyles((colors) => ({ text: { color: colors.ink } }));

function Probe() {
  const { scheme } = useTheme();
  const styles = useProbeStyles();
  return <Text style={styles.text}>{scheme}</Text>;
}

beforeEach(() => {
  useThemeStore.setState({ preference: 'system' });
});

describe('ThemePreferenceSelector (ADR-021)', () => {
  it('marca a opção atual e troca o tema da interface na hora', () => {
    render(
      <>
        <ThemePreferenceSelector />
        <Probe />
      </>,
    );

    expect(screen.getByLabelText('Tema Sistema').props.accessibilityState).toEqual({
      checked: true,
    });
    expect(screen.getByText('light').props.style).toEqual({ color: lightColors.ink });

    fireEvent.press(screen.getByLabelText('Tema Escuro'));

    expect(useThemeStore.getState().preference).toBe('dark');
    expect(screen.getByText('dark').props.style).toEqual({ color: darkColors.ink });
    expect(screen.getByLabelText('Tema Escuro').props.accessibilityState).toEqual({
      checked: true,
    });

    act(() => useThemeStore.setState({ preference: 'light' }));
    expect(screen.getByText('light')).toBeTruthy();
  });

  it('reaproveita o mesmo objeto de estilos para a mesma paleta', () => {
    const { rerender } = render(<Probe />);
    const first = screen.getByText('light').props.style;
    rerender(<Probe />);
    expect(screen.getByText('light').props.style).toBe(first);
  });
});

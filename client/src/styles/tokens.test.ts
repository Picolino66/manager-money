import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Paridade de tema com o app (ADR-021): mesmos nomes e valores de token nos dois clientes.
import { darkColors, lightColors } from '../../../app/src/design/theme';

const css = readFileSync(resolve(process.cwd(), 'src/styles/index.css'), 'utf8');
const kebab = (key: string) => key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  return css.slice(start, css.indexOf('}', start));
}

describe('tokens do tema', () => {
  it.each([
    [':root', lightColors],
    [":root[data-theme='dark']", darkColors],
  ])('%s tem as mesmas cores do app', (selector, palette) => {
    const section = block(selector);
    for (const [key, value] of Object.entries(palette)) {
      expect(section).toContain(`--${kebab(key)}: ${value};`);
    }
  });
});

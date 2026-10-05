import { expect, test } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('público', () => {
  test('sem sessão, qualquer rota leva ao login; cabeçalhos de segurança presentes', async ({
    page,
  }) => {
    const violations: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
        violations.push(message.text());
      }
    });

    const response = await page.goto('/historico');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Manager Money' })).toBeVisible();

    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(response?.headers()['x-content-type-options']).toBe('nosniff');
    expect(violations).toEqual([]);
  });

  test('formulário de login valida antes de chamar o servidor (teclado)', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill('invalido');
    await page.getByLabel('Senha').fill('123');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
    await expect(page.getByText(/pelo menos 8 caracteres/)).toBeVisible();
  });

  test('política de privacidade é pública', async ({ page }) => {
    await page.goto('/privacidade');
    await expect(page.getByRole('heading', { name: 'Política de privacidade' })).toBeVisible();
  });

  test('nada financeiro no navegador antes do login', async ({ page }) => {
    await page.goto('/login');
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys.filter((key) => !key.startsWith('manager-money'))).toEqual([]);
  });
});

test.describe('autenticado (usuário de teste)', () => {
  test.skip(
    !email || !password,
    'Defina E2E_EMAIL e E2E_PASSWORD de um usuário de teste dedicado.',
  );

  test('entrar, registrar/editar/excluir gasto, ciclos, análise e sair', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-mail').fill(email!);
    await page.getByLabel('Senha').fill(password!);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: /Visão geral|Vamos começar/ })).toBeVisible();
    test.skip(
      await page.getByRole('heading', { name: 'Vamos começar' }).isVisible(),
      'Usuário de teste sem configuração: conclua o onboarding uma vez.',
    );

    // Nada financeiro persiste no navegador: só a sessão do supabase-js e o tema.
    const keys = await page.evaluate(() => Object.keys(window.localStorage));
    expect(keys.every((key) => key.startsWith('manager-money'))).toBe(true);

    await page.getByRole('link', { name: 'Histórico' }).click();
    const marker = `E2E ${Date.now()}`;
    const register = page.getByRole('button', { name: 'Registrar gasto' }).first();
    if (await register.isVisible()) {
      await register.click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Valor').fill('123');
      await dialog.getByLabel('Descrição (opcional)').fill(marker);
      await dialog.getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText(marker)).toBeVisible();

      await page.getByRole('button', { name: `Editar gasto ${marker}` }).click();
      await page.getByRole('dialog').getByLabel('Descrição (opcional)').fill(`${marker} editado`);
      await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click();
      await expect(page.getByText(`${marker} editado`)).toBeVisible();

      await page.getByRole('button', { name: `Excluir gasto ${marker} editado` }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Excluir' }).click();
      await expect(page.getByText(`${marker} editado`)).toHaveCount(0);
    }

    await page.getByRole('link', { name: 'Ciclos' }).click();
    await expect(page.getByRole('heading', { name: 'Ciclos' })).toBeVisible();
    await page.getByRole('link', { name: 'Análise' }).click();
    await expect(page.getByRole('heading', { name: 'Análise' })).toBeVisible();

    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});

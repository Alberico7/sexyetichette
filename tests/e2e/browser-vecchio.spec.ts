/**
 * Browser troppo vecchio: un messaggio al posto della pagina bianca.
 * Si simula con un CSS.supports finto che non conosce light-dark() e un userAgent di Chromium 83.
 * Vedi docs/2026-11-27-browser-troppo-vecchio.md.
 */
import { test as plain, type Page } from '@playwright/test';
import { test, expect, noHorizontalScroll } from './helpers';

const OLD_UA =
  'Mozilla/5.0 (Linux; Android 4.4.2; Tablet) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.119 Safari/537.36';

/** Il browser «non conosce» light-dark(). */
async function withoutLightDark(page: Page) {
  await page.addInitScript(() => {
    const real = CSS.supports.bind(CSS);
    CSS.supports = (...args: [string, string?]) =>
      args.join(' ').includes('light-dark(') ? false : real(...(args as [string, string]));
  });
}

test.describe('Chromium 83', () => {
  test.use({ userAgent: OLD_UA });

  test('compare il messaggio con la versione, e l’app non parte', async ({ page }) => {
    await withoutLightDark(page);
    await page.goto('/');
    const box = page.getByTestId('browser-vecchio');
    await expect(box).toBeVisible();
    await expect(box.getByRole('heading')).toHaveText('Questo browser è troppo vecchio per Rubeculabel');
    await expect(box).toContainText('Chromium 123 o più recente');
    await expect(page.getByTestId('browser-versione')).toHaveText('Questo browser: Chromium 83.');
    await expect(page.locator('html')).toHaveAttribute('data-browser-vecchio', '');
    // L'app non si è montata sopra il messaggio.
    await expect(page.getByTestId('add-text')).toHaveCount(0);
    await expect(page.getByTestId('status-logo')).toHaveCount(0);
    await expect(box).toBeVisible();
    await noHorizontalScroll(page);
  });
});

// Senza il controllo automatico della console: qui l'errore di sintassi è voluto.
plain.describe('Chromium 83, script dell’app scartato', () => {
  plain.use({ userAgent: OLD_UA });

  plain('anche se lo script dell’app non si legge, il messaggio resta', async ({ page }) => {
    await withoutLightDark(page);
    // Come su Chromium 83 con `??=`: lo script principale ha un errore di sintassi e viene scartato.
    await page.route('**/src/main.ts', (route) =>
      route.fulfill({ contentType: 'text/javascript', body: 'let a; a ??= ;' }),
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page.getByTestId('browser-vecchio')).toBeVisible();
    await expect.poll(() => errors.length, 'lo script finto dà davvero errore').toBeGreaterThan(0);
    await expect(page.getByTestId('browser-versione')).toHaveText('Questo browser: Chromium 83.');
  });
});

test('su un browser recente il messaggio non c’è e l’app parte', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status-logo')).toBeVisible();
  await expect(page.getByTestId('browser-vecchio')).toHaveCount(0);
  await expect(page.locator('html')).not.toHaveAttribute('data-browser-vecchio');
});

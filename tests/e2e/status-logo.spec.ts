/**
 * Logo del pettirosso come indicatore di stato nella barra in alto.
 * Vedi docs/2026-11-08-logo-stato.md.
 */
import type { Page } from '@playwright/test';
import { test, expect, noHorizontalScroll, connectSimulated, writeText } from './helpers';

const logo = (page: Page) => page.getByTestId('status-logo');

test('non collegata: pettirosso grigio, senza anello né segno', async ({ page }) => {
  await page.goto('/?sim');
  await expect(logo(page)).toHaveAttribute('data-tone', 'off');
  await expect(logo(page).locator('.ring')).toHaveCount(0);
  await expect(page.getByTestId('status-mark')).toHaveCount(0);
  const filter = await logo(page)
    .locator('.img')
    .evaluate((el) => getComputedStyle(el).filter);
  expect(filter).toContain('grayscale');
  // Il disegno del pettirosso si carica.
  const bg = await logo(page)
    .locator('.img')
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  const url = /url\("(.+)"\)/.exec(bg)![1]!;
  expect((await page.request.get(url)).status()).toBe(200);
  await noHorizontalScroll(page);
});

test('pronta: anello verde con ✓; coperchio aperto: rosso con ✕', async ({ page }) => {
  await connectSimulated(page);
  await expect(logo(page)).toHaveAttribute('data-tone', 'ok');
  await expect(page.getByTestId('status-mark')).toHaveText('✓');
  await expect(logo(page).locator('.img')).toHaveCSS('filter', 'none');
  await page.locator('header').screenshot({ path: 'test-results/29-logo-pronta.png' });

  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Guasto').selectOption('cover-open');
  await expect(logo(page)).toHaveAttribute('data-tone', 'error');
  await expect(page.getByTestId('status-mark')).toHaveText('✕');
  await page.locator('header').screenshot({ path: 'test-results/30-logo-errore.png' });
});

test('stampa in corso: anello azzurro che gira, fermo con «riduci animazioni»', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Gira');
  await page.getByTestId('open-copies').tap();
  for (const d of '10') await page.getByTestId(`key-${d}`).tap();
  await page.getByTestId('copies-print').tap();
  await expect(logo(page)).toHaveAttribute('data-tone', 'busy');
  await expect(page.getByTestId('status-mark')).toHaveCount(0);
  await expect(logo(page).locator('.ring')).not.toHaveCSS('animation-name', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(logo(page).locator('.ring')).toHaveCSS('animation-name', 'none');
  await page.getByTestId('open-stop').tap();
  await expect(logo(page)).toHaveAttribute('data-tone', 'ok');
});

test('tema scuro: screenshot della barra', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await connectSimulated(page);
  await expect(logo(page)).toHaveAttribute('data-tone', 'ok');
  await page.locator('header').screenshot({ path: 'test-results/31-logo-scuro.png' });
});

test('versione finale (senza 🔧): «Stampante non collegata» intera a 412 px', async ({ page }) => {
  // La larghezza della scritta dipende dal font di sistema. Misurata il 2026-11-08 a 16 px grassetto:
  // Roboto (Android) 179,4 px, Segoe UI (Windows) 187,5 px, DejaVu Sans (Linux del CI) 226,7 px.
  // Sul CI Linux il controllo non dice niente sul telefono: lo salto.
  test.skip(process.platform === 'linux', 'font di sistema diverso da quello del telefono (DejaVu Sans)');
  // Il 🔧 c'è solo in fase di collaudo (TEST_PHASE); qui lo nascondo come nella versione finale.
  await page.goto('/?sim');
  await page.getByTestId('bar-diagnostics').evaluate((el) => (el.style.display = 'none'));
  const text = page.locator('.texts strong');
  await expect(text).toHaveText('Stampante non collegata');
  // Larghezze precise (al decimo di pixel): il testo deve stare nello spazio con almeno 2 px di margine.
  const { textWidth, room } = await text.evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    // Spazio disponibile: dall'inizio della scritta alla fine della zona di stato (il contenitore si stringe sul testo).
    const status = el.closest('.status')!.getBoundingClientRect();
    return { textWidth: r.getBoundingClientRect().width, room: status.right - el.getBoundingClientRect().left };
  });
  expect(room - textWidth).toBeGreaterThanOrEqual(2);
});

/** Stampa rapida e copie senza anteprima. Vedi docs/2026-11-06-stampa-rapida.md. */
import {
  test,
  expect,
  noHorizontalScroll,
  connectSimulated,
  writeText,
  expectJobs,
  fakeClipboard,
  copied,
} from './helpers';
import type { Page } from '@playwright/test';

test('«Stampa» dall’editor: stampa subito, senza anteprima, e finisce nei Recenti', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Rapida');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/21-stampa-rapida-barra.png' });
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await expectJobs(page, 1);
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0);
  await page.getByTestId('open-recent').tap();
  await expect(page.getByRole('dialog')).toContainText('Rapida');
});

test('doppio tocco veloce: un solo lavoro', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Doppio');
  await page.getByTestId('open-print').evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await page.waitForTimeout(500);
  await expectJobs(page, 1);
});

test('«×1» → «3»: tre copie senza anteprima, poi si torna a 1', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Tre');
  await page.getByTestId('open-copies').tap();
  await expect(page.getByRole('dialog', { name: 'Quante copie?' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/22-quante-copie.png' });
  await page.getByTestId('copies-3').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampate 3 copie ✓');
  await expectJobs(page, 1);
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0);
  // Copie tornate a 1: l'anteprima propone 1 copia.
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('print-button')).toHaveText('Stampa');
});

test('«×1» → + + → «Stampa 4 copie»', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Quattro');
  await page.getByTestId('open-copies').tap();
  const dialog = page.getByRole('dialog', { name: 'Quante copie?' });
  await dialog.getByRole('button', { name: 'Una copia in più' }).tap();
  await dialog.getByRole('button', { name: 'Una copia in più' }).tap();
  await expect(page.getByTestId('copies-print')).toHaveText('Stampa 4 copie');
  await page.getByTestId('copies-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampate 4 copie ✓');
});

test('dal pannello del testo: «Stampa» stampa e chiude il pannello', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Dal pannello');
  await noHorizontalScroll(page);
  await page.getByTestId('text-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await expect(page.getByTestId('text-panel')).toHaveCount(0);
  await expectJobs(page, 1);
});

test('con un avviso si apre l’anteprima e non si stampa', async ({ page }) => {
  // Etichetta vuota.
  await connectSimulated(page, { waitForRoll: true });
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('empty-warning')).toBeVisible();
  await expectJobs(page, 0);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();

  // Formato diverso dal rotolo.
  await page.getByTestId('media-chip').tap();
  await page.getByRole('option', { name: /Multiuso piccola/ }).tap();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await writeText(page, 'Formato');
  await page.getByTestId('open-copies').tap();
  await page.getByTestId('copies-2').tap();
  await expect(page.getByTestId('mismatch-warning')).toBeVisible();
  // L'anteprima propone le copie scelte.
  await expect(page.getByTestId('print-button')).toHaveText('Stampa 2 copie');
  await expectJobs(page, 0);
});

test('testo troppo lungo per il riquadro: anteprima con avviso', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await page.getByTestId('add-text').tap();
  await page.keyboard.type(
    'Un testo lunghissimo che non entra mai nel riquadro piccolo di questa etichetta '.repeat(6),
  );
  await page.getByTestId('text-print').tap();
  await expect(page.getByTestId('overflow-warning')).toBeVisible();
  await expectJobs(page, 0);
});

test('stampante non collegata o coperchio aperto: anteprima con avviso', async ({ page }) => {
  await page.goto('/?sim');
  await writeText(page, 'Scollegata');
  await page.getByTestId('open-print').tap();
  await expect(page.getByRole('dialog', { name: 'Anteprima e stampa' })).toContainText(
    'Collega la stampante per stampare',
  );

  await connectSimulated(page, { fault: 'cover-open' });
  await writeText(page, 'Coperchio');
  await page.getByTestId('open-print').tap();
  await expect(page.getByRole('dialog', { name: 'Anteprima e stampa' })).toBeVisible();
  await expectJobs(page, 0);
});

test('la densità scelta nell’anteprima vale per la stampa rapida', async ({ page }) => {
  await fakeClipboard(page);
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Densità');
  await page.getByTestId('open-preview').tap();
  await page.getByRole('button', { name: 'Scura' }).tap();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await expectJobs(page, 1);
  // «Ultime stampe» nella diagnostica: la stampa rapida ha usato la densità «Scura».
  await page.getByTestId('bar-diagnostics').tap();
  await page.getByTestId('diag-all-copy').tap();
  const text = await copied(page);
  expect(text).toMatch(/copie chieste 1 · etichette inviate 1 · densità high/);
});

test('densità predefinita «Scura» con l’archivio vuoto', async ({ page }) => {
  await fakeClipboard(page);
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Predefinita');
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await page.getByTestId('bar-diagnostics').tap();
  await page.getByTestId('diag-all-copy').tap();
  const text = await copied(page);
  expect(text).toMatch(/copie chieste 1 · etichette inviate 1 · densità high/);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByRole('button', { name: 'Scura' })).toHaveAttribute('aria-pressed', 'true');
});

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

/** «×1», poi il numero sul tastierino, poi «Stampa N copie». */
async function printCopies(page: Page, n: number): Promise<void> {
  await page.getByTestId('open-copies').tap();
  for (const d of String(n)) await page.getByTestId(`key-${d}`).tap();
  await page.getByTestId('copies-print').tap();
}

test('«×1» → 3: tre copie senza anteprima, poi si torna a 1', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Tre');
  await page.getByTestId('open-copies').tap();
  await expect(page.getByRole('dialog', { name: 'Quante copie?' })).toBeVisible();
  await noHorizontalScroll(page);
  // Tastierino dentro l'app: nessuna casella che apra la tastiera del telefono.
  await expect(page.getByRole('dialog', { name: 'Quante copie?' }).locator('input, textarea')).toHaveCount(0);
  await expect(page.getByTestId('copies-print')).toBeDisabled();
  await page.getByTestId('key-3').tap();
  await expect(page.getByTestId('copies-print')).toHaveText('Stampa 3 copie');
  await page.screenshot({ path: 'test-results/22-quante-copie.png' });
  await page.getByTestId('copies-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampate 3 copie ✓');
  await expectJobs(page, 1);
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0);
  // Copie tornate a 1: l'anteprima propone 1 copia.
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('print-button')).toHaveText('Stampa');
});

test('tastierino: 2, 4 → «Stampa 24 copie»; ⌫ e C; al massimo 99', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Ventiquattro');
  await page.getByTestId('open-copies').tap();
  for (const k of ['9', '9', '9']) await page.getByTestId(`key-${k}`).tap();
  await expect(page.getByTestId('copies-display')).toContainText('99');
  await page.getByTestId('key-clear').tap();
  await expect(page.getByTestId('copies-print')).toBeDisabled();
  // 2, 4, 7: il 7 è ignorato (247 > 99); ⌫ toglie il 4, poi di nuovo 4.
  for (const k of ['2', '4', '7']) await page.getByTestId(`key-${k}`).tap();
  await expect(page.getByTestId('copies-print')).toHaveText('Stampa 24 copie');
  await page.getByTestId('key-back').tap();
  await expect(page.getByTestId('copies-print')).toHaveText('Stampa 2 copie');
  await page.getByTestId('key-4').tap();
  await expect(page.getByTestId('copies-print')).toHaveText('Stampa 24 copie');
  await page.getByTestId('copies-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampate 24 copie ✓', { timeout: 15_000 });
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
  await printCopies(page, 2);
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

test('più copie: avanzamento «Ferma N/10», poi «Ferma» chiude il lavoro', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Ferma');
  await printCopies(page, 10);
  const stop = page.getByTestId('open-stop');
  await expect(stop).toBeVisible();
  await expect(stop).toContainText(/Ferma \d+\/10/);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/23-ferma.png' });
  await stop.tap();
  const toast = page.getByTestId('toast');
  await expect(toast).toContainText(/^Fermata: stampate \d+ copi[ae] su 10$/);
  const n = Number(/stampate (\d+)/.exec((await toast.textContent()) ?? '')![1]);
  expect(n).toBeGreaterThanOrEqual(1);
  expect(n).toBeLessThan(10);
  await expect(page.getByTestId('open-print')).toBeVisible();
});

test('più copie senza fermare: «Stampate 3 copie ✓»', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, 'Tre');
  await printCopies(page, 3);
  await expect(page.getByTestId('open-stop')).toBeVisible();
  await expect(page.getByTestId('toast')).toHaveText('Stampate 3 copie ✓');
});

/**
 * Codici a barre Code 128 (docs/2026-11-24-codici-a-barre.md), con la stampante simulata.
 */
import type { Page } from '@playwright/test';
import type { Stage } from 'konva/lib/Stage';
import type { Transformer } from 'konva/lib/shapes/Transformer';
import { test, expect, connectSimulated, expectJobs, noHorizontalScroll, type SimWindow } from './helpers';

async function addBarcode(page: Page, value: string) {
  await page.getByTestId('add-barcode').tap();
  await expect(page.getByTestId('barcode-panel')).toBeVisible();
  const input = page.getByTestId('barcode-input');
  await expect(input).toBeFocused();
  await page.keyboard.type(value);
  return input;
}

test('aggiungo un codice articolo, lo vedo in anteprima e lo stampo', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await addBarcode(page, 'ART-12345');
  await expect(page.getByTestId('barcode-error')).toHaveCount(0);
  await expect(page.getByTestId('barcode-keyboard')).toBeVisible(); // il trattino dipende dalla tastiera del lettore
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/44-codice-pannello.png' });
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await expect(page.getByTestId('barcode-warning')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/45-codice-anteprima.png' });
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
  await expectJobs(page, 1);
});

test('carattere non codificabile: avviso nel pannello e stampa bloccata', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await addBarcode(page, 'CAFFÈ');
  await expect(page.getByTestId('barcode-error')).toContainText('«È» non si può mettere');
  // Stampa rapida: si apre l'anteprima con l'avviso, niente stampa.
  await page.getByTestId('text-print').tap();
  await expect(page.getByTestId('barcode-warning')).toBeVisible();
  await expect(page.getByTestId('print-button')).toBeDisabled();
  await expectJobs(page, 0);
});

test('codice troppo lungo per il riquadro: «non entra»', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await addBarcode(page, 'X'.repeat(40));
  await expect(page.getByTestId('barcode-error')).toContainText('non entra');
});

test('vuoto con «Fine» sparisce; pieno resta dopo il ricaricamento e nelle recenti', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await page.getByTestId('add-barcode').tap();
  await page.getByTestId('text-done').tap();
  await expect(page.getByTestId('barcode-panel')).toHaveCount(0);
  await expect(page.getByText('Tocca «+ Testo» per scrivere')).toBeVisible();

  await addBarcode(page, '12345678');
  await page.getByTestId('text-print').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
  await page.reload();
  await expect(page.getByTestId('open-recent')).toBeVisible();
  await page.getByTestId('open-recent').tap();
  await expect(page.getByRole('dialog', { name: 'Recenti' })).toContainText('[codice] 12345678');
});

test('niente rotazione libera; «Ruota 90°» gira di un quarto', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await addBarcode(page, 'A1');
  const rotateEnabled = () =>
    page.evaluate(() => {
      const stage = (window as unknown as SimWindow).__sim.labelStage as Stage;
      return (stage.findOne('Transformer') as Transformer).rotateEnabled();
    });
  expect(await rotateEnabled()).toBe(false);
  await page.getByTestId('barcode-rotate').tap();
  const rotation = () =>
    page.evaluate(() => {
      const stage = (window as unknown as SimWindow).__sim.labelStage as Stage;
      return (stage.findOne('Transformer') as Transformer).nodes()[0]!.rotation();
    });
  await expect.poll(rotation).toBe(90);
  // Con un testo la rotazione libera c'è ancora.
  await page.getByTestId('text-done').tap();
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('T');
  expect(await rotateEnabled()).toBe(true);
});

test('dettatura nel codice: il testo dettato si attacca senza spazio', async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as SimWindow).__sim = { voice: { downloaded: true } }));
  await connectSimulated(page, { waitForRoll: true });
  const input = await addBarcode(page, 'ART-');
  await page.evaluate(() => ((window as unknown as SimWindow).__sim.voice!.phrases = ['dodici']));
  const mic = page.getByTestId('dictate');
  const box = (await mic.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  // Il testo provvisorio fa crescere il pannello: il microfono si sposta sotto il puntatore.
  // Il rilascio deve arrivargli lo stesso (cattura del puntatore), anche con il mouse.
  await expect(page.getByTestId('dictation-status')).toHaveText('dodici');
  expect((await mic.boundingBox())!.y, 'il microfono si è spostato').toBeLessThan(box.y);
  await page.mouse.up();
  await expect(input).toHaveValue('ART-12');
});

test('modifiche ripetute: i nodi disegnati nell’editor non crescono', async ({ page }) => {
  // Regola «Niente che si accumula o resta aperto» di CLAUDE.md.
  await connectSimulated(page, { waitForRoll: true });
  await addBarcode(page, 'A');
  const nodes = () =>
    page.evaluate(() => ((window as unknown as SimWindow).__sim.labelStage as Stage).find('Shape').length);
  await page.waitForTimeout(100);
  const before = await nodes();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.type(String(i % 10));
    await page.keyboard.press('Backspace');
  }
  await page.waitForTimeout(200);
  expect(await nodes()).toBe(before);
});

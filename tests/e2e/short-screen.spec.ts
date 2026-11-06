/**
 * Schermi bassi (per esempio Brave con le sue barre su un Realme GT Master
 * Edition, 2026-11-06): i pannelli scorrono invece di schiacciare il contenuto.
 */
import { connectSimulated, expect, noHorizontalScroll, test, writeText } from './helpers';

test.use({ viewport: { width: 412, height: 600 } });

test('anteprima intera anche su uno schermo basso', async ({ page }) => {
  await connectSimulated(page, { waitForRoll: true });
  await writeText(page, '< 10.00');
  await page.getByTestId('open-preview').tap();
  await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
  const canvas = (await page.getByTestId('preview-canvas').boundingBox())!;
  const wrap = (await page.locator('.preview-wrap').boundingBox())!;
  expect(canvas.y).toBeGreaterThanOrEqual(wrap.y);
  expect(canvas.y + canvas.height, 'anteprima non tagliata in basso').toBeLessThanOrEqual(wrap.y + wrap.height);
  // Il pulsante di stampa si raggiunge scorrendo il pannello.
  await page.getByTestId('print-button').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('print-button')).toBeInViewport();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/26-anteprima-schermo-basso.png' });
});

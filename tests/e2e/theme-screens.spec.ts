/**
 * Schermate principali nei due temi, per confrontare i colori a vista.
 * Vedi docs/2026-11-06-colori-riposanti.md. `SCREENS_DIR` cambia la cartella.
 */
import { connectSimulated, expect, noHorizontalScroll, test } from './helpers';

const DIR = process.env.SCREENS_DIR ?? 'test-results/temi';

for (const theme of ['light', 'dark'] as const) {
  test(`tema ${theme}: editor, pannello del testo, anteprima, copie, diagnostica`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem('etichettatrice.tema', t), theme);
    await connectSimulated(page, { waitForRoll: true });
    await page.getByTestId('add-text').tap();
    await page.keyboard.type('Zucchero ⌀ 8');
    await page.getByTestId('more-options').locator('summary').tap();
    await noHorizontalScroll(page);
    await page.screenshot({ path: `${DIR}/${theme}-1-pannello-testo.png` });
    await page.getByTestId('text-done').tap();
    await page.screenshot({ path: `${DIR}/${theme}-2-editor.png` });
    await page.getByTestId('open-preview').tap();
    await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
    await page.screenshot({ path: `${DIR}/${theme}-3-anteprima.png` });
    await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
    await page.getByTestId('open-copies').tap();
    await page.screenshot({ path: `${DIR}/${theme}-4-copie.png` });
    await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
    await page.getByTestId('bar-diagnostics').tap();
    await page.getByTestId('diag-tab-550').tap();
    await page.getByTestId('check-start').tap();
    await expect(page.getByTestId('check-summary')).toBeVisible({ timeout: 15_000 });
    await noHorizontalScroll(page);
    await page.screenshot({ path: `${DIR}/${theme}-5-diagnostica.png` });
  });
}

/**
 * Uso in orizzontale sul telefono. Il verticale è coperto da tutti gli altri test.
 * Vedi docs/2026-11-08-orizzontale.md.
 */
import type { Locator, Page } from '@playwright/test';
import type { Stage } from 'konva/lib/Stage';
import { test, expect, noHorizontalScroll, connectSimulated, writeText } from './helpers';

/** Pixel 7a in orizzontale con le barre del browser e di Android; Realme a schermo intero. */
const SIZES = [
  { name: 'pixel', width: 915, height: 340 },
  { name: 'realme', width: 873, height: 393 },
] as const;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** L'elemento è intero dentro lo schermo, senza bisogno di scorrere. */
async function fullyVisible(page: Page, el: Locator): Promise<void> {
  const box = await el.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, 'presente').not.toBeNull();
  expect(box!.y, 'non sopra lo schermo').toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, 'non sotto lo schermo').toBeLessThanOrEqual(vp.height + 0.5);
  expect(box!.x + box!.width, 'non oltre il bordo destro').toBeLessThanOrEqual(vp.width + 0.5);
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Riquadro dell'etichetta disegnata (la carta) dentro l'editor, in coordinate della pagina. */
async function paperBox(page: Page): Promise<Box> {
  return page.evaluate(() => {
    const stage = (window as unknown as { __labelStage?: Stage }).__labelStage!;
    const paper = stage.findOne((n: { getClassName(): string }) => n.getClassName() === 'Rect')!;
    const r = paper.getClientRect();
    const c = stage.container().getBoundingClientRect();
    return { x: c.x + r.x, y: c.y + r.y, width: r.width, height: r.height };
  });
}

async function hideDevPanel(page: Page): Promise<void> {
  await page.getByTestId('dev-panel').evaluate((e) => (e.style.display = 'none'));
}

for (const size of SIZES) {
  test.describe(`orizzontale ${size.name} ${size.width}×${size.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
    });

    test('editor: formato e aiuto non coprono l’etichetta', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      await hideDevPanel(page);
      await page.waitForTimeout(300);
      const paper = await paperBox(page);
      const chip = (await page.getByTestId('media-chip').boundingBox())!;
      const hint = (await page.locator('.hint').boundingBox())!;
      expect(overlaps(chip, paper), 'formato sopra l’etichetta').toBe(false);
      expect(overlaps(hint, paper), 'aiuto sotto l’etichetta').toBe(false);
      await noHorizontalScroll(page);
      await page.screenshot({ path: `test-results/land-${size.name}-01-editor.png` });
    });

    test('testo: pannello a destra, pulsanti interi, etichetta visibile a sinistra', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      await hideDevPanel(page);
      await page.getByTestId('add-text').tap();
      await page.keyboard.type('Barattolo zucchero');
      const panel = page.getByTestId('text-panel');
      for (const b of [
        page.getByTestId('text-done'),
        page.getByRole('button', { name: 'Elimina il testo' }),
        page.getByTestId('text-print'),
        page.getByTestId('text-copies'),
        page.getByTestId('text-input'),
        page.getByRole('button', { name: 'Inserisci il simbolo del diametro' }),
      ])
        await fullyVisible(page, b);
      const p = (await panel.boundingBox())!;
      const editor = (await page.getByTestId('editor').boundingBox())!;
      expect(p.x, 'pannello a destra').toBeGreaterThan(size.width / 3);
      expect(editor.x + editor.width, 'editor a sinistra del pannello').toBeLessThanOrEqual(p.x + 1);
      expect(editor.height, 'etichetta non schiacciata').toBeGreaterThan(size.height / 2);
      await noHorizontalScroll(page);
      await page.screenshot({ path: `test-results/land-${size.name}-02-testo.png` });
      await page.getByTestId('text-done').tap();
      await expect(panel).toHaveCount(0);
    });

    test('anteprima: «Stampa» visibile senza scorrere, poi si stampa', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      await writeText(page, 'Anteprima');
      await page.getByTestId('open-preview').tap();
      await expect(page.getByTestId('preview-canvas')).toBeVisible();
      await fullyVisible(page, page.getByTestId('print-button'));
      await noHorizontalScroll(page);
      await page.screenshot({ path: `test-results/land-${size.name}-03-anteprima.png` });
      await page.getByTestId('print-button').tap();
      await expect(page.getByTestId('toast')).toContainText('Stampata');
    });

    test('copie: tutti i tasti e «Stampa N copie» visibili; 2 → 4 → 24 copie', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      await writeText(page, 'Copie');
      await page.getByTestId('open-copies').tap();
      for (const k of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'clear', 'back'])
        await fullyVisible(page, page.getByTestId(`key-${k}`));
      await page.getByTestId('key-2').tap();
      await page.getByTestId('key-4').tap();
      const go = page.getByTestId('copies-print');
      await fullyVisible(page, go);
      await expect(go).toHaveText('Stampa 24 copie');
      await noHorizontalScroll(page);
      await page.screenshot({ path: `test-results/land-${size.name}-04-copie.png` });
      await go.tap();
      await expect(page.getByTestId('toast')).toContainText('Stampate 24 copie');
    });

    test('formato, recenti e diagnostica: si aprono e si chiudono, senza scorrimento orizzontale', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      const sheets: [Locator, string][] = [
        [page.getByTestId('media-chip'), 'Formato etichetta'],
        [page.getByTestId('open-recent'), 'Recenti'],
        [page.getByTestId('bar-diagnostics'), 'Diagnostica'],
      ];
      for (const [open, title] of sheets) {
        await open.tap();
        const dialog = page.getByRole('dialog', { name: title });
        await expect(dialog).toBeVisible();
        await fullyVisible(page, dialog.getByRole('button', { name: 'Chiudi' }));
        await noHorizontalScroll(page);
        await page.screenshot({ path: `test-results/land-${size.name}-05-${title.split(' ')[0]!.toLowerCase()}.png` });
        await dialog.getByRole('button', { name: 'Chiudi' }).tap();
        await expect(dialog).toHaveCount(0);
      }
    });
  });
}

test('orizzontale, tema scuro: testo in modifica', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 915, height: 340 });
  await connectSimulated(page, { waitForRoll: true });
  await hideDevPanel(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Scuro');
  await page.screenshot({ path: 'test-results/land-scuro-testo.png' });
});

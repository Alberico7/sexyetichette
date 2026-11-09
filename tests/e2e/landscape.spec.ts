/**
 * Uso in orizzontale sul telefono. Il verticale è coperto da tutti gli altri test.
 * Vedi docs/2026-11-08-orizzontale.md e docs/2026-11-08-orizzontale-tastiera.md.
 *
 * `screen` è la forma del telefono (ruotato), `viewport` lo spazio visibile: con la
 * tastiera aperta il secondo si abbassa, il primo no.
 */
import type { Locator, Page } from '@playwright/test';
import type { Stage } from 'konva/lib/Stage';
import { test, expect, noHorizontalScroll, connectSimulated, writeText, fakeClipboard, copied } from './helpers';

/** Pixel 7a in orizzontale con le barre del browser e di Android; Realme a schermo intero. */
const SIZES = [
  { name: 'pixel', width: 915, height: 340, screen: { width: 915, height: 412 } },
  { name: 'realme', width: 873, height: 393, screen: { width: 873, height: 393 } },
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
    test.use({ viewport: { width: size.width, height: size.height }, screen: size.screen });

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
        page.getByTestId('insert-diameter'),
        page.getByTestId('insert-diameter-45'),
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

    test('⌀, AFKEUR e N. R. inseriscono il testo senza riaprire la tastiera', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      await hideDevPanel(page);
      await page.getByTestId('add-text').tap();
      await page.keyboard.type('Tubo 20');
      const input = page.getByTestId('text-input');
      // Come su Android dopo «giù»: tastiera chiusa ma casella ancora attiva.
      expect(await input.evaluate((el) => document.activeElement === el)).toBe(true);
      const focused = () => input.evaluate((el) => document.activeElement === el);
      await page.getByTestId('insert-diameter').tap();
      await expect(input).toHaveValue('Tubo 20⌀');
      expect(await focused(), 'tastiera chiusa dopo ⌀').toBe(false);
      await page.getByTestId('insert-reject').tap();
      await expect(input).toHaveValue('Tubo 20⌀AFKEUR');
      expect(await focused(), 'tastiera chiusa dopo AFKEUR').toBe(false);
      await page.getByTestId('insert-unrepairable').tap();
      await expect(input).toHaveValue('Tubo 20⌀AFKEURNON\nRIPARABILE');
      expect(await focused(), 'tastiera chiusa dopo N. R.').toBe(false);
      await input.focus();
      await page.getByTestId('insert-diameter-45').tap();
      await expect(input).toHaveValue('Tubo 20⌀AFKEURNON\nRIPARABILE∅');
      expect(await focused(), 'tastiera chiusa dopo ∅ 45°').toBe(false);
      // Il cursore resta in fondo: un altro ⌀ va dopo «∅».
      await page.getByTestId('insert-diameter').tap();
      await expect(input).toHaveValue('Tubo 20⌀AFKEURNON\nRIPARABILE∅⌀');
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

test.describe('orizzontale, tema scuro', () => {
  test.use({ viewport: { width: 915, height: 340 }, screen: { width: 915, height: 412 } });
  test('testo in modifica', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await connectSimulated(page, { waitForRoll: true });
    await hideDevPanel(page);
    await page.getByTestId('add-text').tap();
    await page.keyboard.type('Scuro');
    await page.screenshot({ path: 'test-results/land-scuro-testo.png' });
  });
});

/** Orizzontale con la tastiera aperta: lo spazio visibile si abbassa, lo schermo resta largo. */
const KEYBOARD = [
  { name: 'pixel', viewport: { width: 915, height: 130 }, screen: { width: 915, height: 412 }, open: 340 },
  { name: 'pixel-stretto', viewport: { width: 915, height: 100 }, screen: { width: 915, height: 412 }, open: 340 },
  { name: 'realme', viewport: { width: 873, height: 150 }, screen: { width: 873, height: 393 }, open: 393 },
] as const;

for (const k of KEYBOARD) {
  test.describe(`orizzontale con tastiera ${k.name} ${k.viewport.width}×${k.viewport.height}`, () => {
    test.use({ viewport: k.viewport, screen: k.screen });

    test('si vedono solo etichetta e casella del testo; chiudendo la tastiera tornano Fine e Stampa', async ({
      page,
    }) => {
      await connectSimulated(page, { waitForRoll: true });
      await hideDevPanel(page);
      await page.getByTestId('add-text').tap();
      await page.keyboard.type('Tastiera');
      const input = page.getByTestId('text-input');
      await fullyVisible(page, input);
      expect((await input.boundingBox())!.height, 'casella alta almeno 40').toBeGreaterThanOrEqual(40);
      // Fine, Stampa ed Elimina nascosti: altrimenti coprono quello che si scrive.
      await expect(page.getByTestId('text-done')).toBeHidden();
      await expect(page.getByTestId('text-print')).toBeHidden();
      await expect(page.locator('header.bar')).toBeHidden();
      await expect(page.getByRole('button', { name: 'Inserisci il simbolo del diametro' })).toBeHidden();
      await expect(page.getByRole('button', { name: 'Elimina il testo' })).toBeHidden();
      const editor = (await page.getByTestId('editor').boundingBox())!;
      expect(editor.height, 'etichetta visibile').toBeGreaterThanOrEqual(k.viewport.height - 10);
      expect(editor.y + editor.height).toBeLessThanOrEqual(k.viewport.height + 0.5);
      await noHorizontalScroll(page);
      await page.screenshot({ path: `test-results/land-tastiera-${k.name}.png` });
      // Tastiera chiusa: lo spazio torna e ricompaiono Fine e Stampa, con il testo ancora aperto.
      await page.setViewportSize({ width: k.viewport.width, height: k.open });
      await fullyVisible(page, page.getByTestId('text-done'));
      await fullyVisible(page, page.getByTestId('text-print'));
      await expect(page.getByTestId('text-input')).toHaveValue('Tastiera');
      await page.getByTestId('text-done').tap();
      await expect(page.getByTestId('text-panel')).toHaveCount(0);
      await expect(page.locator('header.bar')).toBeVisible();
    });

    test('tocco fuori dal testo con la tastiera aperta: si chiude solo la tastiera, il pannello resta', async ({
      page,
    }) => {
      await fakeClipboard(page);
      await connectSimulated(page, { waitForRoll: true });
      await hideDevPanel(page);
      await page.getByTestId('add-text').tap();
      await page.keyboard.type('Resta');
      const input = page.getByTestId('text-input');
      const editor = (await page.getByTestId('editor').boundingBox())!;
      // Spazio vuoto a sinistra dell'etichetta (l'etichetta è centrata e più stretta della colonna).
      const empty = { x: editor.x + 4, y: editor.y + editor.height / 2 };
      await page.touchscreen.tap(empty.x, empty.y);
      await expect(page.getByTestId('text-panel')).toBeVisible();
      expect(await input.evaluate((el) => document.activeElement === el), 'tastiera chiusa').toBe(false);
      await expect(input).toHaveValue('Resta');
      // Tastiera chiusa: lo stesso tocco toglie la selezione e chiude il pannello, come prima.
      await page.setViewportSize({ width: k.viewport.width, height: k.open });
      const e2 = (await page.getByTestId('editor').boundingBox())!;
      await page.touchscreen.tap(e2.x + 4, e2.y + e2.height / 2);
      await expect(page.getByTestId('text-panel')).toHaveCount(0);
      // Il registro della diagnostica racconta cosa è successo.
      await page.getByTestId('bar-diagnostics').tap();
      await page.getByTestId('diag-all-copy').tap();
      await expect.poll(() => copied(page)).toContain('chiusa solo la tastiera');
      const log = await copied(page);
      expect(log).toContain('Pannello del testo chiuso: nessun testo selezionato');
      expect(log).toContain('Tocco fuori dal testo: selezione tolta');
    });

    test('formato: la ricerca è visibile', async ({ page }) => {
      await connectSimulated(page, { waitForRoll: true });
      await page.getByTestId('media-chip').tap();
      const dialog = page.getByRole('dialog', { name: 'Formato etichetta' });
      const search = dialog.getByRole('textbox').first();
      await search.focus();
      await fullyVisible(page, search);
      await noHorizontalScroll(page);
    });
  });
}

test.describe('verticale piccolo con tastiera 360×300', () => {
  test.use({ viewport: { width: 360, height: 300 }, screen: { width: 360, height: 640 } });
  test('mentre si scrive la barra in alto è nascosta; casella e Fine visibili; non diventa orizzontale', async ({
    page,
  }) => {
    await connectSimulated(page, { waitForRoll: true });
    await hideDevPanel(page);
    await page.getByTestId('add-text').tap();
    await page.keyboard.type('Piccolo');
    await expect(page.locator('header.bar')).toBeHidden();
    await fullyVisible(page, page.getByTestId('text-input'));
    await fullyVisible(page, page.getByTestId('text-done'));
    // Lo schermo è verticale: il pannello resta sotto l'etichetta, non a destra.
    const panel = (await page.getByTestId('text-panel').boundingBox())!;
    expect(panel.x).toBeLessThanOrEqual(1);
    await noHorizontalScroll(page);
    await page.screenshot({ path: 'test-results/vert-piccolo-tastiera.png' });
  });
});

test.describe('verticale Pixel con tastiera 412×560', () => {
  test.use({ viewport: { width: 412, height: 560 }, screen: { width: 412, height: 915 } });
  test('la barra in alto resta', async ({ page }) => {
    await connectSimulated(page, { waitForRoll: true });
    await page.getByTestId('add-text').tap();
    await page.keyboard.type('Pixel');
    await expect(page.locator('header.bar')).toBeVisible();
  });
});

test.describe('tablet 8" orizzontale 962×545', () => {
  // Spazio sopra 500 ma sotto 600 punti: usa la disposizione orizzontale (soglia alzata a 600).
  test.use({ viewport: { width: 962, height: 545 }, screen: { width: 962, height: 601 } });
  test('anteprima con «Stampa» in vista e testo a destra', async ({ page }) => {
    await connectSimulated(page, { waitForRoll: true });
    await writeText(page, 'Tablet');
    await page.getByTestId('open-preview').tap();
    await expect(page.getByTestId('preview-canvas')).toBeVisible();
    await fullyVisible(page, page.getByTestId('print-button'));
    await page.getByRole('button', { name: 'Chiudi' }).tap();
    await page.getByTestId('add-text').tap();
    const panel = (await page.getByTestId('text-panel').boundingBox())!;
    expect(panel.x, 'pannello a destra').toBeGreaterThan(962 / 3);
    await noHorizontalScroll(page);
  });
});

test.describe('tablet 10" orizzontale 1280×744', () => {
  // Sopra 600 punti: disposizione di prima (pannello del testo sotto l'etichetta).
  test.use({ viewport: { width: 1280, height: 744 }, screen: { width: 1280, height: 800 } });
  test('pannello del testo sotto, a tutta larghezza', async ({ page }) => {
    await connectSimulated(page, { waitForRoll: true });
    await page.getByTestId('add-text').tap();
    const panel = (await page.getByTestId('text-panel').boundingBox())!;
    expect(panel.x).toBeLessThanOrEqual(1);
    expect(panel.width).toBeGreaterThan(1200);
    await fullyVisible(page, page.getByTestId('text-done'));
  });
});

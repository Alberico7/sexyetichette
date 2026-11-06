/** Stampa rapida e copie senza anteprima. Vedi docs/2026-11-06-stampa-rapida.md. */
import { expect, test, type Page } from '@playwright/test';

let pageProblems: string[] = [];
test.beforeEach(({ page }) => {
  pageProblems = [];
  page.on('pageerror', (e) => pageProblems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[Vue warn]'))) {
      pageProblems.push(`${m.type()}: ${m.text()}`);
    }
  });
});
test.afterEach(() => {
  expect(pageProblems, 'errori nella console della pagina').toEqual([]);
});

async function noHorizontalScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

async function connect(page: Page, fault = 'none'): Promise<void> {
  await page.goto('/?sim');
  if (fault !== 'none') {
    const panel = page.getByTestId('dev-panel');
    await panel.locator('summary').tap();
    await panel.getByLabel('Guasto').selectOption(fault);
    await panel.locator('summary').tap();
  }
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();
  // Rotolo letto: il formato dell'etichetta vuota diventa quello del rotolo (niente avviso di formato diverso).
  if (fault === 'none') await expect(page.getByTestId('media-chip')).toContainText('Indirizzo 28×89 mm');
}

async function writeText(page: Page, text: string): Promise<void> {
  await page.getByTestId('add-text').tap();
  await page.keyboard.type(text);
  await page.getByTestId('text-done').tap();
}

const jobs = (page: Page, n: number) => expect(page.getByTestId('dev-panel')).toContainText(`lavori ricevuti: ${n}`);

test('«Stampa» dall’editor: stampa subito, senza anteprima, e finisce nei Recenti', async ({ page }) => {
  await connect(page);
  await expect(page.getByTestId('media-chip')).toContainText('Indirizzo 28×89 mm');
  await writeText(page, 'Rapida');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/21-stampa-rapida-barra.png' });
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await jobs(page, 1);
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0);
  await page.getByTestId('open-recent').tap();
  await expect(page.getByRole('dialog')).toContainText('Rapida');
});

test('doppio tocco veloce: un solo lavoro', async ({ page }) => {
  await connect(page);
  await writeText(page, 'Doppio');
  await page.getByTestId('open-print').evaluate((b: HTMLButtonElement) => {
    b.click();
    b.click();
  });
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await page.waitForTimeout(500);
  await jobs(page, 1);
});

test('«×1» → «3»: tre copie senza anteprima, poi si torna a 1', async ({ page }) => {
  await connect(page);
  await writeText(page, 'Tre');
  await page.getByTestId('open-copies').tap();
  await expect(page.getByRole('dialog', { name: 'Quante copie?' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/22-quante-copie.png' });
  await page.getByTestId('copies-3').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampate 3 copie ✓');
  await jobs(page, 1);
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0);
  // Copie tornate a 1: l'anteprima propone 1 copia.
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('print-button')).toHaveText('Stampa');
});

test('«×1» → + + → «Stampa 4 copie»', async ({ page }) => {
  await connect(page);
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
  await connect(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Dal pannello');
  await noHorizontalScroll(page);
  await page.getByTestId('text-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await expect(page.getByTestId('text-panel')).toHaveCount(0);
  await jobs(page, 1);
});

test('con un avviso si apre l’anteprima e non si stampa', async ({ page }) => {
  // Etichetta vuota.
  await connect(page);
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('empty-warning')).toBeVisible();
  await jobs(page, 0);
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
  await jobs(page, 0);
});

test('testo troppo lungo per il riquadro: anteprima con avviso', async ({ page }) => {
  await connect(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Un testo lunghissimo che non entra mai nel riquadro piccolo di questa etichetta '.repeat(6));
  await page.getByTestId('text-print').tap();
  await expect(page.getByTestId('overflow-warning')).toBeVisible();
  await jobs(page, 0);
});

test('stampante non collegata o coperchio aperto: anteprima con avviso', async ({ page }) => {
  await page.goto('/?sim');
  await writeText(page, 'Scollegata');
  await page.getByTestId('open-print').tap();
  await expect(page.getByRole('dialog', { name: 'Anteprima e stampa' })).toContainText('Collega la stampante per stampare');

  await connect(page, 'cover-open');
  await writeText(page, 'Coperchio');
  await page.getByTestId('open-print').tap();
  await expect(page.getByRole('dialog', { name: 'Anteprima e stampa' })).toBeVisible();
  await jobs(page, 0);
});

test('la densità scelta nell’anteprima vale per la stampa rapida', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => ({ writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) }),
    });
  });
  await connect(page);
  await writeText(page, 'Densità');
  await page.getByTestId('open-preview').tap();
  await page.getByRole('button', { name: 'Scura' }).tap();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await jobs(page, 1);
  // «Ultime stampe» nella diagnostica: la stampa rapida ha usato la densità «Scura».
  await page.getByTestId('bar-diagnostics').tap();
  await page.getByTestId('diag-all-copy').tap();
  const text = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
  expect(text).toMatch(/copie chieste 1 · etichette inviate 1 · densità high/);
});

test('densità predefinita «Scura» con l’archivio vuoto', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => ({ writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) }),
    });
  });
  await connect(page);
  await writeText(page, 'Predefinita');
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await page.getByTestId('bar-diagnostics').tap();
  await page.getByTestId('diag-all-copy').tap();
  const text = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
  expect(text).toMatch(/copie chieste 1 · etichette inviate 1 · densità high/);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByRole('button', { name: 'Scura' })).toHaveAttribute('aria-pressed', 'true');
});

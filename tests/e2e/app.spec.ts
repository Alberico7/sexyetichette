import { expect, test, type Page } from '@playwright/test';

// Qualunque errore JavaScript o avviso di Vue nella pagina fa fallire il test.
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
  expect(scroll, 'scorrimento orizzontale').toBeLessThanOrEqual(client);
}

async function connectSimulated(page: Page): Promise<void> {
  await page.goto('/?sim');
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
}

test('layout su Pixel 7a senza scorrimento orizzontale', async ({ page }) => {
  await page.goto('/?sim');
  await expect(page.getByRole('button', { name: 'Collega', exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/01-avvio.png' });

  await page.getByTestId('media-chip').tap();
  await expect(page.getByRole('dialog', { name: 'Formato etichetta' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/02-formati.png' });
});

test('collegamento, testo, anteprima e stampa (simulata)', async ({ page }) => {
  await connectSimulated(page);
  // Il rotolo letto via NFC (simulato: 30252) diventa il formato dell'etichetta.
  await expect(page.getByTestId('media-chip')).toContainText('Indirizzo 28×89 mm');

  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('Barattolo zucchero');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/03-testo.png' });
  await page.getByTestId('text-done').tap();
  await page.screenshot({ path: 'test-results/04-editor.png' });

  await page.getByTestId('open-print').tap();
  const preview = page.getByTestId('preview-canvas');
  await expect(preview).toBeVisible();
  await expect.poll(async () => preview.evaluate((c: HTMLCanvasElement) => c.width)).toBe(1051);
  await page.getByRole('button', { name: 'Una copia in più' }).tap();
  await page.getByRole('button', { name: 'Scura' }).tap();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/05-anteprima.png' });

  await page.getByTestId('print-button').tap();
  await expect(page.getByText('Etichetta inviata alla stampante')).toBeVisible();
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
});

test('rotolo rilevato diverso dal formato predefinito viene adottato', async ({ page }) => {
  await page.goto('/?sim');
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('SKU rotolo').fill('S0722540');
  await panel.getByLabel('SKU rotolo').blur();
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByTestId('media-chip')).toContainText('Multiuso media removibile');
});

test('selettore chiuso senza scelta: messaggio in italiano con suggerimento GrapheneOS', async ({ page }) => {
  await page.goto('/?sim');
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Selettore USB').selectOption('cancel');
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Nessuna stampante selezionata');
  await expect(alert).toContainText('GrapheneOS');
  await noHorizontalScroll(page);
});

test('coperchio aperto: stato in rosso e stampa disabilitata', async ({ page }) => {
  await connectSimulated(page);
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Guasto').selectOption('cover-open');
  await expect(page.getByRole('status').first()).toContainText('Coperchio aperto');
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Prova');
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-print').tap();
  await expect(page.getByTestId('print-button')).toBeDisabled();
  await page.screenshot({ path: 'test-results/06-coperchio.png' });
});

test('stampante occupata durante la stampa: errore e pulsante di ripristino', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Prova');
  await page.getByTestId('text-done').tap();
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Guasto').selectOption('busy');
  await page.getByTestId('open-print').tap();
  await page.getByTestId('print-button').tap();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Stampante occupata');
  await alert.getByRole('button', { name: 'Ripristina stampante' }).tap();
  await expect(alert).toHaveCount(0);
});

test('tema: automatico → chiaro → scuro, la scelta resta dopo il ricaricamento', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?sim');
  const toggle = page.getByTestId('theme-toggle');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect(toggle).toHaveAttribute('data-theme-pref', 'auto');
  const lightBg = await bg();

  await toggle.tap();
  await expect(toggle).toHaveAttribute('data-theme-pref', 'light');
  await toggle.tap();
  await expect(toggle).toHaveAttribute('data-theme-pref', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).not.toBe(lightBg);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1c1f26');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('data-theme-pref', 'dark');
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Tubo Ø 20');
  await page.getByTestId('text-done').tap();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/07-tema-scuro.png' });

  await toggle.tap();
  await expect(toggle).toHaveAttribute('data-theme-pref', 'auto');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('tema automatico segue il sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?sim');
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(dark).not.toBe(light);
});

test('pulsante diametro: inserisce Ø nella posizione del cursore', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('Tubo 20 mm');
  // Cursore dopo "Tubo ".
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  await page.getByTestId('insert-diameter').tap();
  await expect(input).toHaveValue('Tubo Ø20 mm');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(6);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/08-diametro.png' });

  // Il simbolo arriva nell'anteprima di stampa.
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-print').tap();
  await expect.poll(async () => page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => c.width)).toBe(1051);
});

test('adattamento automatico: attivo sui nuovi testi, la dimensione segue il testo', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const toggle = page.getByTestId('auto-fit');
  const size = page.getByTestId('font-size');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(size).toHaveAttribute('readonly', '');

  await page.getByTestId('text-input').fill('Corto');
  const short = Number(await size.inputValue());
  await page.getByTestId('text-input').fill('Un testo decisamente più lungo');
  await expect.poll(async () => Number(await size.inputValue())).toBeLessThan(short);
  const fitted = Number(await size.inputValue());
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/09-adatta.png' });

  // Disattivando, la dimensione riparte da quella calcolata ed è modificabile.
  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(size).not.toHaveAttribute('readonly', '');
  expect(Number(await size.inputValue())).toBe(fitted);

  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-print').tap();
  await expect.poll(async () => page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => c.width)).toBe(1051);
});

test('secondo simbolo del diametro (⌀)', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('20');
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await page.getByTestId('insert-diameter-iso').tap();
  await expect(input).toHaveValue('⌀20');
  await page.getByTestId('insert-diameter').tap();
  await expect(input).toHaveValue('⌀Ø20');
});

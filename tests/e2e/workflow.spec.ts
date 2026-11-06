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

async function connect(page: Page): Promise<void> {
  await page.goto('/?sim');
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
}

test('operazione tipica: «+ Testo», scrivi, «Stampa» = 2 tocchi, senza anteprima', async ({ page }) => {
  await connect(page);
  let taps = 0;
  const tap = async (testId: string) => {
    taps++;
    await page.getByTestId(testId).tap();
  };

  await tap('add-text');
  // La casella ha già il fuoco: si scrive subito, senza toccarla.
  await expect(page.getByTestId('text-input')).toBeFocused();
  await page.keyboard.type('Zucchero');
  await expect(page.getByTestId('text-input')).toHaveValue('Zucchero');
  // L'etichetta resta visibile sopra il pannello.
  const editorHeight = await page.getByTestId('editor').evaluate((e) => e.getBoundingClientRect().height);
  expect(editorHeight).toBeGreaterThan(150);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/10-pannello-compatto.png' });

  // Stampa rapida: un tocco, nessun pannello di anteprima.
  await tap('text-print');
  await expect(page.getByTestId('toast')).toHaveText('Stampata ✓');
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
  await expect(page.getByTestId('preview-canvas')).toHaveCount(0);
  await expect(page.getByTestId('text-panel')).toHaveCount(0);
  expect(taps).toBe(2);

  // L'anteprima resta a un tocco con 👁.
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/11-anteprima-pronta.png' });
});

test('testo lasciato vuoto viene eliminato', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-done').tap();
  await expect(page.getByText('Tocca «+ Testo» per scrivere')).toBeVisible();
  // Barra senza selezione: «+ Testo», «Recenti», 👁, «Stampa» e «×1».
  await expect(page.getByRole('navigation', { name: 'Azioni' }).getByRole('button')).toHaveCount(5);
});

test('barra contestuale e secondo tocco per modificare', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Sale');
  await page.getByTestId('text-done').tap();
  // Il testo resta selezionato: la barra mostra anche Modifica ed Elimina.
  const nav = page.getByRole('navigation', { name: 'Azioni' });
  await expect(nav.getByRole('button')).toHaveCount(6);
  // Un tocco sul testo già selezionato apre il pannello di modifica.
  const box = (await page.getByTestId('editor').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('text-panel')).toBeVisible();
  await expect(page.getByTestId('text-input')).toHaveValue('Sale');
});

test('stampante reinserita: si ricollega da sola', async ({ page }) => {
  await connect(page);
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByRole('button', { name: 'Scollega il cavo' }).tap();
  await expect(page.getByRole('status').first()).toContainText('non collegata');
  await panel.getByRole('button', { name: 'Inserisci il cavo' }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('densità e formato ricordati; copie che tornano a 1 dopo la stampa', async ({ page }) => {
  await connect(page);
  await page.getByTestId('media-chip').tap();
  await page.getByRole('option', { name: /Multiuso piccola/ }).tap();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Copie');
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await page.getByRole('button', { name: 'Scura' }).tap();
  await page.getByRole('button', { name: 'Una copia in più' }).tap();
  await expect(page.getByTestId('print-button')).toHaveText('Stampa 2 copie');
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampate 2 copie ✓');

  await page.reload();
  await expect(page.getByTestId('media-chip')).toContainText('Multiuso piccola');
  await page.getByTestId('open-preview').tap();
  await expect(page.getByRole('button', { name: 'Scura' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('print-button')).toHaveText('Stampa');
});

test('«Collega» toccato subito all’apertura: un solo collegamento, la stampa funziona', async ({ page }) => {
  await page.goto('/?sim');
  // Tocco immediato, prima del ricollegamento automatico in sottofondo.
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Subito');
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('scrivere una dimensione spegne l’adattamento automatico', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Dimensione');
  await page.getByTestId('more-options').locator('summary').tap();
  const toggle = page.getByTestId('auto-fit');
  const size = page.getByTestId('font-size');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  // Valore non valido: non cambia nulla.
  await size.fill('2');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await size.blur();
  expect(Number(await size.inputValue())).toBeGreaterThan(4);

  // Valore valido: adattamento spento, dimensione scelta.
  await size.fill('18');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Dimensione (pt)')).toBeVisible();
  await size.blur();
  await expect(size).toHaveValue('18');

  // L'anteprima si genera con la nuova dimensione.
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();

  // Riattivando l'interruttore la dimensione torna calcolata.
  await page.getByTestId('edit-selected').tap();
  await page.getByTestId('more-options').locator('summary').tap();
  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => Number(await size.inputValue())).not.toBe(18);
});

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

/** Sostituisce navigator.usb con uno finto che offre una stampante HP e registra le chiamate. */
async function fakeUsb(page: Page, opts: { claimFails?: boolean } = {}): Promise<void> {
  await page.addInitScript((o) => {
    const calls: string[] = [];
    (window as unknown as { __usbCalls: string[] }).__usbCalls = calls;
    const config = { configurationValue: 1, interfaces: [{ interfaceNumber: 0, alternate: { interfaceClass: 7 }, alternates: [{ interfaceClass: 7 }] }] };
    let opened = false;
    const device = {
      vendorId: 0x03f0, productId: 0x2d11, productName: 'DeskJet 2700', manufacturerName: 'HP',
      serialNumber: 'CN99998888', usbVersionMajor: 2, usbVersionMinor: 0, configurations: [config],
      get opened() { return opened; }, get configuration() { return config; },
      async open() { calls.push('open'); opened = true; },
      async close() { calls.push('close'); opened = false; },
      async selectConfiguration() { calls.push('selectConfiguration'); },
      async claimInterface() { calls.push('claimInterface'); if (o.claimFails) { const e = new Error('Unable to claim interface.'); e.name = 'NetworkError'; throw e; } },
      async releaseInterface() { calls.push('releaseInterface'); },
      async forget() { calls.push('forget'); },
      async transferOut() { calls.push('transferOut'); },
      async controlTransferOut() { calls.push('controlTransferOut'); },
    };
    const usb = {
      async getDevices() { return []; },
      async requestDevice() { calls.push('requestDevice'); return device; },
      addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(Navigator.prototype, 'usb', { configurable: true, get: () => usb });
  }, opts);
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
}

test('?diagnostica: prova con una stampante HP, nessun dato inviato', async ({ page }) => {
  await fakeUsb(page);
  await page.goto('/?diagnostica');
  const dialog = page.getByRole('dialog', { name: 'Diagnostica' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('diag-steps')).toContainText('WebUSB disponibile');
  await page.getByTestId('diag-start').tap();
  await expect(page.getByTestId('diag-summary')).toContainText('il collegamento USB funziona');
  await expect(page.getByTestId('diag-device')).toContainText('HP – DeskJet 2700');
  await expect(page.getByTestId('diag-device')).toContainText('stampante');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/14-diagnostica.png', fullPage: false });

  const calls = await page.evaluate(() => (window as unknown as { __usbCalls: string[] }).__usbCalls);
  expect(calls).toEqual(['requestDevice', 'open', 'claimInterface', 'releaseInterface', 'close']);

  await page.getByTestId('diag-forget').tap();
  await expect(dialog).toContainText('Autorizzazione revocata');
});

test('presa di controllo fallita: spiegazione in italiano', async ({ page }) => {
  await fakeUsb(page, { claimFails: true });
  await page.goto('/?diagnostica');
  await page.getByTestId('diag-start').tap();
  await expect(page.getByTestId('diag-summary')).toContainText('non riesce a prenderne il controllo');
});

test('link alla diagnostica dal messaggio «Nessuna stampante selezionata»', async ({ page }) => {
  await page.goto('/?sim');
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Selettore USB').selectOption('cancel');
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await page.getByRole('alert').getByTestId('open-diagnostics').tap();
  await expect(page.getByRole('dialog', { name: 'Diagnostica' })).toBeVisible();
});

/** navigator.share finto: registra titolo e testo; `cancel` simula la chiusura del menu. */
async function fakeShare(page: Page, opts: { cancel?: boolean } = {}): Promise<void> {
  await page.addInitScript((o) => {
    const shared: { title?: string; text?: string }[] = [];
    (window as unknown as { __shared: typeof shared }).__shared = shared;
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (d: { title?: string; text?: string }) => {
        if (o.cancel) throw new DOMException('Share canceled', 'AbortError');
        shared.push(d);
      },
    });
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => false });
  }, opts);
}

const shared = (page: Page) => page.evaluate(() => (window as unknown as { __shared: { title?: string; text?: string }[] }).__shared);

async function simWithFault(page: Page, fault: string): Promise<void> {
  await page.goto('/?sim');
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Guasto').selectOption(fault);
  await panel.locator('summary').tap();
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
}

test('rotolo che non risponde: causa, dettagli e condivisione', async ({ page }) => {
  await fakeShare(page);
  await simWithFault(page, 'nfc-timeout');
  await page.getByTestId('media-chip').tap();
  await expect(page.getByTestId('media-read-failed')).toBeVisible();
  await expect(page.getByTestId('media-read-cause')).toContainText('non ha risposto');
  await page.getByText('Dettagli', { exact: true }).tap();
  await expect(page.getByRole('dialog', { name: 'Formato etichetta' })).toContainText('Tentativi');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/15-rotolo-non-letto.png' });

  await page.getByTestId('media-read-share').tap();
  const s = await shared(page);
  expect(s[0]?.title).toBe('Etichettatrice – lettura del rotolo');
  expect(s[0]?.text).toContain('Causa: timeout');
  expect(s[0]?.text).toContain('Tentativi: 2');
});

test('prova LabelWriter 550 completa e «Condividi tutto»', async ({ page }) => {
  await fakeShare(page);
  await simWithFault(page, 'nfc-flaky');
  await page.getByTestId('media-chip').tap();
  await page.getByTestId('media-diagnostics').tap();
  const dialog = page.getByRole('dialog', { name: 'Diagnostica' });
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('diag-tab-550')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('check-start').tap();
  await expect(page.getByTestId('check-summary')).toContainText('avviso', { timeout: 15_000 });
  await expect(page.getByTestId('check-summary')).toContainText('instabile');
  await expect(page.getByTestId('check-steps')).toContainText('Lavoro di stampa (non inviato)');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/16-prova-550.png' });

  await page.getByTestId('diag-all-share').tap();
  const s = await shared(page);
  expect(s[0]?.title).toMatch(/^Etichettatrice – diagnostica \d{4}-\d\d-\d\d \d\d:\d\d$/);
  const text = s[0]?.text ?? '';
  expect(text).toContain('RIEPILOGO');
  expect(text).toContain('Prova LabelWriter 550');
  expect(text).toContain('Registro degli eventi');
  expect(text).toContain('Rotolo (ESC U) × 3');
  expect(text.split('Prova LabelWriter 550:')[0]).not.toContain('Etichetta vuota');
});

test('stampa di prova: conferma, una etichetta e domande nel testo condiviso', async ({ page }) => {
  await fakeShare(page);
  await simWithFault(page, 'none');
  await page.getByTestId('media-chip').tap();
  await page.getByTestId('media-diagnostics').tap();
  await page.getByTestId('diag-tab-test').tap();
  await expect(page.getByTestId('test-format')).toContainText('letto dal rotolo');
  await expect(page.getByTestId('test-preview')).toBeVisible();
  await page.getByTestId('test-print').tap();
  await page.getByTestId('test-print-confirm').tap();
  await expect(page.getByTestId('test-questions')).toBeVisible();
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
  await page.getByTestId('answer-border').filter({ hasText: 'manca a sinistra' }).tap();
  await page.getByTestId('answer-firstOut').filter({ hasText: /^\s*sì\s*$/ }).tap();
  await page.getByTestId('ticks-left').fill('6');
  await page.getByTestId('ticks-left').blur();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/17-stampa-di-prova.png' });

  await page.getByTestId('diag-all-share').tap();
  const text = (await shared(page))[0]?.text ?? '';
  expect(text).toContain('Bordo esterno: manca a sinistra');
  expect(text).toContain('Lato uscito per primo: sì');
  expect(text).toContain('sinistra 6');
});

test('chiudere il menu di condivisione non mostra errori; senza supporto il pulsante non c’è', async ({ page, browser }) => {
  await fakeShare(page, { cancel: true });
  await page.goto('/?diagnostica');
  await page.getByTestId('diag-all-share').tap();
  await expect(page.getByRole('dialog', { name: 'Diagnostica' })).not.toContainText('non riuscita');

  const other = await browser.newPage();
  await other.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
  });
  await other.goto('/?diagnostica');
  await expect(other.getByTestId('diag-all-copy')).toBeVisible();
  await expect(other.getByTestId('diag-all-share')).toHaveCount(0);
  await other.close();
});

/** L'elemento è interamente dentro lo schermo (visibile senza scorrere). */
async function inViewport(page: Page, testid: string): Promise<void> {
  const box = await page.getByTestId(testid).boundingBox();
  const vp = page.viewportSize()!;
  expect(box, testid).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
}

test('diagnostica più semplice: 🔧 in alto, schede fisse, «Vai alla stampa di prova», copia sempre visibile', async ({ page }) => {
  await fakeShare(page);
  await page.goto('/?sim');
  // Stampante scollegata: il pulsante c'è e apre la diagnostica sulla scheda USB.
  await page.getByTestId('bar-diagnostics').tap();
  const dialog = page.getByRole('dialog', { name: 'Diagnostica' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('tab')).toHaveText(['Prova 550', 'Stampa di prova', 'USB']);
  await expect(page.getByTestId('diag-tab-usb')).toHaveAttribute('aria-selected', 'true');
  await inViewport(page, 'diag-all-copy');
  await dialog.getByRole('button', { name: 'Chiudi' }).tap();
  await noHorizontalScroll(page);

  // Collegata: prova 550, poi in fondo ai risultati le schede restano raggiungibili.
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
  await page.getByTestId('bar-diagnostics').tap();
  await page.getByTestId('diag-tab-550').tap();
  await page.getByTestId('check-start').tap();
  await expect(page.getByTestId('check-summary')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('check-steps').locator('li').last().scrollIntoViewIfNeeded();
  await inViewport(page, 'diag-tab-test');
  await inViewport(page, 'diag-all-copy');
  await page.screenshot({ path: 'test-results/20-diagnostica-schede-fisse.png' });

  await page.getByTestId('check-go-test').tap();
  await expect(page.getByTestId('diag-tab-test')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('test-format')).toBeVisible();
  await inViewport(page, 'test-format');

  // Riaprendo si torna all'ultima scheda usata.
  await dialog.getByRole('button', { name: 'Chiudi' }).tap();
  await page.getByTestId('bar-diagnostics').tap();
  await expect(page.getByTestId('diag-tab-test')).toHaveAttribute('aria-selected', 'true');

  // Una stampa da 2 copie finisce in «Ultime stampe».
  await dialog.getByRole('button', { name: 'Chiudi' }).tap();
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Due');
  await page.getByTestId('text-print').tap();
  await page.getByRole('button', { name: 'Una copia in più' }).tap();
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
  await page.getByTestId('bar-diagnostics').tap();
  await page.getByTestId('diag-all-share').tap();
  const text = (await shared(page))[0]?.text ?? '';
  expect(text).toMatch(/Ultime stampe \(1\):\n.*copie chieste 2 · etichette inviate 2/);
});

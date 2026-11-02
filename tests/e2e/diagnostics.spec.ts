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
  const dialog = page.getByRole('dialog', { name: 'Diagnostica USB' });
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
  await expect(page.getByRole('dialog', { name: 'Diagnostica USB' })).toBeVisible();
});

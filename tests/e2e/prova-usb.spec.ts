/**
 * Pagina di prova USB per browser vecchi, con un navigator.usb finto.
 * Vedi docs/2026-11-27-prova-usb-browser-vecchi.md.
 */
import type { Page } from '@playwright/test';
import { test, expect, noHorizontalScroll } from './helpers';

/** LabelWriter finta: registra le chiamate in window.__usb; `failClaim` fa fallire la presa di controllo. */
async function fakeUsb(page: Page, failClaim = false) {
  await page.addInitScript((fail) => {
    const calls: string[] = [];
    (window as unknown as { __usb: string[] }).__usb = calls;
    const dev = {
      manufacturerName: 'DYMO',
      productName: 'LabelWriter 550',
      vendorId: 0x0922,
      productId: 0x0028,
      serialNumber: '12345678',
      opened: false,
      configuration: null as unknown,
      open() {
        calls.push('open');
        dev.opened = true;
        return Promise.resolve();
      },
      selectConfiguration(n: number) {
        calls.push(`config ${n}`);
        dev.configuration = {
          interfaces: [
            {
              interfaceNumber: 0,
              alternates: [
                {
                  endpoints: [
                    { endpointNumber: 2, direction: 'in', type: 'bulk' },
                    { endpointNumber: 1, direction: 'out', type: 'bulk' },
                  ],
                },
              ],
            },
          ],
        };
        return Promise.resolve();
      },
      claimInterface(n: number) {
        calls.push(`claim ${n}`);
        return fail
          ? Promise.reject(new DOMException('Unable to claim interface.', 'NetworkError'))
          : Promise.resolve();
      },
      transferOut(ep: number, data: Uint8Array) {
        calls.push(`out ${ep} ${Array.from(data).join(',')}`);
        return Promise.resolve({ status: 'ok', bytesWritten: data.length });
      },
      transferIn(ep: number) {
        calls.push(`in ${ep}`);
        const bytes = new Uint8Array(32);
        bytes[9] = 0x64;
        return Promise.resolve({ status: 'ok', data: new DataView(bytes.buffer) });
      },
      releaseInterface(n: number) {
        calls.push(`release ${n}`);
        return Promise.resolve();
      },
      close() {
        calls.push('close');
        dev.opened = false;
        return Promise.resolve();
      },
    };
    Object.defineProperty(navigator, 'usb', {
      configurable: true,
      value: { requestDevice: () => Promise.resolve(dev) },
    });
  }, failClaim);
}

const calls = (page: Page) => page.evaluate(() => (window as unknown as { __usb: string[] }).__usb);

test('mostra il browser, trova la stampante, legge lo stato e chiude', async ({ page }) => {
  await fakeUsb(page);
  await page.goto('./prova-usb.html');
  const out = page.getByTestId('risultati');
  await expect(out).toHaveValue(/WebUSB \(navigator\.usb\): presente/);
  await expect(out).toHaveValue(/Contesto sicuro/);
  await page.getByTestId('cerca').tap();
  await expect(out).toHaveValue(/Scelta: DYMO LabelWriter 550/);
  await page.getByTestId('stato').tap();
  await expect(out).toHaveValue(/La stampante risponde/);
  await expect(out).toHaveValue(/00 00 00 00 00 00 00 00 00 64/);
  await expect(out).toHaveValue(/chiusura: ok/);
  expect(await calls(page)).toEqual(['open', 'config 1', 'claim 0', 'out 1 27,65,0', 'in 2', 'release 0', 'close']);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/46-prova-usb.png', fullPage: true });
});

test('presa di controllo fallita: errore scritto e dispositivo chiuso lo stesso', async ({ page }) => {
  await fakeUsb(page, true);
  await page.goto('./prova-usb.html');
  await page.getByTestId('cerca').tap();
  await page.getByTestId('stato').tap();
  const out = page.getByTestId('risultati');
  await expect(out).toHaveValue(/ERRORE: NetworkError: Unable to claim interface/);
  await expect(out).toHaveValue(/chiusura: ok/);
  const c = await calls(page);
  expect(c).toContain('close');
  expect(c).not.toContain('out 1 27,65,0');
});

test('senza WebUSB lo dice e disattiva la ricerca', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'usb', { configurable: true, value: undefined }));
  await page.goto('./prova-usb.html');
  await expect(page.getByTestId('risultati')).toHaveValue(/WebUSB \(navigator\.usb\): ASSENTE/);
  await expect(page.getByTestId('cerca')).toBeDisabled();
});

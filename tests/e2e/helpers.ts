/**
 * Aiuti comuni dei test e2e (Pixel 7a, stampante simulata con `?sim`).
 * Vedi docs/2026-11-06-manutenibilita.md.
 */
import { expect, test as base, type Page } from '@playwright/test';

/**
 * `test` di Playwright con un controllo automatico: qualunque errore JavaScript
 * o avviso di Vue nella console della pagina fa fallire il test.
 */
export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' || (m.type() === 'warning' && m.text().includes('[Vue warn]'))) {
          problems.push(`${m.type()}: ${m.text()}`);
        }
      });
      await use();
      expect(problems, 'errori nella console della pagina').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export async function noHorizontalScroll(page: Page): Promise<void> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, 'scorrimento orizzontale').toBeLessThanOrEqual(client);
}

export interface ConnectOptions {
  /** Guasto della stampante simulata (valore del menu «Guasto»), prima di collegare. */
  fault?: string;
  /** Aspetta lo stato «Pronta» (predefinito: sì, se non c'è un guasto). */
  waitForReady?: boolean;
  /** Aspetta che l'etichetta vuota prenda il formato del rotolo simulato (Indirizzo 28×89 mm). */
  waitForRoll?: boolean;
}

/** Apre `/?sim`, imposta l'eventuale guasto e collega la stampante simulata. */
export async function connectSimulated(page: Page, opts: ConnectOptions = {}): Promise<void> {
  await page.goto('/?sim');
  if (opts.fault && opts.fault !== 'none') {
    const panel = page.getByTestId('dev-panel');
    await panel.locator('summary').tap();
    await panel.getByLabel('Guasto').selectOption(opts.fault);
    await panel.locator('summary').tap();
  }
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Scollega', exact: true })).toBeVisible();
  const noFault = !opts.fault || opts.fault === 'none';
  if (opts.waitForReady ?? noFault) await expect(page.getByRole('status').first()).toContainText('Pronta');
  if (opts.waitForRoll) await expect(page.getByTestId('media-chip')).toContainText('Indirizzo 28×89 mm');
}

/** «+ Testo», scrive il testo e chiude il pannello con «Fine». */
export async function writeText(page: Page, text: string): Promise<void> {
  await page.getByTestId('add-text').tap();
  // In orizzontale sul telefono la casella non si attiva da sola.
  await page.getByTestId('text-input').tap();
  await page.keyboard.type(text);
  await page.getByTestId('text-done').tap();
}

/** Lavori ricevuti dalla stampante simulata. */
export function expectJobs(page: Page, n: number): Promise<void> {
  return expect(page.getByTestId('dev-panel')).toContainText(`lavori ricevuti: ${n}`);
}

/** navigator.share finto: registra titolo e testo; `cancel` simula la chiusura del menu. */
export async function fakeShare(page: Page, opts: { cancel?: boolean } = {}): Promise<void> {
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

/** Contenuti passati a navigator.share finto. */
export function shared(page: Page): Promise<{ title?: string; text?: string }[]> {
  return page.evaluate(() => (window as unknown as { __shared: { title?: string; text?: string }[] }).__shared);
}

/** navigator.clipboard finto: ricorda l'ultimo testo copiato (vedi `copied`). */
export async function fakeClipboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'clipboard', {
      configurable: true,
      get: () => ({ writeText: async (t: string) => void ((window as unknown as { __copied: string }).__copied = t) }),
    });
  });
}

/** Ultimo testo copiato con navigator.clipboard finto. */
export function copied(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __copied?: string }).__copied ?? '');
}

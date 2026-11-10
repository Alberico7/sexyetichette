/**
 * App installabile, parte che si prova anche in sviluppo: tasto indietro e avviso
 * di aggiornamento (simulato con `?sim`). Vedi docs/2026-11-10-pwa.md.
 */
import type { Page } from '@playwright/test';
import type { Stage } from 'konva/lib/Stage';
import { test, expect, connectSimulated, writeText, type SimWindow } from './helpers';

const marked = (page: Page) =>
  page.evaluate(() => !!(history.state as Record<string, unknown> | null)?.rubeculabelPanel);

test('indietro chiude ogni pannello e l’app resta aperta', async ({ page }) => {
  await connectSimulated(page);
  const url = page.url();
  const panels: [string, () => Promise<void>][] = [
    ['Formato etichetta', () => page.getByTestId('media-chip').tap()],
    ['Recenti', () => page.getByTestId('open-recent').tap()],
    ['Diagnostica', () => page.getByTestId('bar-diagnostics').tap()],
    ['Anteprima e stampa', () => page.getByTestId('open-preview').tap()],
    ['Quante copie?', () => page.getByTestId('open-copies').tap()],
  ];
  for (const [title, open] of panels) {
    await open();
    const sheet = page.getByRole('dialog', { name: title });
    await expect(sheet).toBeVisible();
    await page.goBack();
    await expect(sheet, `«${title}» chiuso da indietro`).toBeHidden();
    expect(page.url(), 'ancora nell’app').toBe(url);
  }
  // Pannello del testo: indietro lo chiude (e un testo vuoto sparisce, come con «Fine»).
  await page.getByTestId('add-text').tap();
  await expect(page.getByTestId('text-panel')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('text-panel')).toHaveCount(0);
  expect(page.url()).toBe(url);
});

test('chiudendo con Fine o ✕ il passo di cronologia si toglie', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Ciao');
  expect(await marked(page), 'pannello aperto: passo aggiunto').toBe(true);
  await page.getByTestId('text-done').tap();
  await expect.poll(() => marked(page), 'Fine: passo tolto').toBe(false);
  await page.getByTestId('media-chip').tap();
  await page.getByRole('dialog', { name: 'Formato etichetta' }).getByRole('button', { name: 'Chiudi' }).tap();
  await expect.poll(() => marked(page), '✕: passo tolto').toBe(false);
});

test('stampa rapida dal testo con un avviso: l’anteprima resta aperta', async ({ page }) => {
  // Il pannello del testo si chiude e subito si apre l'anteprima: l'«indietro» dell'app
  // per togliere il passo del testo non deve chiudere l'anteprima.
  await connectSimulated(page, { waitForRoll: true });
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Lunghissimo '.repeat(40));
  await page.getByTestId('text-print').tap();
  const preview = page.getByRole('dialog', { name: 'Anteprima e stampa' });
  await expect(preview).toBeVisible();
  await page.waitForTimeout(300);
  await expect(preview).toBeVisible();
  // E «indietro» la chiude.
  await page.goBack();
  await expect(preview).toBeHidden();
});

/** Testi disegnati sull'etichetta. */
const labelTexts = (page: Page) =>
  page.evaluate(() => {
    const stage = (window as unknown as SimWindow).__sim.labelStage as Stage;
    return (stage?.find('Text') ?? []).map((n) => (n as unknown as { text(): string }).text());
  });

test('versione nuova: compare «Aggiorna», la pagina si ricarica e il testo resta', async ({ page }) => {
  await connectSimulated(page);
  await writeText(page, 'Resta qui');
  await expect.poll(() => labelTexts(page)).toContain('Resta qui');
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as { __prima: boolean }).__prima = true;
    (window as unknown as SimWindow).__sim.update!();
  });
  await expect(page.getByTestId('update-banner')).toContainText('Nuova versione disponibile');
  await page.screenshot({ path: 'test-results/42-aggiorna.png' });
  await Promise.all([page.waitForEvent('load'), page.getByTestId('update-apply').tap()]);
  await expect(page.getByTestId('status-logo')).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { __prima?: boolean }).__prima),
    'pagina ricaricata',
  ).toBeUndefined();
  await expect(page.getByTestId('update-banner')).toHaveCount(0);
  await expect.poll(() => labelTexts(page), 'testo ancora sull’etichetta').toContain('Resta qui');
});

test('le barre di Android hanno il colore dei pannelli, anche col tema scuro', async ({ page }) => {
  const meta = () => page.locator('meta[name="theme-color"]').getAttribute('content');
  await page.goto('/?sim');
  expect(await meta()).toBe('#f8f6f1');
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  expect(await meta()).toBe('#24272c');
});

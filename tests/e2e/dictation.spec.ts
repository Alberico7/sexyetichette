/**
 * Dettatura nella casella del testo, con il riconoscitore simulato (`?sim`).
 * Vedi docs/2026-11-10-dettatura.md.
 */
import type { Page } from '@playwright/test';
import { test, expect, connectSimulated } from './helpers';

/** Frasi che il riconoscitore simulato «sentirà», una per pressione. */
async function willHear(page: Page, ...phrases: string[]) {
  await page.evaluate((p) => ((window as unknown as { __simVoice: string[] }).__simVoice = p), phrases);
}

/** Tiene premuto il microfono, aspetta il testo provvisorio e lascia. */
async function dictate(page: Page, partial: string) {
  const mic = page.getByTestId('dictate');
  await mic.scrollIntoViewIfNeeded();
  const box = (await mic.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(mic).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('dictation-status')).toHaveText(partial);
  await page.mouse.up();
}

test('la prima volta chiede di scaricare il modello; poi detta al cursore, in maiuscolo', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');

  // Prima pressione: conferma dello scaricamento, niente ascolto.
  await page.getByTestId('dictate').tap();
  await expect(page.getByTestId('dictation-confirm')).toContainText('50 MB');
  await page.getByTestId('dictation-cancel').tap();
  await expect(page.getByTestId('dictation-confirm')).toBeHidden();
  await page.getByTestId('dictate').tap();
  await page.getByTestId('dictation-download').tap();
  await expect(page.getByTestId('dictation-status')).toHaveText('Pronto: tieni premuto e parla.');

  await willHear(page, 'tubo diametro iso venti virgola cinquanta', 'a capo pompa non riparabile');
  await dictate(page, 'tubo diametro');
  await expect(input).toHaveValue('TUBO ⌀20,50');
  await page.screenshot({ path: 'test-results/41-dettatura.png' });
  await dictate(page, 'a capo');
  await expect(input).toHaveValue('TUBO ⌀20,50\nPOMPA NON\nRIPARABILE');

  await page.getByTestId('text-done').tap();
  await expect(page.getByTestId('dictate')).toBeHidden();
});

test('con il modello già scaricato non chiede niente; aggiunge uno spazio dopo il testo scritto', async ({ page }) => {
  await page.addInitScript(
    () => ((window as unknown as { __simVoiceDownloaded: boolean }).__simVoiceDownloaded = true),
  );
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Flangia');
  await willHear(page, 'diametro dodici punto settantacinque');
  await dictate(page, 'diametro dodici');
  await expect(page.getByTestId('text-input')).toHaveValue('Flangia ∅12.75');
  await expect(page.getByTestId('dictation-confirm')).toBeHidden();
  // Il testo dettato va anche nell'etichetta.
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
});

test('riconoscimento lento: avviso del JIT di Vanadium', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __simVoiceDownloaded: boolean; __simVoiceDelayMs: number };
    w.__simVoiceDownloaded = true;
    w.__simVoiceDelayMs = 2000;
  });
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await willHear(page, 'scarto');
  await dictate(page, 'scarto');
  await expect(page.getByTestId('text-input')).toHaveValue('AFKEUR');
  await expect(page.getByTestId('dictation-status')).toContainText('JavaScript JIT');
});

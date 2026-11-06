import { test, expect, noHorizontalScroll, connectSimulated } from './helpers';
import type { Page } from '@playwright/test';

const jobs = (page: Page) => page.getByTestId('dev-panel').locator('summary');

/** Scrive un testo nuovo e lo stampa (1 copia). */
async function writeAndPrint(page: Page, text: string): Promise<void> {
  await page.getByTestId('add-text').tap();
  await page.keyboard.type(text);
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
}

test('l’etichetta resta dopo aver ricaricato la pagina', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Tubo 20 AFKEUR');
  await page.getByTestId('text-done').tap();
  // Salvataggio automatico dopo mezzo secondo.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('etichettatrice.etichetta') ?? ''))
    .toContain('Tubo 20 AFKEUR');

  await page.reload();
  await expect(page.getByText('Tocca «+ Testo» per scrivere')).toHaveCount(0);
  // Nessun testo selezionato e pannello Testo chiuso.
  await expect(page.getByTestId('text-panel')).toHaveCount(0);
  await expect(page.getByTestId('open-recent')).toBeVisible();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('empty-warning')).toHaveCount(0);
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
});

test('salvata subito quando l’app va in sottofondo', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Sottofondo');
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => localStorage.getItem('etichettatrice.etichetta') ?? '')).toContain('Sottofondo');
});

test('recenti: compaiono dopo la stampa, si riaprono e non hanno doppioni', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('open-recent').tap();
  await expect(page.getByTestId('recent-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();

  await writeAndPrint(page, 'Primo');
  await page.getByTestId('open-recent').tap();
  // Il pannello copre l'avviso della stampa: l'avviso sparisce.
  await expect(page.getByTestId('toast')).toHaveCount(0);
  const items = page.getByTestId('recent-item');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Primo');
  await expect(items.first()).toContainText('oggi');
  await expect(items.first().locator('img')).toHaveAttribute('src', /^data:image\/png/);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();

  // Stessa etichetta ristampata: nessun doppione.
  await page.getByTestId('open-preview').tap();
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toBeVisible();
  await page.getByTestId('open-recent').tap();
  await expect(items).toHaveCount(1);
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();

  // Etichetta diversa: due righe, la più recente in cima.
  await writeAndPrint(page, 'Secondo');
  await page.getByTestId('open-recent').tap();
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText('Primo · Secondo');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/30-recenti.png' });

  // Un tocco sulla seconda riga riapre l'etichetta con il solo «Primo».
  await items.nth(1).getByTestId('recent-open').tap();
  await expect(page.getByRole('dialog', { name: 'Recenti' })).toHaveCount(0);
  await page.getByTestId('open-recent').tap();
  await items.nth(1).getByTestId('recent-reprint').tap();
  // «Ristampa» della riga apre l'anteprima con quell'etichetta.
  await expect(page.getByRole('dialog', { name: 'Anteprima e stampa' })).toBeVisible();
  await expect(page.getByTestId('print-button')).toHaveText('Stampa');

  // Togli una riga; poi svuota con conferma.
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.getByTestId('open-recent').tap();
  await items.first().getByTestId('recent-remove').tap();
  await expect(items).toHaveCount(1);
  await page.getByTestId('recent-clear').tap();
  await page.getByTestId('recent-clear-confirm').tap();
  await expect(page.getByTestId('recent-empty')).toBeVisible();
});

test('recenti ricordate dopo aver ricaricato la pagina', async ({ page }) => {
  await connectSimulated(page);
  await writeAndPrint(page, 'Ricordata');
  await page.reload();
  await page.getByTestId('open-recent').tap();
  await expect(page.getByTestId('recent-item')).toHaveCount(1);
  await expect(page.getByTestId('recent-item').first()).toContainText('Ricordata');
});

test('dopo la stampa l’etichetta resta: ristampa con «Stampa» → «Stampa»', async ({ page }) => {
  await connectSimulated(page);
  await writeAndPrint(page, 'Di nuovo');
  await expect(jobs(page)).toContainText('lavori ricevuti: 1');
  // L'avviso è solo informativo, senza pulsanti.
  await expect(page.getByTestId('toast').getByRole('button')).toHaveCount(0);
  await page.getByTestId('open-preview').tap();
  await page.getByTestId('print-button').tap();
  await expect(jobs(page)).toContainText('lavori ricevuti: 2');
});

test('etichetta salvata con misura arrotondata: prende la misura vera del rotolo letto', async ({ page }) => {
  // Il rotolo simulato è 30252 (indirizzo 28×89 mm).
  await connectSimulated(page);
  await expect(page.getByTestId('media-chip')).toContainText('Indirizzo 28×89 mm');
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Misura');
  await page.getByTestId('text-done').tap();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('etichettatrice.etichetta') ?? ''))
    .toContain('Misura');
  // Come se fosse stata salvata con la misura arrotondata del catalogo.
  await page.evaluate(() => {
    const doc = JSON.parse(localStorage.getItem('etichettatrice.etichetta')!) as { media: { widthMm: number } };
    doc.media.widthMm = 27.6;
    localStorage.setItem('etichettatrice.etichetta', JSON.stringify(doc));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByRole('status').first()).toContainText('Pronta');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (JSON.parse(localStorage.getItem('etichettatrice.etichetta')!) as { media: { widthMm: number } }).media
            .widthMm,
      ),
    )
    .toBe(28);
  // Il testo resta e nessun avviso di rotolo diverso.
  expect(await page.evaluate(() => localStorage.getItem('etichettatrice.etichetta'))).toContain('Misura');
});

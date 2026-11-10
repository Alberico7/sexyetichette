/**
 * Pagina di prova della dettatura (docs/2026-11-10-prova-dettatura.md).
 * I modelli NON vengono scaricati: si controllano la pagina e la separazione dall'app.
 */
import { test, expect, noHorizontalScroll, fakeClipboard, copied } from './helpers';

const HEAVY = /transformers|onnxruntime|ort-wasm|vosk|fflate|huggingface\.co|whisper-worker/i;

test('la pagina si apre, mostra il browser e non scarica nessun modello', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await fakeClipboard(page);
  await page.goto('./prova-voce.html');
  const info = page.getByTestId('info');
  await expect(info).toContainText('Core del processore');
  await expect(info).toContainText('Scheda grafica (WebGPU)');
  await expect(info).toContainText('Riconoscimento del browser');
  // Whisper base preselezionato, con la dimensione da scaricare.
  await expect(page.getByTestId('engine')).toHaveValue('whisper-base');
  await expect(page.getByTestId('size')).toContainText('77 MB');
  await page.getByTestId('dtype').selectOption('fp16');
  await expect(page.getByTestId('size')).toContainText('146 MB');
  // Con Vosk spariscono le opzioni di Whisper.
  await page.getByTestId('engine').selectOption('vosk');
  await expect(page.getByTestId('device')).toBeHidden();
  await expect(page.getByTestId('size')).toContainText('50 MB');
  // Senza modello non si può parlare.
  await expect(page.getByTestId('talk')).toBeDisabled();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/40-prova-voce.png', fullPage: true });

  await page.getByTestId('copy').tap();
  const text = await copied(page);
  expect(text).toContain('prova dettatura');
  expect(text).toContain('Core del processore');
  expect(text).toContain('Prove (0)');

  expect(requests.filter((u) => HEAVY.test(u))).toEqual([]);
});

test('la pagina scorre (lo scorrimento passa dal corpo della pagina alla finestra)', async ({ page }) => {
  // Su Vanadium scorreva solo con due dita: body era un riquadro scorrevole con
  // overscroll-behavior: none (dall'app) e non passava lo scorrimento alla pagina.
  await page.goto('./prova-voce.html');
  await expect(page.getByTestId('info')).toContainText('Core del processore');
  await page.mouse.move(200, 150);
  await page.mouse.wheel(0, 400);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});

test("l'app non carica le librerie della dettatura", async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/?sim');
  await expect(page.getByTestId('status-logo')).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(requests.filter((u) => HEAVY.test(u))).toEqual([]);
});

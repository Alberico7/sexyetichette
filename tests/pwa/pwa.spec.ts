/**
 * App installabile, sulla build di produzione (con il service worker vero).
 * Vedi docs/2026-11-10-pwa.md.
 */
import { expect, test } from '@playwright/test';

test('il service worker si registra e conserva solo i file dell’app', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('status-logo')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const c = await caches.open(name);
      for (const r of await c.keys()) urls.push(new URL(r.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain('/index.html');
  expect(
    cached.some((u) => /\/assets\/main-.*\.js$/.test(u)),
    'codice dell’app',
  ).toBe(true);
  expect(
    cached.some((u) => /noto-sans|osifont/.test(u)),
    'caratteri',
  ).toBe(true);
  // Né la pagina di prova né Whisper e Vosk.
  expect(cached.filter((u) => /prova-voce|whisper|ort-wasm|vosk/.test(u))).toEqual([]);
});

test('senza rete l’app si riapre, si scrive un testo e l’anteprima funziona', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Seconda apertura: la pagina è ora controllata dal service worker.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('status-logo')).toBeVisible();
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Senza rete');
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  // Il carattere ISO arriva dalla cache: l'anteprima è disegnata, con il testo in nero.
  await expect
    .poll(() =>
      page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
        let dark = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i]! < 100 && d[i + 3]! > 0) dark++;
        return dark;
      }),
    )
    .toBeGreaterThan(100);
  await context.setOffline(false);
});

test('il manifest apre l’app a schermo intero col nuovo nome', async ({ page }) => {
  const res = await page.request.get('/manifest.webmanifest');
  const m = (await res.json()) as { name: string; short_name: string; display: string };
  expect(m).toMatchObject({ name: 'Rubeculabel – etichette', short_name: 'Rubeculabel', display: 'standalone' });
  await page.goto('/');
  await expect(page).toHaveTitle('Rubeculabel');
});

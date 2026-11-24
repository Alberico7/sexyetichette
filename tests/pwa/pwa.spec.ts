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
  // Lo script principale che la pagina carica davvero (il nome cambia con la build).
  const entry = await page.evaluate(
    () => new URL(document.querySelector<HTMLScriptElement>('script[type=module]')!.src).pathname,
  );
  expect(cached, 'codice dell’app').toContain(entry);
  expect(
    cached.some((u) => /noto-sans|osifont/.test(u)),
    'caratteri',
  ).toBe(true);
  // Non Vosk: si conserva al primo uso del microfono.
  expect(cached.filter((u) => /vosk/.test(u))).toEqual([]);
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

test('modello della dettatura all’indirizzo fisso: solo dalla cache, anche per un worker blob:', async ({ page }) => {
  // Vedi docs/2026-11-24-vosk-copie-del-modello.md.
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  /** Il worker di Vosk nasce da un indirizzo blob:: qui uno uguale, che chiede il modello. */
  const fetchFromBlobWorker = () =>
    page.evaluate(async () => {
      const url = new URL('./vosk-model-small-it-0.22.tar.gz', location.href).href;
      const code = `fetch(${JSON.stringify(url)}).then(async (r) => postMessage({ status: r.status, text: await r.text() }), (e) => postMessage({ failed: String(e) }))`;
      const w = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      type Out = { status?: number; text?: string; failed?: string };
      const out = await new Promise<Out>((r) => (w.onmessage = (e: MessageEvent<Out>) => r(e.data)));
      w.terminate();
      return out;
    });

  // Senza modello in cache: la richiesta fallisce, senza arrivare al server
  // (il server risponderebbe con una pagina, non con un errore di rete).
  const missing = await fetchFromBlobWorker();
  expect(missing.failed, JSON.stringify(missing)).toBeTruthy();
  // Il server invece risponde (pagina o 404): l'errore viene dal service worker.
  const direct = await page.request.get('/vosk-model-small-it-0.22.tar.gz');
  expect(direct.status()).toBeGreaterThan(0);
  expect(await direct.text()).not.toBe('MODELLO-FINTO');

  // Con un modello (finto) nella cache della dettatura, risponde quello.
  await page.evaluate(async () => {
    const c = await caches.open('etichettatrice-prova-voce');
    await c.put('./vosk-model-small-it-0.22.tar.gz', new Response('MODELLO-FINTO'));
  });
  const found = await fetchFromBlobWorker();
  expect(found).toEqual({ status: 200, text: 'MODELLO-FINTO' });
});

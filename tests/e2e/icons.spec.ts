/**
 * Icone e manifest: file dichiarati, tipi, dimensioni, icona ritagliabile nella zona sicura.
 * Vedi docs/2026-11-07-icona-pettirosso.md e docs/2026-11-07-icona-ritagliabile.md.
 */
import { test, expect } from './helpers';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

test('icone della pagina: i file dichiarati esistono con il tipo giusto', async ({ page }) => {
  await page.goto('/');
  const icons = await page
    .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
    .evaluateAll((links) => links.map((l) => (l as HTMLLinkElement).href));
  expect(icons).toHaveLength(3);
  for (const href of icons) {
    const res = await page.request.get(href);
    expect(res.status(), href).toBe(200);
    expect(res.headers()['content-type'], href).toMatch(href.endsWith('.svg') ? /image\/svg\+xml/ : /image\/png/);
  }
});

test('manifest: nome, apertura nel browser, icone normali e ritagliabili', async ({ page }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').evaluate((l) => (l as HTMLLinkElement).href);
  const res = await page.request.get(href);
  expect(res.status()).toBe(200);
  const manifest = (await res.json()) as { name: string; display: string; icons: ManifestIcon[] };
  expect(manifest.name).toBe('Etichettatrice');
  expect(manifest.display).toBe('browser');
  expect(manifest.icons.some((i) => i.purpose === 'any')).toBe(true);
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  for (const icon of manifest.icons) {
    const url = new URL(icon.src, href).href;
    const r = await page.request.get(url);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()['content-type'], icon.src).toContain(icon.type);
    if (icon.sizes === 'any') continue;
    const size = await page.evaluate(async (u) => {
      const img = new Image();
      img.src = u;
      await img.decode();
      return `${img.naturalWidth}x${img.naturalHeight}`;
    }, url);
    expect(size, icon.src).toBe(icon.sizes);
  }
});

test('icona ritagliabile: fuori dalla zona sicura di Android (raggio 30,5 %) c’è solo il fondo', async ({ page }) => {
  await page.goto('/');
  const outside = await page.evaluate(async () => {
    const img = new Image();
    img.src = 'icona-ritagliabile-512.png';
    await img.decode();
    const n = img.naturalWidth;
    const ctx = Object.assign(document.createElement('canvas'), { width: n, height: n }).getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, n, n);
    const bg = [0x27, 0x4e, 0x76];
    // Android mostra i 72dp centrali di 108dp; la zona sicura è un cerchio di 66dp (61 %).
    const safe = n * 0.305;
    let count = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) <= safe) continue;
        const i = (y * n + x) * 4;
        if (bg.some((c, k) => Math.abs(data[i + k]! - c) > 2)) count++;
      }
    return count;
  });
  expect(outside).toBe(0);
});

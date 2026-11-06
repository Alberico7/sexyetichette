import { expect, test } from '@playwright/test';

/**
 * Prestazioni sulla build di produzione, con la CPU rallentata 4 volte
 * (margine rispetto a un telefono di fascia media). Obiettivi dal documento
 * docs/2026-11-02-interfaccia-piu-veloce.md.
 */
test('digitazione fluida e anteprima immediata', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('/');
  await page.getByTestId('add-text').waitFor();
  // Lascia terminare il caricamento in sottofondo del driver.
  await page.waitForTimeout(1500);

  // Costo del solo tocco nello strumento di test: apertura di un pannello senza calcoli.
  let t = Date.now();
  await page.getByTestId('media-chip').tap();
  await page.getByRole('dialog', { name: 'Formato etichetta' }).waitFor();
  const tapBaselineMs = Date.now() - t;
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const w = window as unknown as { __lt: number[] };
    w.__lt = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__lt.push(Math.round(e.duration));
    }).observe({ type: 'longtask' });
  });
  const longTasks = () =>
    page.evaluate(() => (window as unknown as { __lt: number[] }).__lt.splice(0));

  await page.getByTestId('add-text').tap();
  await page.waitForTimeout(500);
  await longTasks();

  // Digitazione: un carattere ogni 120 ms, come una persona veloce.
  await page.keyboard.type('Barattolo zucchero di canna', { delay: 120 });
  await page.waitForTimeout(800); // anteprima in sottofondo
  const typing = await longTasks();

  await page.getByTestId('text-done').tap();
  t = Date.now();
  await page.getByTestId('open-preview').tap();
  await page.waitForFunction(() => {
    const c = document.querySelector('[data-testid=preview-canvas]') as HTMLCanvasElement | null;
    return !!c && c.width === 638 && !document.body.textContent?.includes('Aggiornamento anteprima');
  });
  const openPreviewMs = Date.now() - t;
  const preview = await longTasks();

  console.log(JSON.stringify({ tapBaselineMs, typing, openPreviewMs, preview }));
  // Digitazione: al massimo 2 blocchi oltre 50 ms su 27 tasti, nessuno oltre 80 ms (CPU ×4).
  expect(typing.filter((d) => d > 50).length, 'blocchi oltre 50 ms durante la digitazione').toBeLessThanOrEqual(2);
  expect(Math.max(0, ...typing), 'blocco più lungo durante la digitazione (ms)').toBeLessThanOrEqual(80);
  // Anteprima: meno di 150 ms oltre il costo del tocco, nessun blocco oltre 80 ms.
  expect(openPreviewMs - tapBaselineMs, 'apertura anteprima oltre il tocco (ms)').toBeLessThan(150);
  expect(Math.max(0, ...preview), 'blocco più lungo all’apertura dell’anteprima (ms)').toBeLessThanOrEqual(80);
});

import { test, expect, noHorizontalScroll, connectSimulated } from './helpers';

test('layout su Pixel 7a senza scorrimento orizzontale', async ({ page }) => {
  await page.goto('/?sim');
  await expect(page.getByRole('button', { name: 'Collega', exact: true })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/01-avvio.png' });

  await page.getByTestId('media-chip').tap();
  await expect(page.getByRole('dialog', { name: 'Formato etichetta' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/02-formati.png' });
});

test('collegamento, testo, anteprima e stampa (simulata)', async ({ page }) => {
  await connectSimulated(page);
  // Il rotolo letto via NFC (simulato: 30252) diventa il formato dell'etichetta.
  await expect(page.getByTestId('media-chip')).toContainText('Indirizzo 28×89 mm');

  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('Barattolo zucchero');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/03-testo.png' });
  await page.getByTestId('text-done').tap();
  await page.screenshot({ path: 'test-results/04-editor.png' });

  await page.getByTestId('open-preview').tap();
  const preview = page.getByTestId('preview-canvas');
  await expect(preview).toBeVisible();
  await expect.poll(async () => preview.evaluate((c: HTMLCanvasElement) => c.width)).toBe(1051);
  await page.getByRole('button', { name: 'Una copia in più' }).tap();
  await page.getByRole('button', { name: 'Scura' }).tap();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/05-anteprima.png' });

  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampate 2 copie ✓');
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
});

test('rotolo rilevato diverso dal formato predefinito viene adottato', async ({ page }) => {
  await page.goto('/?sim');
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('SKU rotolo').fill('S0722540');
  await panel.getByLabel('SKU rotolo').blur();
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  await expect(page.getByTestId('media-chip')).toContainText('Multiuso media removibile');
});

test('selettore chiuso senza scelta: messaggio in italiano con suggerimento GrapheneOS', async ({ page }) => {
  await page.goto('/?sim');
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Selettore USB').selectOption('cancel');
  await page.getByRole('button', { name: 'Collega', exact: true }).tap();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Nessuna stampante selezionata');
  await expect(alert).toContainText('GrapheneOS');
  await noHorizontalScroll(page);
});

test('coperchio aperto: stato in rosso e stampa disabilitata', async ({ page }) => {
  await connectSimulated(page);
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Guasto').selectOption('cover-open');
  await expect(page.getByRole('status').first()).toContainText('Coperchio aperto');
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Prova');
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('print-button')).toBeDisabled();
  await page.screenshot({ path: 'test-results/06-coperchio.png' });
});

test('stampante occupata durante la stampa: errore e pulsante di ripristino', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Prova');
  await page.getByTestId('text-done').tap();
  const panel = page.getByTestId('dev-panel');
  await panel.locator('summary').tap();
  await panel.getByLabel('Guasto').selectOption('busy');
  await page.getByTestId('open-preview').tap();
  await page.getByTestId('print-button').tap();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Stampante occupata');
  await alert.getByRole('button', { name: 'Ripristina stampante' }).tap();
  await expect(alert).toHaveCount(0);
});

test('tema: automatico → chiaro → scuro, la scelta resta dopo il ricaricamento', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/?sim');
  const toggle = page.getByTestId('theme-toggle');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await expect(toggle).toHaveAttribute('data-theme-pref', 'auto');
  const lightBg = await bg();

  await toggle.tap();
  await expect(toggle).toHaveAttribute('data-theme-pref', 'light');
  await toggle.tap();
  await expect(toggle).toHaveAttribute('data-theme-pref', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).not.toBe(lightBg);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#24272c');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('data-theme-pref', 'dark');
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.getByTestId('text-input').fill('Tubo Ø 20');
  await page.getByTestId('text-done').tap();
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/07-tema-scuro.png' });

  await toggle.tap();
  await expect(toggle).toHaveAttribute('data-theme-pref', 'auto');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
});

test('tema automatico segue il sistema', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/?sim');
  const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(dark).not.toBe(light);
});

test('pulsante diametro: inserisce ⌀ nella posizione del cursore', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('Tubo 20 mm');
  // Cursore dopo "Tubo ".
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  await page.getByTestId('insert-diameter').tap();
  await expect(input).toHaveValue('Tubo ⌀20 mm');
  // Due pulsanti per il diametro: «⌀ ISO» (75°) e «∅ 45°» (docs/2026-11-09-diametro-45.md).
  await expect(page.getByRole('button', { name: /diametro/i })).toHaveCount(2);
  await expect(page.getByTestId('insert-diameter')).toHaveText('⌀ ISO');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(6);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/08-diametro.png' });

  // Il simbolo arriva nell'anteprima di stampa.
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect
    .poll(async () => page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBe(638);
});

test('pulsante ∅ 45°: inserisce il diametro a 45° al cursore, disegnato dal mini-font', async ({ page }) => {
  // Vedi docs/2026-11-09-diametro-45.md.
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('Tubo 20 mm');
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
  const button = page.getByTestId('insert-diameter-45');
  await expect(button).toHaveText('∅ 45°');
  await expect(button).toHaveAccessibleName('Inserisci il simbolo del diametro con la barra a 45°');
  await button.tap();
  await expect(input).toHaveValue('Tubo ∅20 mm');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(6);
  // Sul pulsante il simbolo viene dal mini-font dell'app, come in stampa.
  const symbolFont = await button.locator('.symbol').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(symbolFont).toContain('Etichettatrice Diametro UI');
  // Il browser l'ha davvero scaricato per disegnare la pagina (senza caricarlo a mano).
  await expect
    .poll(() =>
      page.evaluate(() => [...document.fonts].find((f) => f.family.includes('Diametro UI'))?.status ?? 'assente'),
    )
    .toBe('loaded');
  await noHorizontalScroll(page);
  await page.locator('.symbols').screenshot({ path: 'test-results/29-diametro-45.png' });

  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
});

test('pulsante AFKEUR: inserisce la parola nella posizione del cursore', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('Tubo 20 ');
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(8, 8));
  await page.getByTestId('insert-reject').tap();
  await expect(input).toHaveValue('Tubo 20 AFKEUR');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(14);
  // Accanto al pulsante del diametro, sulla stessa riga.
  const d = await page.getByTestId('insert-diameter').boundingBox();
  const r = await page.getByTestId('insert-reject').boundingBox();
  expect(Math.abs((d?.y ?? 0) - (r?.y ?? 1))).toBeLessThan(2);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/18-afkeur.png' });

  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect
    .poll(async () => page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBe(638);
  await expect(page.getByTestId('empty-warning')).toHaveCount(0);
});

test('pulsante N.R.: inserisce NON RIPARABILE su due righe', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  const button = page.getByTestId('insert-unrepairable');
  await expect(button).toHaveText('N.R.');
  await expect(button).toHaveAccessibleName('Inserisci NON RIPARABILE su due righe');
  await button.tap();
  await expect(input).toHaveValue('NON\nRIPARABILE');
  expect(await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(14);

  // Quattro pulsanti sulla stessa riga; la scritta non è tagliata.
  const boxes = await Promise.all(
    ['insert-diameter', 'insert-diameter-45', 'insert-reject', 'insert-unrepairable'].map((id) =>
      page.getByTestId(id).boundingBox(),
    ),
  );
  for (const b of boxes) expect(Math.abs((b?.y ?? 0) - (boxes[0]?.y ?? 1))).toBeLessThan(2);
  expect(await button.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/19-non-riparabile.png' });

  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('empty-warning')).toHaveCount(0);
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
});

test('adattamento automatico: attivo sui nuovi testi, la dimensione segue il testo', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const toggle = page.getByTestId('auto-fit');
  const size = page.getByTestId('font-size');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('text-input').fill('Corto');
  const short = Number(await size.inputValue());
  await page.getByTestId('text-input').fill('Un testo decisamente più lungo');
  await expect.poll(async () => Number(await size.inputValue())).toBeLessThan(short);
  const fitted = Number(await size.inputValue());
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/09-adatta.png' });

  // Disattivando, la dimensione riparte da quella calcolata ed è modificabile.
  await toggle.tap();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(Number(await size.inputValue())).toBe(fitted);

  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect
    .poll(async () => page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => c.width))
    .toBe(638);
});

test('simbolo del diametro ISO nell’anteprima', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await input.fill('20');
  await input.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(0, 0));
  await page.getByTestId('insert-diameter').tap();
  await expect(input).toHaveValue('⌀20');
  await input.fill('⌀ 20 · H');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/12-diametro-iso.png' });
  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/13-diametro-iso-anteprima.png' });
});

test('ricerca del codice europeo S0722520 nell’elenco dei formati', async ({ page }) => {
  await page.goto('/?sim');
  await page.getByTestId('media-chip').tap();
  await page.getByLabel('Cerca formato o codice').fill('S0722520');
  const options = page.getByRole('listbox', { name: 'Formati' }).getByRole('option');
  await expect(options).toHaveCount(1);
  await expect(options.first()).toContainText('Multiuso piccola 25×54 mm');
  await expect(options.first()).toContainText('S0722520, 11352');
  await page.getByLabel('Cerca formato o codice').fill('2223589');
  await expect(options).toHaveCount(1);
  await noHorizontalScroll(page);
});

test('carattere «Noto Sans (simile a Segoe UI)»: scaricato solo quando si sceglie, usato in stampa', async ({
  page,
}) => {
  // Vedi docs/2026-11-09-carattere-noto-sans.md.
  const notoRequests: string[] = [];
  page.on('request', (r) => {
    // Solo i file del font (in sviluppo Vite chiede anche i moduli «?import&url», che non lo scaricano).
    if (r.url().includes('noto-sans') && !r.url().includes('?import')) notoRequests.push(r.url());
  });
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Tubo ⌀20 1234');
  expect(notoRequests, 'non scaricato all’avvio').toEqual([]);
  await page.getByTestId('more-options').locator('summary').tap();
  await page.getByLabel('Carattere').selectOption({ label: 'Noto Sans (simile a Segoe UI)' });
  // Il testo è in grassetto (default): si scarica il grassetto.
  await expect.poll(() => notoRequests.some((u) => u.includes('700-normal'))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.fonts.check('bold 20px "Etichettatrice Noto Sans"'))).toBe(true);
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/42-carattere-noto.png' });

  await page.getByTestId('text-done').tap();
  await page.getByTestId('open-preview').tap();
  await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/43-anteprima-noto.png' });
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');

  // La scelta resta sul testo.
  const box = (await page.getByTestId('editor').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByTestId('edit-selected').tap();
  await page.getByTestId('more-options').locator('summary').tap();
  await expect(page.getByLabel('Carattere').locator('option:checked')).toHaveText('Noto Sans (simile a Segoe UI)');
});

test('carattere «Tecnico ISO 3098»: predefinito, scaricato all’avvio e usato in stampa', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('osifont')) fontRequests.push(r.url());
  });
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Tubo ⌀20 AFKEUR');
  await page.getByTestId('more-options').locator('summary').tap();
  const select = page.getByLabel('Carattere');
  await expect(select.locator('option:checked')).toHaveText('Tecnico ISO 3098');
  await noHorizontalScroll(page);
  await page.screenshot({ path: 'test-results/40-carattere-iso.png' });
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.check('20px "Etichettatrice ISO 3098"'))).toBe(true);

  // Anteprima con il carattere ISO diversa da quella «Senza grazie».
  const previewPixels = async () => {
    await page.getByTestId('text-done').tap();
    await page.getByTestId('open-preview').tap();
    const canvas = page.getByTestId('preview-canvas');
    await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
    const data = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
    return data;
  };
  const iso = await previewPixels();
  await page.screenshot({ path: 'test-results/41-anteprima-iso.png' });
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');

  // Dopo la stampa nessun testo è selezionato: un tocco lo seleziona, «Modifica» apre il pannello.
  const box = (await page.getByTestId('editor').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByTestId('edit-selected').tap();
  await expect(page.getByTestId('text-panel')).toBeVisible();
  await page.getByTestId('more-options').locator('summary').tap();
  await page.getByLabel('Carattere').selectOption({ label: 'Senza grazie' });
  const sans = await previewPixels();
  expect(sans).not.toBe(iso);
});

test('sottolineato: pulsante nello stile, anteprima diversa, nessuno scorrimento orizzontale', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Sottolineato');
  await page.getByTestId('more-options').locator('summary').tap();
  const btn = page.getByTestId('underline');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await noHorizontalScroll(page);
  const preview = async () => {
    await page.getByTestId('text-done').tap();
    await page.getByTestId('open-preview').tap();
    await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
    const data = await page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => c.toDataURL());
    await page.getByRole('button', { name: 'Chiudi', exact: true }).tap();
    return data;
  };
  const plain = await preview();
  const box = (await page.getByTestId('editor').boundingBox())!;
  // Il testo è ancora selezionato: un tocco riapre il pannello.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.getByTestId('text-panel')).toBeVisible();
  await page.getByTestId('more-options').locator('summary').tap();
  await page.getByTestId('underline').tap();
  await expect(page.getByTestId('underline')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/24-sottolineato-pannello.png' });
  const underlined = await preview();
  expect(underlined).not.toBe(plain);
  await page.getByTestId('open-preview').tap();
  await expect(page.getByText('Aggiornamento anteprima')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/25-sottolineato-anteprima.png' });
});

test('stile: pulsanti G, C, S con il nome completo per gli screen reader', async ({ page }) => {
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  await page.keyboard.type('Stile');
  await page.getByTestId('more-options').locator('summary').tap();
  const style = page.getByRole('group', { name: 'Stile' });
  await expect(style.getByRole('button')).toHaveText(['G', 'C', 'S']);
  // Il grassetto è attivo di default (docs/2026-11-08-grassetto-predefinito.md); ogni tocco lo inverte.
  for (const [name, initial] of [
    ['Grassetto', true],
    ['Corsivo', false],
    ['Sottolineato', false],
  ] as const) {
    const b = style.getByRole('button', { name });
    await expect(b).toHaveAttribute('aria-pressed', String(initial));
    await b.tap();
    await expect(b).toHaveAttribute('aria-pressed', String(!initial));
  }
  await noHorizontalScroll(page);
  await page.locator('[data-testid=more-options]').screenshot({ path: 'test-results/27-stile-gcs.png' });
});

test('cuore nascosto: «#<3*» diventa ♥ mentre si scrive, e si stampa', async ({ page }) => {
  // Vedi docs/2026-11-08-cuore-nascosto.md.
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  // Senza l'asterisco il codice resta testo.
  await page.keyboard.type('Ti #<3');
  await expect(input).toHaveValue('Ti #<3');
  await page.keyboard.type('*');
  await expect(input).toHaveValue('Ti ♥');
  // Il cursore resta dopo il cuore: si continua a scrivere in fondo.
  await page.keyboard.type(' A');
  await expect(input).toHaveValue('Ti ♥ A');
  // «<3» senza # resta com'è.
  await page.keyboard.type(' <3');
  await expect(input).toHaveValue('Ti ♥ A <3');
  await page.getByTestId('text-done').tap();

  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/28-cuore.png' });
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
});

test('cuore vuoto: «#<3-» diventa ♡ mentre si scrive, e si stampa', async ({ page }) => {
  // Vedi docs/2026-11-09-cuore-vuoto.md.
  await connectSimulated(page);
  await page.getByTestId('add-text').tap();
  const input = page.getByTestId('text-input');
  await page.keyboard.type('Ti #<3');
  await expect(input).toHaveValue('Ti #<3');
  await page.keyboard.type('-');
  await expect(input).toHaveValue('Ti ♡');
  // Il cursore resta dopo il cuore; il cuore pieno funziona ancora nello stesso testo.
  await page.keyboard.type(' e #<3*');
  await expect(input).toHaveValue('Ti ♡ e ♥');
  // Un trattino normale resta un trattino.
  await page.keyboard.type(' 20-30');
  await expect(input).toHaveValue('Ti ♡ e ♥ 20-30');
  await page.getByTestId('text-done').tap();

  await page.getByTestId('open-preview').tap();
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await page.screenshot({ path: 'test-results/28b-cuore-vuoto.png' });
  await page.getByTestId('print-button').tap();
  await expect(page.getByTestId('toast')).toContainText('Stampata');
  await expect(page.getByTestId('dev-panel')).toContainText('lavori ricevuti: 1');
});

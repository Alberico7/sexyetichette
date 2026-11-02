import { describe, expect, it } from 'vitest';
import { getPixel } from '@mbtech-nl/bitmap';
import { parseSettings } from '@/settings';
import { SimulatedPrinterPort } from '@/printer/simulated';
import { bitmapToRgba, countBlack, forEachBlack, toWireBitmap } from '@/printer/raster';
import { addressDoc, fakePrepare } from './helpers';

describe('impostazioni ricordate', () => {
  it('legge densità, formato e verso validi', () => {
    const media = { id: 'address-standard', name: 'Indirizzo', widthMm: 28, lengthMm: 89, lengthDots: 1051 };
    expect(parseSettings(JSON.stringify({ density: 'high', media, direction: 'across' }))).toEqual({
      density: 'high',
      media,
      direction: 'across',
    });
  });

  it('ignora valori non validi o dati corrotti', () => {
    expect(parseSettings(JSON.stringify({ density: 'fortissima', media: { id: 1 }, direction: 'su' }))).toEqual({});
    expect(parseSettings('{non json')).toEqual({});
    expect(parseSettings(null)).toEqual({});
    expect(parseSettings(JSON.stringify({ media: { id: 'x', name: 'x', widthMm: -3 } }))).toEqual({});
  });
});

describe('collegamento automatico (stampante simulata)', () => {
  it('senza autorizzazione precedente non si ricollega', async () => {
    const port = new SimulatedPrinterPort({ delayMs: 1 });
    let notified = 0;
    port.onDeviceAvailable(() => notified++);
    port.plugIn();
    expect(notified).toBe(0);
    expect(await port.reconnect()).toBeNull();
  });

  it('stampante già autorizzata: scollegata e reinserita → evento e ricollegamento senza selettore', async () => {
    const port = new SimulatedPrinterPort({ delayMs: 1 });
    await port.connect();
    let notified = 0;
    port.onDeviceAvailable(() => notified++);
    port.unplug();
    expect(port.connected).toBe(false);
    expect(await port.reconnect()).toBeNull(); // cavo staccato
    port.plugIn();
    expect(notified).toBe(1);
    expect((await port.reconnect())?.key).toBe('LW_550');
    expect(port.connected).toBe(true);
  });
});

describe('scansione veloce del bitmap', () => {
  it('forEachBlack, countBlack e bitmapToRgba coincidono con la lettura punto per punto', async () => {
    const { wireBitmap } = await fakePrepare(addressDoc());
    let naive = 0;
    for (let y = 0; y < wireBitmap.heightPx; y++)
      for (let x = 0; x < wireBitmap.widthPx; x++) if (getPixel(wireBitmap, x, y)) naive++;
    expect(countBlack(wireBitmap)).toBe(naive);
    let visited = 0;
    forEachBlack(wireBitmap, (x, y) => {
      expect(getPixel(wireBitmap, x, y)).toBe(true);
      visited++;
    });
    expect(visited).toBe(naive);
    // Ritorno: RGBA → bitmap identico.
    const back = toWireBitmap(bitmapToRgba(wireBitmap), { rotate: 0 });
    expect(countBlack(back)).toBe(naive);
  });

  it('larghezza non multipla di 8: i bit di riempimento non contano', () => {
    // Pixel neri e opachi (alfa 255).
    const data = new Uint8Array(13 * 2 * 4);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const img = { width: 13, height: 2, data };
    const bmp = toWireBitmap(img, { rotate: 0 });
    expect(countBlack(bmp)).toBe(26);
  });
});

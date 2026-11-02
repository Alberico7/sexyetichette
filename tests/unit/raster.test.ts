import { describe, expect, it } from 'vitest';
import { getPixel, renderImage } from '@mbtech-nl/bitmap';
import { bitmapToRgba, bitmapsEqual, countBlack, toWireBitmap } from '@/printer/raster';
import type { RgbaImage } from '@/printer/types';

function image(width: number, height: number, fill: (x: number, y: number) => number): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const v = fill(x, y);
      const i = (y * width + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  return { width, height, data };
}

describe('conversione verso la testina', () => {
  it('senza rotazione: stesse dimensioni, soglia a 128', () => {
    const img = image(8, 2, (x) => (x < 4 ? 0 : 200));
    const bmp = toWireBitmap(img, { rotate: 0 });
    expect([bmp.widthPx, bmp.heightPx]).toEqual([8, 2]);
    expect(getPixel(bmp, 0, 0)).toBe(true);
    expect(getPixel(bmp, 7, 1)).toBe(false);
  });

  it('rotazione di 90°: la colonna sinistra diventa la prima riga, il fondo va al punto 0', () => {
    // Immagine 4×2 con un solo pixel nero in basso a sinistra (0,1).
    const img = image(4, 2, (x, y) => (x === 0 && y === 1 ? 0 : 255));
    const bmp = toWireBitmap(img, { rotate: 90 });
    expect([bmp.widthPx, bmp.heightPx]).toEqual([2, 4]);
    expect(getPixel(bmp, 0, 0)).toBe(true);
    expect(countBlack(bmp)).toBe(1);
  });
});

describe('fedeltà dell’anteprima', () => {
  it('il dithering del driver lascia invariato il bitmap già in bianco e nero', () => {
    // Immagine con sfumature, testo antialias simulato e rumore.
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256);
    const img = image(331, 200, (x, y) => ((x + y) % 37 < 5 ? rnd() : (x * 255) / 331));
    const ours = toWireBitmap(img, { rotate: 0 });
    const sent = bitmapToRgba(ours);
    // È ciò che fa il driver dentro print(): renderImage con dither: true.
    const driver = renderImage(sent, { dither: true, rotate: 0 });
    expect(bitmapsEqual(ours, driver)).toBe(true);
  });
});

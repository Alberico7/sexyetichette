import { afterEach, describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { DIAMETER_SYMBOL } from '@/model/text';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapsEqual, countBlack } from '@/printer/raster';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';
import { setThemePreference } from '@/theme';

function docWith(text: string, fontFamily = 'sans-serif') {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  doc.elements.push({
    ...createTextElement({ x: 10, y: 2, width: 75, height: 24 }, text),
    fontFamily,
    fontSizePt: 40,
    align: 'left',
  });
  return doc;
}

/** Larghezza in punti dell'inchiostro, nel verso di lettura. */
function inkWidth(b: LabelBitmap): number {
  let min = Infinity;
  let max = -1;
  for (let y = 0; y < b.heightPx; y++)
    for (let x = 0; x < b.widthPx; x++)
      if (getPixel(b, x, y)) {
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
  return max - min + 1;
}

async function reading(text: string, font?: string): Promise<LabelBitmap> {
  const p = await prepareLabel(docWith(text, font), LW550_HEAD);
  return wireToReading(p.wireBitmap, p.geometry.wireRotation);
}

afterEach(() => setThemePreference('auto'));

describe('simbolo del diametro nella stampa', () => {
  it.each(['sans-serif', 'serif', 'monospace'])('Ø viene stampato con larghezza simile a una O (%s)', async (font) => {
    const d = await reading(DIAMETER_SYMBOL, font);
    const o = await reading('O', font);
    expect(countBlack(d)).toBeGreaterThan(200);
    const ratio = inkWidth(d) / inkWidth(o);
    expect(ratio).toBeGreaterThan(0.8);
    expect(ratio).toBeLessThan(1.3);
  });

  it('«Ø 8 mm» si distingue da «O 8 mm» (la barra viene stampata)', async () => {
    const d = await reading(`${DIAMETER_SYMBOL} 8 mm`);
    const o = await reading('O 8 mm');
    expect(bitmapsEqual(d, o)).toBe(false);
    expect(countBlack(d)).toBeGreaterThan(countBlack(o));
  });
});

describe('il tema non cambia la stampa', () => {
  it('stesso bitmap con tema chiaro e scuro', async () => {
    const doc = docWith(`Tubo ${DIAMETER_SYMBOL} 20`);
    setThemePreference('light');
    const light = await prepareLabel(doc, LW550_HEAD);
    setThemePreference('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    const dark = await prepareLabel(doc, LW550_HEAD);
    expect(bitmapsEqual(light.wireBitmap, dark.wireBitmap)).toBe(true);
  });
});

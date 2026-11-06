import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { ISO_FONT, ISO_FONT_FACE } from '@/model/fonts';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapsEqual, countBlack } from '@/printer/raster';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';

async function reading(text: string, fontFamily: string, autoFit = false): Promise<LabelBitmap> {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  doc.elements.push({
    ...createTextElement({ x: 10, y: 3, width: 75, height: 22 }, text),
    autoFit,
    fontSizePt: 36,
    fontFamily,
  });
  const p = await prepareLabel(doc, LW550_HEAD);
  return wireToReading(p.wireBitmap, 90);
}

describe('«Tecnico ISO 3098» nella stampa', () => {
  it('la stampa aspetta il font vero, non usa il sostituto', async () => {
    const iso = await reading('Tubo 20 AFKEUR', ISO_FONT);
    expect(document.fonts.check(`20px "${ISO_FONT_FACE}"`)).toBe(true);
    const sans = await reading('Tubo 20 AFKEUR', 'sans-serif');
    expect(countBlack(iso)).toBeGreaterThan(0);
    expect(bitmapsEqual(iso, sans)).toBe(false);
  });

  it('l’adattamento automatico entra nel riquadro', async () => {
    const b = await reading('Tubo ⌀20 AFKEUR', ISO_FONT, true);
    // Riquadro: x 10–85 mm, y 3–25 mm; nessun punto nero fuori (tolleranza 1 punto).
    const mm = (v: number) => Math.round((v * 300) / 25.4);
    let outside = 0;
    for (let y = 0; y < b.heightPx; y++)
      for (let x = 0; x < b.widthPx; x++) if (getPixel(b, x, y) && (y < mm(3) - 1 || y > mm(25) + 1)) outside++;
    expect(outside).toBe(0);
    expect(countBlack(b)).toBeGreaterThan(1000);
  });
});

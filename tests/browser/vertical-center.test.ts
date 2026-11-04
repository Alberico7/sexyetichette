import { describe, expect, it } from 'vitest';
import { getPixel } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { ISO_FONT } from '@/model/fonts';
import type { VerticalAlign } from '@/model/types';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';

const FONTS = [ISO_FONT, 'sans-serif', 'serif', 'monospace'];
const dots = (mm: number) => Math.round((mm * 300) / 25.4);

/** Righe del primo e dell'ultimo punto nero, e centro del riquadro, nell'area stampabile. */
async function inkRows(font: string, verticalAlign: VerticalAlign, bold = false) {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  doc.elements.push({
    ...createTextElement({ x: 10, y: 2, width: 75, height: 24 }, 'HEH'),
    autoFit: false,
    fontSizePt: 40,
    fontFamily: font,
    verticalAlign,
    bold,
  });
  const p = await prepareLabel(doc, LW550_HEAD);
  const b = wireToReading(p.wireBitmap, 90);
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < b.heightPx; y++)
    for (let x = 0; x < b.widthPx; x++)
      if (getPixel(b, x, y)) {
        if (top < 0) top = y;
        bottom = y;
      }
  const boxCenter = (dots(2) + dots(26)) / 2 - p.geometry.printable.y;
  return { top, bottom, center: (top + bottom) / 2, boxCenter };
}

describe('testo centrato in verticale con ogni carattere', () => {
  it.each(FONTS)('%s: maiuscole al centro del riquadro (±4 punti)', async (font) => {
    for (const bold of [false, true]) {
      const r = await inkRows(font, 'middle', bold);
      expect(Math.abs(r.center - r.boxCenter), `${font} ${bold ? 'grassetto' : ''}`).toBeLessThanOrEqual(4);
    }
  });

  it('«Tecnico ISO 3098» allineato in alto e in basso come «Senza grazie» (±8 punti)', async () => {
    for (const align of ['top', 'bottom'] as const) {
      const iso = await inkRows(ISO_FONT, align);
      const sans = await inkRows('sans-serif', align);
      expect(Math.abs(iso.center - sans.center), align).toBeLessThanOrEqual(8);
    }
  });
});

/** «Noto Sans (simile a Segoe UI)» nella stampa. Vedi docs/2026-11-09-carattere-noto-sans.md. */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { DIAMETER_SIGN } from '@/model/text';
import { NOTO_SANS, NOTO_SANS_FACE } from '@/model/fonts';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapsEqual, countBlack } from '@/printer/raster';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';

async function reading(text: string, fontFamily: string, bold = true, italic = false): Promise<LabelBitmap> {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  doc.elements.push({
    ...createTextElement({ x: 5, y: 3, width: 85, height: 22 }, text),
    autoFit: false,
    fontSizePt: 36,
    fontFamily,
    bold,
    italic,
    align: 'left',
  });
  const p = await prepareLabel(doc, LW550_HEAD);
  return wireToReading(p.wireBitmap, 90);
}

function inkBox(b: LabelBitmap) {
  let x1 = Infinity,
    x2 = -1,
    y1 = Infinity,
    y2 = -1;
  for (let y = 0; y < b.heightPx; y++)
    for (let x = 0; x < b.widthPx; x++)
      if (getPixel(b, x, y)) {
        x1 = Math.min(x1, x);
        x2 = Math.max(x2, x);
        y1 = Math.min(y1, y);
        y2 = Math.max(y2, y);
      }
  return { w: x2 - x1 + 1, h: y2 - y1 + 1 };
}

describe('«Noto Sans» nella stampa', () => {
  it('la stampa usa il font vero, in tutte e quattro le varianti', async () => {
    const sans = await reading('0123456789', 'sans-serif');
    const noto = await reading('0123456789', NOTO_SANS);
    expect(bitmapsEqual(noto, sans)).toBe(false);
    for (const [bold, italic] of [
      [false, false],
      [false, true],
      [true, true],
    ] as const) {
      await reading('Tubo 20', NOTO_SANS, bold, italic);
      const spec = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}20px "${NOTO_SANS_FACE}"`;
      expect(document.fonts.check(spec), spec).toBe(true);
    }
  });

  it('cifre con le proporzioni di Noto Sans (larghezza/altezza come misurata dal browser)', async () => {
    const box = inkBox(await reading('0123456789', NOTO_SANS));
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.font = `bold 200px "${NOTO_SANS_FACE}"`;
    const m = ctx.measureText('0123456789');
    const expected =
      (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / (m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    expect(Math.abs(box.w / box.h - expected) / expected).toBeLessThan(0.03);
  });

  it('il grassetto è più pieno del normale', async () => {
    const normal = await reading('0123456789', NOTO_SANS, false);
    const bold = await reading('0123456789', NOTO_SANS, true);
    expect(countBlack(bold)).toBeGreaterThan(countBlack(normal) * 1.2);
  });

  it('⌀ resta alto quanto le maiuscole', async () => {
    const d = inkBox(await reading(DIAMETER_SIGN, NOTO_SANS));
    const h = inkBox(await reading('H', NOTO_SANS));
    expect(d.h / h.h).toBeGreaterThan(0.95);
    expect(d.h / h.h).toBeLessThan(1.12);
  });
});

import { describe, expect, it } from 'vitest';
import { getPixel } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { UNREPAIRABLE_TEXT } from '@/model/text';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';

const dots = (mm: number) => Math.round((mm * 300) / 25.4);

describe('NON RIPARABILE su due righe', () => {
  it('con l’adattamento automatico: due righe nel riquadro, blocco centrato', async () => {
    const doc = createDocument(findMediaById('address-standard')!);
    doc.direction = 'along';
    const box = { x: 10, y: 2, width: 75, height: 24 };
    // Valori predefiniti dei nuovi testi: ISO 3098, centrato, adattamento automatico.
    doc.elements.push(createTextElement(box, UNREPAIRABLE_TEXT));
    const p = await prepareLabel(doc, LW550_HEAD);
    const b = wireToReading(p.wireBitmap, 90);

    const inkRow: boolean[] = [];
    let left = Infinity;
    let right = -1;
    for (let y = 0; y < b.heightPx; y++) {
      let ink = false;
      for (let x = 0; x < b.widthPx; x++)
        if (getPixel(b, x, y)) {
          ink = true;
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      inkRow.push(ink);
    }
    // Bande di righe con inchiostro: devono essere due (NON, RIPARABILE).
    let bands = 0;
    for (let y = 0; y < inkRow.length; y++) if (inkRow[y] && !inkRow[y - 1]) bands++;
    expect(bands).toBe(2);

    const top = inkRow.indexOf(true);
    const bottom = inkRow.lastIndexOf(true);
    const ox = p.geometry.printable.x;
    const oy = p.geometry.printable.y;
    // Tutto dentro il riquadro.
    expect(top).toBeGreaterThanOrEqual(dots(box.y) - oy);
    expect(bottom).toBeLessThanOrEqual(dots(box.y + box.height) - oy);
    expect(left).toBeGreaterThanOrEqual(dots(box.x) - ox);
    expect(right).toBeLessThanOrEqual(dots(box.x + box.width) - ox);
    // Blocco centrato in verticale (±1 mm).
    const boxCenter = (dots(box.y) + dots(box.y + box.height)) / 2 - oy;
    expect(Math.abs((top + bottom) / 2 - boxCenter)).toBeLessThanOrEqual(dots(1));
  });
});

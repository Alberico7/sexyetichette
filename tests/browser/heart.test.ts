/**
 * Cuore ♥ nascosto nel disegno dell'etichetta, in un file a parte: il mini-font deve
 * caricarsi anche quando nel testo non c'è ⌀. Vedi docs/2026-11-08-cuore-nascosto.md.
 */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { HEART } from '@/model/text';
import { ISO_FONT } from '@/model/fonts';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';

async function reading(text: string, fontFamily = 'sans-serif', bold = false): Promise<LabelBitmap> {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  doc.elements.push({
    ...createTextElement({ x: 10, y: 1, width: 75, height: 26 }, text),
    autoFit: false,
    fontSizePt: 48,
    fontFamily,
    bold,
    align: 'left',
  });
  const p = await prepareLabel(doc, LW550_HEAD);
  return wireToReading(p.wireBitmap, 90);
}

function rows(b: LabelBitmap) {
  const out: { y: number; xs: number[] }[] = [];
  for (let y = 0; y < b.heightPx; y++) {
    const xs: number[] = [];
    for (let x = 0; x < b.widthPx; x++) if (getPixel(b, x, y)) xs.push(x);
    if (xs.length) out.push({ y, xs });
  }
  return out;
}

const inkHeight = (b: LabelBitmap) => {
  const r = rows(b);
  return r.length ? r[r.length - 1]!.y - r[0]!.y + 1 : 0;
};

describe('cuore ♥ nascosto (docs/2026-11-08-cuore-nascosto.md)', () => {
  it.each(['sans-serif', 'serif', ISO_FONT])('%s: cuore pieno, alto come le maiuscole, sulla riga', async (font) => {
    const heart = await reading(HEART, font);
    const H = await reading('H', font);
    const ratio = inkHeight(heart) / inkHeight(H);
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.05);
    // Appoggiato sulla riga: il fondo (la punta) coincide con il fondo della H.
    expect(Math.abs(rows(heart).at(-1)!.y - rows(H).at(-1)!.y)).toBeLessThanOrEqual(2);
    // Pieno: la riga a metà altezza è continua da un bordo all'altro.
    const r = rows(heart);
    const mid = r[Math.floor(r.length / 2)]!;
    expect(mid.xs.length).toBe(mid.xs.at(-1)! - mid.xs[0]! + 1);
  });

  it('con le lettere: «A♥B» è largo quanto «A», cuore e «B» insieme, senza sovrapposizioni', async () => {
    const width = (b: LabelBitmap) => {
      let min = Infinity,
        max = -1;
      for (const row of rows(b)) {
        min = Math.min(min, row.xs[0]!);
        max = Math.max(max, row.xs.at(-1)!);
      }
      return max - min + 1;
    };
    const all = width(await reading(`A${HEART}B`, ISO_FONT));
    const parts =
      width(await reading('A', ISO_FONT)) + width(await reading(HEART, ISO_FONT)) + width(await reading('B', ISO_FONT));
    expect(all).toBeGreaterThan(parts);
  });
});

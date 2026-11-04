import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { DIAMETER_SIGN } from '@/model/text';
import { ISO_FONT } from '@/model/fonts';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapsEqual } from '@/printer/raster';
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

/** Inclinazione della barra: dai baricentri delle righe più alte e più basse (le estremità della barra). */
function slashAngleDeg(b: LabelBitmap): number {
  const r = rows(b);
  const take = Math.max(3, Math.round(r.length * 0.04));
  const centroid = (sel: typeof r) => {
    let sx = 0, sy = 0, n = 0;
    for (const row of sel) for (const x of row.xs) { sx += x; sy += row.y; n++; }
    return { x: sx / n, y: sy / n };
  };
  const top = centroid(r.slice(0, take));
  const bottom = centroid(r.slice(-take));
  return (Math.atan2(bottom.y - top.y, top.x - bottom.x) * 180) / Math.PI;
}

describe('⌀ proporzionato al testo (mini-font ISO)', () => {
  it.each(['sans-serif', 'serif', 'monospace', ISO_FONT])('%s: ⌀ alto come le maiuscole, barra a 75°', async (font) => {
    const d = await reading(DIAMETER_SIGN, font);
    const H = await reading('H', font);
    const ratio = inkHeight(d) / inkHeight(H);
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.12);
    expect(Math.abs(slashAngleDeg(d) - 75)).toBeLessThanOrEqual(4);
  });

  it('il grassetto ispessisce anche ⌀', async () => {
    const normal = await reading(DIAMETER_SIGN);
    const bold = await reading(DIAMETER_SIGN, 'sans-serif', true);
    const ink = (b: LabelBitmap) => rows(b).reduce((s, r) => s + r.xs.length, 0);
    expect(ink(bold)).toBeGreaterThan(ink(normal) * 1.1);
  });

  it('le altre lettere non cambiano', async () => {
    const before = await reading('Tubo 20 mm');
    await reading(`${DIAMETER_SIGN} 20`); // registra il mini-font
    const after = await reading('Tubo 20 mm');
    expect(bitmapsEqual(before, after)).toBe(true);
  });
});

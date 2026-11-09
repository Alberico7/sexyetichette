/**
 * Cuore vuoto ♡ nel disegno dell'etichetta, in un file a parte: il mini-font deve
 * caricarsi anche quando nel testo c'è solo ♡. Vedi docs/2026-11-09-cuore-vuoto.md.
 */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { DIAMETER_SIGN, EMPTY_HEART, HEART } from '@/model/text';
import { ISO_FONT, NOTO_SANS } from '@/model/fonts';
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

const ink = (b: LabelBitmap) => rows(b).reduce((n, r) => n + r.xs.length, 0);

/** Lunghezza del primo tratto nero da sinistra in una riga. */
function leftRun(xs: number[]): number {
  let n = 1;
  while (n < xs.length && xs[n] === xs[0]! + n) n++;
  return n;
}

/** Spessore del bordo del ♡: nella riga più larga i lati sono verticali. */
function heartBorder(b: LabelBitmap): number {
  const widest = rows(b).reduce((a, r) => (r.xs.at(-1)! - r.xs[0]! > a.xs.at(-1)! - a.xs[0]! ? r : a));
  return leftRun(widest.xs);
}

/** Spessore del tratto del ⌀: a metà altezza del cerchio, il lato sinistro dell'anello. */
function diameterStroke(b: LabelBitmap): number {
  const r = rows(b);
  return leftRun(r[Math.floor(r.length / 2)]!.xs);
}

describe('cuore vuoto ♡ (docs/2026-11-09-cuore-vuoto.md)', () => {
  it.each(['sans-serif', ISO_FONT, NOTO_SANS])(
    '%s: alto come le maiuscole, vuoto al centro, bordo come il ⌀',
    async (font) => {
      const heart = await reading(EMPTY_HEART, font);
      const H = await reading('H', font);
      const ratio = inkHeight(heart) / inkHeight(H);
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
      // Appoggiato sulla riga.
      expect(Math.abs(rows(heart).at(-1)!.y - rows(H).at(-1)!.y)).toBeLessThanOrEqual(2);
      // Vuoto: a metà altezza ci sono due tratti neri (i lati) e in mezzo il bianco.
      const r = rows(heart);
      const mid = r[Math.floor(r.length / 2)]!;
      const cx = Math.round((mid.xs[0]! + mid.xs.at(-1)!) / 2);
      expect(mid.xs).not.toContain(cx);
      expect(mid.xs.length).toBeLessThan((mid.xs.at(-1)! - mid.xs[0]!) / 2);
      // Il bordo è spesso quanto il tratto del ⌀.
      const border = heartBorder(heart);
      const stroke = diameterStroke(await reading(DIAMETER_SIGN, font));
      expect(border).toBeGreaterThan(4);
      expect(Math.abs(border - stroke)).toBeLessThanOrEqual(2);
      // Stesso ingombro del cuore pieno, ma molto meno inchiostro.
      const full = await reading(HEART, font);
      expect(Math.abs(inkHeight(full) - inkHeight(heart))).toBeLessThanOrEqual(1);
      expect(ink(heart)).toBeLessThan(ink(full) * 0.6);
    },
  );

  it('il grassetto ispessisce il bordo', async () => {
    const normal = await reading(EMPTY_HEART);
    const bold = await reading(EMPTY_HEART, 'sans-serif', true);
    expect(ink(bold)).toBeGreaterThan(ink(normal) * 1.1);
    expect(heartBorder(bold)).toBeGreaterThan(heartBorder(normal));
  });
});

/**
 * Testo sottolineato: posizione e forma della linea nella stampa, con ogni carattere.
 * Vedi docs/2026-11-06-sottolineato.md.
 */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { ISO_FONT } from '@/model/fonts';
import type { TextElement } from '@/model/types';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';
import { resolveFontSize } from '@/render/scene';

const FONTS = [ISO_FONT, 'sans-serif', 'serif', 'monospace'];
const dots = (mm: number) => Math.round((mm * 300) / 25.4);
/** Riquadro del testo in mm (x, y, larghezza, altezza). */
const BOX = { x: 10, y: 2, width: 75, height: 24 };

async function render(patch: Partial<TextElement>, text = 'HEH') {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  const el = { ...createTextElement(BOX, text), autoFit: false, fontSizePt: 40, ...patch };
  doc.elements.push(el);
  const p = await prepareLabel(doc, LW550_HEAD);
  return { b: wireToReading(p.wireBitmap, 90), printable: p.geometry.printable, el };
}

/** Righe dove c'è più inchiostro con il sottolineato che senza: la linea. */
function diffRows(a: LabelBitmap, b: LabelBitmap) {
  const rows: { y: number; from: number; to: number; count: number }[] = [];
  for (let y = 0; y < a.heightPx; y++) {
    let from = -1;
    let to = -1;
    let count = 0;
    for (let x = 0; x < a.widthPx; x++) {
      if (getPixel(a, x, y) !== getPixel(b, x, y)) {
        count++;
        if (from < 0) from = x;
        to = x;
      }
    }
    if (count) rows.push({ y, from, to, count });
  }
  return rows;
}

/** Ultima riga con inchiostro (fondo delle maiuscole senza sottolineato). */
function bottomInk(b: LabelBitmap): number {
  for (let y = b.heightPx - 1; y >= 0; y--) for (let x = 0; x < b.widthPx; x++) if (getPixel(b, x, y)) return y;
  return -1;
}

describe('sottolineato nella stampa', () => {
  it.each(FONTS)('%s: linea continua sotto le maiuscole, dentro il riquadro, larga quanto il testo', async (font) => {
    const plain = await render({ fontFamily: font });
    const under = await render({ fontFamily: font, underline: true });
    const rows = diffRows(plain.b, under.b);
    expect(rows.length, 'righe della linea').toBeGreaterThan(0);
    const textBottom = bottomInk(plain.b);
    const lineTop = rows[0]!.y;
    const lineBottom = rows.at(-1)!.y;
    // Sotto le maiuscole, senza toccarle; non oltre il fondo del riquadro.
    expect(lineTop, 'linea sotto il testo').toBeGreaterThan(textBottom);
    // Vicina al testo: al massimo 0,1 em fra il fondo delle maiuscole e la linea (40 pt ≈ 167 punti).
    expect(lineTop - textBottom, 'distanza dal testo').toBeLessThanOrEqual(17);
    const boxBottom = dots(BOX.y + BOX.height) - plain.printable.y;
    expect(lineBottom, 'linea dentro il riquadro').toBeLessThan(boxBottom);
    // Spessore: circa 1/15 della dimensione del carattere (40 pt ≈ 167 punti → 11), ±50 %.
    const thickness = lineBottom - lineTop + 1;
    expect(thickness).toBeGreaterThanOrEqual(5);
    expect(thickness).toBeLessThanOrEqual(17);
    // Continua: in ogni riga della linea, tutti i punti fra inizio e fine sono neri.
    const mid = rows[Math.floor(rows.length / 2)]!;
    expect(mid.count).toBe(mid.to - mid.from + 1);
    // Larga quanto il testo (±1,5 mm: la linea copre anche lo spazio ai lati delle lettere).
    let left = Infinity;
    let right = -1;
    for (let y = 0; y < plain.b.heightPx; y++)
      for (let x = 0; x < plain.b.widthPx; x++)
        if (getPixel(plain.b, x, y)) {
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
    expect(Math.abs(mid.from - left)).toBeLessThanOrEqual(dots(1.5));
    expect(Math.abs(mid.to - right)).toBeLessThanOrEqual(dots(1.5));
  });

  it('lettere con la gamba («g», «p»): la linea sta sopra il fondo della gamba', async () => {
    const plain = await render({ fontFamily: 'sans-serif' }, 'Hgp');
    const under = await render({ fontFamily: 'sans-serif', underline: true }, 'Hgp');
    const rows = diffRows(plain.b, under.b);
    // Dove la gamba incrocia la linea non c'è differenza: la linea sta dentro l'altezza delle gambe.
    expect(rows.at(-1)!.y).toBeLessThan(bottomInk(plain.b));
  });

  it('bianco su nero: la linea è bianca', async () => {
    const plain = await render({ fontFamily: 'sans-serif', invert: true });
    const under = await render({ fontFamily: 'sans-serif', invert: true, underline: true });
    const rows = diffRows(plain.b, under.b);
    expect(rows.length).toBeGreaterThan(0);
    const mid = rows[Math.floor(rows.length / 2)]!;
    expect(getPixel(under.b, Math.round((mid.from + mid.to) / 2), mid.y)).toBe(false);
  });

  it('senza sottolineato non cambia niente; con l’adattamento automatico la dimensione resta la stessa', async () => {
    const a = await render({ fontFamily: 'sans-serif' });
    const b = await render({ fontFamily: 'sans-serif', underline: false });
    expect(diffRows(a.b, b.b)).toEqual([]);
    const base = { ...createTextElement(BOX, 'Zucchero'), autoFit: true };
    expect(resolveFontSize({ ...base, underline: true }).sizePt).toBe(resolveFontSize(base).sizePt);
  });
});

/**
 * ⌀ con la barra a 45° (carattere ∅) nel disegno dell'etichetta, in un file a parte:
 * il mini-font deve caricarsi anche quando nel testo non c'è ⌀.
 * Vedi docs/2026-11-09-diametro-45.md.
 */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { DIAMETER_45_SIGN } from '@/model/text';
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

function inkPoints(b: LabelBitmap): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let y = 0; y < b.heightPx; y++) for (let x = 0; x < b.widthPx; x++) if (getPixel(b, x, y)) pts.push({ x, y });
  return pts;
}

function box(pts: { x: number; y: number }[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
}

/**
 * Inclinazione della barra: i punti neri ben dentro l'anello sono solo della barra;
 * la loro direzione principale dà l'angolo sull'orizzontale (verso l'alto a destra).
 */
function slashAngleDeg(b: LabelBitmap): number {
  const pts = inkPoints(b);
  const bb = box(pts);
  const cx = (bb.x1 + bb.x2) / 2;
  const cy = (bb.y1 + bb.y2) / 2;
  const r = (bb.x2 - bb.x1) / 2;
  const inner = pts.filter((p) => Math.hypot(p.x - cx, p.y - cy) < r * 0.6);
  let sxx = 0,
    syy = 0,
    sxy = 0;
  for (const p of inner) {
    const dx = p.x - cx;
    const dy = cy - p.y; // y verso l'alto
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  return (0.5 * Math.atan2(2 * sxy, sxx - syy) * 180) / Math.PI;
}

const ink = (b: LabelBitmap) => inkPoints(b).length;

describe('⌀ a 45° (∅) proporzionato al testo', () => {
  it.each(['sans-serif', 'serif', ISO_FONT])('%s: alto come il cerchio del ⌀, barra a 45°', async (font) => {
    const d = await reading(DIAMETER_45_SIGN, font);
    const H = await reading('H', font);
    const hd = box(inkPoints(d));
    const hh = box(inkPoints(H));
    // Il simbolo è alto quanto il cerchio: 0,77 delle maiuscole.
    const ratio = (hd.y2 - hd.y1 + 1) / (hh.y2 - hh.y1 + 1);
    expect(ratio).toBeGreaterThan(0.72);
    expect(ratio).toBeLessThan(0.86);
    // Largo quanto alto: la barra non esce dal cerchio.
    expect(Math.abs(hd.x2 - hd.x1 - (hd.y2 - hd.y1))).toBeLessThanOrEqual(3);
    expect(Math.abs(slashAngleDeg(d) - 45)).toBeLessThanOrEqual(4);
  });

  it('il grassetto ispessisce anche ∅', async () => {
    const normal = await reading(DIAMETER_45_SIGN);
    const bold = await reading(DIAMETER_45_SIGN, 'sans-serif', true);
    expect(ink(bold)).toBeGreaterThan(ink(normal) * 1.1);
  });
});

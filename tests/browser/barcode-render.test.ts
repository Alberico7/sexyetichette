/**
 * Codici a barre nel bitmap di stampa: barre a punti interi, zone di quiete, e rilettura
 * con zxing (lo stesso tipo di decodifica di un lettore). Vedi docs/2026-11-24-codici-a-barre.md.
 */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import { areaFromDots, createBarcodeElement, createDocument } from '@/model/document';
import { documentGeometry } from '@/model/geometry';
import { QUIET_ZONE_MODULES } from '@/model/barcode';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';

async function printed(value: string, opts: { media?: string; rotation?: number; showText?: boolean } = {}) {
  const doc = createDocument(findMediaById(opts.media ?? 'address-standard')!);
  doc.direction = 'along';
  const area = areaFromDots(documentGeometry(doc, LW550_HEAD).safe);
  const el = createBarcodeElement(area, value);
  el.rotation = opts.rotation ?? 0;
  if (opts.showText === false) el.showText = false;
  if (el.rotation % 180 === 90) {
    // Ruotato: il riquadro diventa alto e stretto, centrato nello stesso punto.
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    [el.width, el.height] = [area.height - 1, area.width * 0.6];
    el.x = cx - el.width / 2;
    el.y = cy - el.height / 2;
  }
  doc.elements.push(el);
  const p = await prepareLabel(doc, LW550_HEAD);
  return wireToReading(p.wireBitmap, 90);
}

/** Rilettura con zxing. `quarterTurn`: legge il bitmap ruotato di 90° (zxing qui non lo prova da solo). */
function decode(b: LabelBitmap, quarterTurn = false): string | null {
  const w = quarterTurn ? b.heightPx : b.widthPx;
  const h = quarterTurn ? b.widthPx : b.heightPx;
  const lum = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) lum[y * w + x] = (quarterTurn ? getPixel(b, y, x) : getPixel(b, x, y)) ? 0 : 255;
  const reader = new MultiFormatReader();
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]],
    [DecodeHintType.TRY_HARDER, true],
  ]);
  try {
    return reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h))), hints).getText();
  } catch {
    return null;
  }
}

/** Tratti consecutivi (neri e bianchi) lungo la riga `y`, dal primo all'ultimo punto nero. */
function runs(b: LabelBitmap, y: number): { black: boolean; len: number; start: number }[] {
  const out: { black: boolean; len: number; start: number }[] = [];
  for (let x = 0; x < b.widthPx; x++) {
    const black = getPixel(b, x, y);
    const last = out.at(-1);
    if (last && last.black === black) last.len++;
    else out.push({ black, len: 1, start: x });
  }
  return out;
}

function inkRows(b: LabelBitmap): number[] {
  const rows: number[] = [];
  for (let y = 0; y < b.heightPx; y++)
    for (let x = 0; x < b.widthPx; x++)
      if (getPixel(b, x, y)) {
        rows.push(y);
        break;
      }
  return rows;
}

describe('Code 128 nel bitmap di stampa', () => {
  it.each(['ART-12345', '12345678', '1234567', 'a b.c/D_9'])('«%s» si rilegge uguale', async (value) => {
    expect(decode(await printed(value))).toBe(value);
  });

  it('barre e spazi larghi un multiplo intero del modulo; modulo di 2 o 3 punti; zone di quiete', async () => {
    const b = await printed('ART-12345', { showText: false });
    const rows = inkRows(b);
    const r = runs(b, rows[Math.floor(rows.length / 2)]!);
    const inner = r.slice(1, -1); // senza il bianco esterno
    const module = Math.min(...inner.map((t) => t.len));
    expect([2, 3]).toContain(module);
    for (const t of inner) expect(t.len % module, `tratto di ${t.len} punti`).toBe(0);
    // Bianco prima della prima barra e dopo l'ultima: almeno 10 moduli (entro il bordo stampabile).
    expect(r[0]!.black).toBe(false);
    expect(r[0]!.len).toBeGreaterThanOrEqual(QUIET_ZONE_MODULES * module);
    expect(r.at(-1)!.len).toBeGreaterThanOrEqual(QUIET_ZONE_MODULES * module);
    // Tutte le righe delle barre sono identiche: nessuna sfumatura ai bordi.
    const first = JSON.stringify(runs(b, rows[1]!));
    expect(JSON.stringify(runs(b, rows.at(-2)!))).toBe(first);
  });

  it('ruotato di 90° si rilegge ancora', async () => {
    // Ruotato il riquadro è largo quanto l'etichetta è alta (circa 24 mm): un codice corto.
    const b = await printed('123456', { rotation: 90 });
    expect(decode(b), 'non si legge senza ruotare').toBeNull();
    expect(decode(b, true)).toBe('123456');
  });

  it('con il testo sotto: barre e testo sono due blocchi separati; senza, solo le barre', async () => {
    /** Gruppi di righe con inchiostro, separati da almeno una riga bianca. */
    const blocks = (rows: number[]) => rows.filter((y, i) => i === 0 || y !== rows[i - 1]! + 1).length;
    expect(blocks(inkRows(await printed('ART-12345')))).toBe(2);
    expect(blocks(inkRows(await printed('ART-12345', { showText: false })))).toBe(1);
  });

  it.each([
    ['carattere non codificabile', 'Ø-12'],
    ['codice troppo lungo per il riquadro', 'X'.repeat(60)],
  ])('%s: niente inchiostro (stampa bloccata a parte)', async (_why, value) => {
    const b = await printed(value);
    expect(inkRows(b)).toHaveLength(0);
  });
});

/**
 * Test di rendering su canvas reale (Chromium via Playwright).
 */
import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import type { LabelDocument, TextElement } from '@/model/types';
import { dotsToMm } from '@/model/units';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapsEqual, countBlack } from '@/printer/raster';
import { runPrint } from '@/printer/print-flow';
import { SimulatedPrinterPort } from '@/printer/simulated';
import { prepareLabel } from '@/render/export';
import { paintPreview, wireToReading } from '@/render/preview';

function addressDoc(direction: 'along' | 'across' = 'along'): LabelDocument {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = direction;
  return doc;
}

function text(patch: Partial<TextElement>): TextElement {
  return { ...createTextElement({ x: 0, y: 0, width: 80, height: 20 }, 'HHHH'), fontSizePt: 20, ...patch };
}

/** Riquadro che contiene i punti neri. */
function blackBounds(b: LabelBitmap) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < b.heightPx; y++)
    for (let x = 0; x < b.widthPx; x++)
      if (getPixel(b, x, y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
  return { minX, minY, maxX, maxY };
}

describe('rendering a 300 dpi', () => {
  it('etichetta vuota → nessun punto nero, dimensioni della testina', async () => {
    const p = await prepareLabel(addressDoc(), LW550_HEAD);
    expect([p.wireBitmap.widthPx, p.wireBitmap.heightPx]).toEqual([331, 980]);
    expect(countBlack(p.wireBitmap)).toBe(0);
  });

  it('un testo produce punti neri', async () => {
    const doc = addressDoc();
    doc.elements.push(text({ x: 20, y: 4, width: 60, height: 20 }));
    const p = await prepareLabel(doc, LW550_HEAD);
    expect(countBlack(p.wireBitmap)).toBeGreaterThan(500);
  });

  it('un testo interamente nella zona non stampabile non viene stampato', async () => {
    const doc = addressDoc();
    // Zona iniziale: i primi 6 mm a sinistra (verso "lungo il rotolo").
    doc.elements.push(text({ x: 0.5, y: 2, width: 4.5, height: 20, text: 'I', fontSizePt: 30 }));
    const p = await prepareLabel(doc, LW550_HEAD);
    expect(countBlack(p.wireBitmap)).toBe(0);
  });

  it('orientamento: un quadrato in basso a destra finisce alla fine del rotolo, vicino al punto 0', async () => {
    const doc = addressDoc('along');
    // Blocco nero (bianco su nero senza testo) di 5×5 mm nell'angolo in basso a destra.
    doc.elements.push(text({ x: 84, y: 23, width: 5, height: 5, text: ' ', invert: true }));
    const p = await prepareLabel(doc, LW550_HEAD);
    const b = blackBounds(p.wireBitmap);
    // Righe = avanzamento: in fondo al lavoro.
    expect(b.maxY).toBeGreaterThanOrEqual(975);
    expect(b.minY).toBeGreaterThan(900);
    // Colonne = testina: il bordo inferiore dell'etichetta è il punto 0.
    expect(b.minX).toBeLessThanOrEqual(1);
    expect(b.maxX).toBeLessThan(70);
  });

  it('verso "attraverso il rotolo": nessuna rotazione', async () => {
    const doc = addressDoc('across');
    doc.elements.push(text({ x: 0, y: 6, width: 5, height: 5, text: ' ', invert: true }));
    const p = await prepareLabel(doc, LW550_HEAD);
    expect(p.geometry.wireRotation).toBe(0);
    const b = blackBounds(p.wireBitmap);
    expect(b.minX).toBeLessThanOrEqual(1);
    expect(b.minY).toBeLessThanOrEqual(1);
  });

  it('bianco su nero riempie il riquadro', async () => {
    const doc = addressDoc();
    const el = text({ x: 10, y: 5, width: 40, height: 15, invert: true });
    doc.elements.push(el);
    const p = await prepareLabel(doc, LW550_HEAD);
    const area = Math.round((el.width * 300) / 25.4) * Math.round((el.height * 300) / 25.4);
    const black = countBlack(p.wireBitmap);
    expect(black).toBeGreaterThan(area * 0.6);
    expect(black).toBeLessThan(area * 1.05);
  });

  it('la rotazione di 90° di un elemento scambia l’ingombro', async () => {
    const doc = addressDoc();
    doc.elements.push(text({ x: 30, y: 9, width: 30, height: 10, text: ' ', invert: true, rotation: 90 }));
    const p = await prepareLabel(doc, LW550_HEAD);
    const reading = wireToReading(p.wireBitmap, 90);
    const b = blackBounds(reading);
    const wMm = dotsToMm(b.maxX - b.minX + 1);
    const hMm = dotsToMm(b.maxY - b.minY + 1);
    expect(wMm).toBeCloseTo(10, 0);
    expect(hMm).toBeGreaterThan(20); // tagliato dai bordi dell'etichetta (28 mm)
  });
});

describe('anteprima', () => {
  it('l’anteprima mostra esattamente il bitmap di stampa', async () => {
    const doc = addressDoc();
    doc.elements.push(text({ x: 10, y: 3, width: 70, height: 22, text: 'Prova anteprima' }));
    const p = await prepareLabel(doc, LW550_HEAD);
    const canvas = document.createElement('canvas');
    paintPreview(canvas, p.wireBitmap, p.geometry);
    expect([canvas.width, canvas.height]).toEqual([1051, 331]);
    const ctx = canvas.getContext('2d')!;
    const { printable } = p.geometry;
    const px = ctx.getImageData(printable.x, printable.y, printable.width, printable.height).data;
    const reading = wireToReading(p.wireBitmap, 90);
    let mismatches = 0;
    for (let y = 0; y < reading.heightPx; y++)
      for (let x = 0; x < reading.widthPx; x++) {
        const isBlack = px[(y * reading.widthPx + x) * 4]! < 128;
        if (isBlack !== getPixel(reading, x, y)) mismatches++;
      }
    expect(mismatches).toBe(0);
  });

  it('il rendering è deterministico', async () => {
    const doc = addressDoc();
    doc.elements.push(text({ x: 10, y: 3, width: 70, height: 22, text: 'Uguale' }));
    const a = await prepareLabel(doc, LW550_HEAD);
    const b = await prepareLabel(doc, LW550_HEAD);
    expect(bitmapsEqual(a.wireBitmap, b.wireBitmap)).toBe(true);
  });
});

describe('flusso completo con la stampante simulata', () => {
  it('rendering reale → stampa simulata', async () => {
    const port = new SimulatedPrinterPort({ delayMs: 1 });
    await port.connect();
    const doc = addressDoc();
    doc.elements.push(text({ x: 10, y: 3, width: 70, height: 22, text: 'Ciao!' }));
    const job = await runPrint(port, doc, { copies: 2, density: 'normal' });
    expect(port.jobs).toHaveLength(1);
    expect([job.image.width, job.image.height]).toEqual([331, 980]);
    const prepared = await prepareLabel(doc, LW550_HEAD);
    expect(bitmapsEqual(port.jobs[0]!.driverBitmap, prepared.wireBitmap)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { getPixel } from '@mbtech-nl/bitmap';
import { prepareTestLabel } from '@/diagnostics/test-label';
import { areaFromDots, createDocument, createTextElement } from '@/model/document';
import { EDGE_SAFETY_DOTS, documentGeometry } from '@/model/geometry';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { prepareLabel } from '@/render/export';

/** Rotolo 25×54 con la larghezza vera letta dal chip. */
const SMALL = { ...findMediaById('multi-purpose-small')!, widthMm: 25.4 };

/** Punti neri nelle colonne [from, to) della testina. */
function blackInHeadColumns(bitmap: { widthPx: number; heightPx: number }, from: number, to: number): number {
  let n = 0;
  for (let y = 0; y < bitmap.heightPx; y++)
    for (let x = from; x < to; x++) if (getPixel(bitmap as never, x, y)) n++;
  return n;
}

describe('margine di sicurezza in stampa', () => {
  it.each(['along', 'across'] as const)(
    'testo nuovo con adattamento automatico (%s): punti 0–5 e 294–299 della testina bianchi',
    async (direction) => {
      const doc = createDocument(SMALL);
      doc.direction = direction;
      const g = documentGeometry(doc, LW550_HEAD);
      doc.elements.push(createTextElement(areaFromDots(g.safe), 'MMMMWWWW'));
      const p = await prepareLabel(doc, LW550_HEAD);
      expect(p.wireBitmap.widthPx).toBe(300);
      expect(blackInHeadColumns(p.wireBitmap, 0, EDGE_SAFETY_DOTS)).toBe(0);
      expect(blackInHeadColumns(p.wireBitmap, 300 - EDGE_SAFETY_DOTS, 300)).toBe(0);
      expect(blackInHeadColumns(p.wireBitmap, EDGE_SAFETY_DOTS, 300 - EDGE_SAFETY_DOTS)).toBeGreaterThan(0);
    },
  );

  it('stampa di prova: linea sul bordo esatto ai punti 0 e 299, bordo esterno ai punti 6 e 293', () => {
    const doc = createDocument(SMALL);
    doc.direction = 'along';
    const g = documentGeometry(doc, LW550_HEAD);
    const { wireBitmap } = prepareTestLabel(g, { format: '25×54 mm', density: 'normale' });
    expect(wireBitmap.widthPx).toBe(300);
    const fullColumn = (x: number) => {
      // Riga intera lungo il rotolo: nera per quasi tutta la lunghezza stampata.
      let n = 0;
      for (let y = 0; y < wireBitmap.heightPx; y++) if (getPixel(wireBitmap, x, y)) n++;
      return n === wireBitmap.heightPx;
    };
    for (const x of [0, 299, 6, 293]) expect(fullColumn(x), `punto ${x}`).toBe(true);
    // Fra la linea sul bordo e il bordo esterno ci sono solo le tacche (una riga ogni millimetro).
    for (const x of [2, 3, 4, 296, 297]) {
      let n = 0;
      for (let y = 0; y < wireBitmap.heightPx; y++) if (getPixel(wireBitmap, x, y)) n++;
      expect(n / wireBitmap.heightPx, `punto ${x}`).toBeLessThan(0.5); // tacche, non una linea continua
    }
  });
});

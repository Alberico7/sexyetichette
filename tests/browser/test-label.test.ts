import { describe, expect, it } from 'vitest';
import { getPixel } from '@mbtech-nl/bitmap';
import { drawTestLabel, prepareTestLabel } from '@/diagnostics/test-label';
import { computeGeometry } from '@/model/geometry';
import { CATALOG, LW550_HEAD } from '@/printer/media';

const black = (img: ReturnType<typeof drawTestLabel>, x: number, y: number) => img.data[(y * img.width + x) * 4]! < 128;

describe('etichetta di prova', () => {
  it.each(CATALOG.map((m) => [m.id, m] as const))('%s: bordo sul limite stampabile in entrambi i versi', (_id, media) => {
    for (const direction of ['along', 'across'] as const) {
      const g = computeGeometry(media, direction, 50, LW550_HEAD);
      const img = drawTestLabel(g, { format: 'x', density: 'normale' });
      expect(img.width).toBe(g.printable.width);
      expect(img.height).toBe(g.printable.height);
      for (let x = 0; x < img.width; x++) {
        expect(black(img, x, 0)).toBe(true);
        expect(black(img, x, img.height - 1)).toBe(true);
      }
      for (let y = 0; y < img.height; y++) {
        expect(black(img, 0, y)).toBe(true);
        expect(black(img, img.width - 1, y)).toBe(true);
      }
      // Il bitmap per la testina ha le dimensioni dell'area stampabile, ruotata.
      const prepared = prepareTestLabel(g, { format: 'x', density: 'normale' });
      expect(prepared.wireBitmap.widthPx).toBe(g.crossDots);
      expect(prepared.wireBitmap.heightPx).toBe(g.feedDots - LW550_HEAD.leadingDots - LW550_HEAD.trailingDots);
      expect(prepared.blackDots).toBeGreaterThan(0);
    }
  });

  it('lungo il rotolo: il triangolo «esce prima» finisce nelle prime righe stampate', () => {
    const media = CATALOG.find((m) => m.id === 'multi-purpose-small')!;
    const g = computeGeometry(media, 'along', 50, LW550_HEAD);
    const { wireBitmap } = prepareTestLabel(g, { format: '25×54 mm', density: 'normale' });
    // Colonna centrale attraverso la testina: nelle prime 60 righe (escluso il bordo) c'è il triangolo pieno.
    const mid = Math.floor(wireBitmap.widthPx / 2);
    let firstRows = 0;
    for (let y = 20; y < 60; y++) if (getPixel(wireBitmap, mid, y)) firstRows++;
    expect(firstRows).toBeGreaterThan(10);
  });
});

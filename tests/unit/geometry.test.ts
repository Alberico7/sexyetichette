import { describe, expect, it } from 'vitest';
import { computeGeometry, defaultDirection } from '@/model/geometry';
import { LW550_HEAD, customMedia, findMediaById } from '@/printer/media';

describe('caratteristiche della testina 550 (dal registro della libreria)', () => {
  it('672 punti a 300 dpi con 6 mm (71 punti) non stampabili all’inizio', () => {
    expect(LW550_HEAD).toEqual({ dpi: 300, headDots: 672, leadingDots: 71, trailingDots: 0 });
  });
});

describe('computeGeometry', () => {
  const address = findMediaById('address-standard')!;

  it('etichetta indirizzo 28×89 mm con testo lungo il rotolo', () => {
    const g = computeGeometry(address, 'along', 50, LW550_HEAD);
    expect(g.wireRotation).toBe(90);
    expect(g.crossDots).toBe(331); // 28 mm
    expect(g.feedDots).toBe(1051); // dal catalogo
    expect(g.label).toEqual({ width: 1051, height: 331 });
    expect(g.printable).toEqual({ x: 71, y: 0, width: 980, height: 331 });
    expect(g.deadZones).toEqual([{ x: 0, y: 0, width: 71, height: 331 }]);
  });

  it('stessa etichetta con testo attraverso il rotolo', () => {
    const g = computeGeometry(address, 'across', 50, LW550_HEAD);
    expect(g.wireRotation).toBe(0);
    expect(g.label).toEqual({ width: 331, height: 1051 });
    expect(g.printable).toEqual({ x: 0, y: 71, width: 331, height: 980 });
  });

  it('limita la larghezza ai 672 punti della testina (57 mm = 673 punti)', () => {
    const g = computeGeometry(findMediaById('multi-purpose-medium')!, 'across', 50, LW550_HEAD);
    expect(g.crossDots).toBe(672);
  });

  it('rotolo continuo: usa la lunghezza scelta', () => {
    const g = computeGeometry(findMediaById('continuous-57')!, 'along', 40, LW550_HEAD);
    expect(g.feedDots).toBe(472);
    expect(g.printable.width).toBe(472 - 71);
  });

  it('formato personalizzato', () => {
    const g = computeGeometry(customMedia(25, 25), 'across', 50, LW550_HEAD);
    expect(g.label).toEqual({ width: 295, height: 295 });
  });

  it('non produce dimensioni negative con etichette cortissime', () => {
    const g = computeGeometry(customMedia(20, 3), 'along', 50, LW550_HEAD);
    expect(g.printable.width).toBeGreaterThan(0);
  });
});

describe('defaultDirection', () => {
  it('segue il suggerimento del catalogo', () => {
    expect(defaultDirection(findMediaById('address-standard')!)).toBe('along');
  });
  it('senza suggerimento usa il lato più lungo', () => {
    expect(defaultDirection(customMedia(57, 32))).toBe('across');
    expect(defaultDirection(customMedia(25, 54))).toBe('along');
  });
});

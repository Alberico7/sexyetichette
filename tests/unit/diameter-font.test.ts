import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import opentype from 'opentype.js';
// @ts-expect-error script JavaScript senza tipi
import { DIAMETER_45_ANGLE_DEG, HEART, ISO_DIAMETER, buildDiameterFont } from '../../scripts/make-diameter-font.mjs';

function parse(buf: ArrayBuffer) {
  return opentype.parse(buf);
}

describe('mini-font del diametro ISO', () => {
  it('contiene solo ⌀ (U+2300), ∅ (U+2205) e ♥ (U+2665)', () => {
    const font = parse(buildDiameterFont().toArrayBuffer());
    expect(font.glyphs.length).toBe(4); // .notdef + ⌀ + ∅ + ♥
    expect(font.charToGlyph('∅').name).toBe('uni2205');
    expect(font.charToGlyph('♥').name).toBe('uni2665');
    const g = font.charToGlyph('\u2300');
    expect(g.name).toBe('uni2300');
    expect(font.charToGlyph('A').index).toBe(0); // nessun altro carattere
  });

  it('proporzioni ISO: alto quanto le maiuscole, cerchio 0,77 h, barra a 75°', () => {
    const h = 0.716 * 1000;
    const g = parse(buildDiameterFont().toArrayBuffer()).charToGlyph('\u2300');
    const bb = g.getBoundingBox();
    expect((bb.y2 - bb.y1) / h).toBeCloseTo(ISO_DIAMETER.slashTop - ISO_DIAMETER.slashBottom, 2);
    expect((bb.x2 - bb.x1) / h).toBeCloseTo(ISO_DIAMETER.outerDiameter, 2);
    expect(ISO_DIAMETER.slashAngleDeg).toBe(75);
  });

  it('⌀ a 45° su ∅: stesso cerchio, la barra resta dentro il cerchio', () => {
    // Vedi docs/2026-11-09-diametro-45.md.
    const h = 0.716 * 1000;
    const font = parse(buildDiameterFont().toArrayBuffer());
    const iso = font.charToGlyph('⌀');
    const g = font.charToGlyph('∅');
    expect(DIAMETER_45_ANGLE_DEG).toBe(45);
    expect(g.advanceWidth).toBe(iso.advanceWidth);
    const bb = g.getBoundingBox();
    expect((bb.x2 - bb.x1) / h).toBeCloseTo(ISO_DIAMETER.outerDiameter, 2);
    expect((bb.y2 - bb.y1) / h).toBeCloseTo(ISO_DIAMETER.outerDiameter, 2);
    expect(bb.y1 / h).toBeCloseTo(ISO_DIAMETER.centerY - ISO_DIAMETER.outerDiameter / 2, 2);
  });

  it('cuore: alto quanto le maiuscole, sulla linea di base, largo come previsto', () => {
    const h = 0.716 * 1000;
    const bb = parse(buildDiameterFont().toArrayBuffer()).charToGlyph('♥').getBoundingBox();
    expect(bb.y1).toBeCloseTo(0, 0);
    expect((bb.y2 - bb.y1) / h).toBeCloseTo(1, 2);
    expect((bb.x2 - bb.x1) / h).toBeCloseTo(HEART.width, 2);
  });

  it('il file incluso nel progetto corrisponde allo script', () => {
    const file = readFileSync('src/assets/fonts/diametro.otf');
    const committed = parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const fresh = parse(buildDiameterFont().toArrayBuffer());
    for (const c of ['⌀', '∅', '♥']) {
      expect(committed.charToGlyph(c).index, c).toBeGreaterThan(0);
      expect(committed.charToGlyph(c).path.toPathData(2)).toBe(fresh.charToGlyph(c).path.toPathData(2));
    }
  });
});

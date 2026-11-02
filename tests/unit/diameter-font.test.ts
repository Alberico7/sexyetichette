import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import opentype from 'opentype.js';
// @ts-expect-error script JavaScript senza tipi
import { ISO_DIAMETER, buildDiameterFont } from '../../scripts/make-diameter-font.mjs';

function parse(buf: ArrayBuffer) {
  return opentype.parse(buf);
}

describe('mini-font del diametro ISO', () => {
  it('contiene un solo glifo, mappato su U+2300', () => {
    const font = parse(buildDiameterFont().toArrayBuffer());
    expect(font.glyphs.length).toBe(2); // .notdef + ⌀
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

  it('il file incluso nel progetto corrisponde allo script', () => {
    const file = readFileSync('src/assets/fonts/diametro.otf');
    const committed = parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer);
    const fresh = parse(buildDiameterFont().toArrayBuffer());
    expect(committed.charToGlyph('\u2300').path.toPathData(2)).toBe(fresh.charToGlyph('\u2300').path.toPathData(2));
  });
});

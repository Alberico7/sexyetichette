import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import opentype from 'opentype.js';
// @ts-expect-error script JavaScript senza tipi
import * as fontScript from '../../scripts/make-diameter-font.mjs';

const { DIAMETER_45_ANGLE_DEG, EMPTY_HEART_STROKE, HEART, ISO_DIAMETER, buildDiameterFont } = fontScript;

function parse(buf: ArrayBuffer) {
  return opentype.parse(buf);
}

describe('mini-font del diametro ISO', () => {
  it('contiene solo ⌀ (U+2300), ∅ (U+2205), ♥ (U+2665) e ♡ (U+2661)', () => {
    const font = parse(buildDiameterFont().toArrayBuffer());
    expect(font.glyphs.length).toBe(5); // .notdef + ⌀ + ∅ + ♥ + ♡
    expect(font.charToGlyph('∅').name).toBe('uni2205');
    expect(font.charToGlyph('♥').name).toBe('uni2665');
    expect(font.charToGlyph('♡').name).toBe('uni2661');
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

  it('cuore vuoto: stesso contorno esterno del ♥ e un bordo interno a distanza costante', () => {
    // Vedi docs/2026-11-09-cuore-vuoto.md.
    const h = 0.716 * 1000;
    const font = parse(buildDiameterFont().toArrayBuffer());
    const full = font.charToGlyph('♥');
    const empty = font.charToGlyph('♡');
    expect(empty.advanceWidth).toBe(full.advanceWidth);
    expect(empty.getBoundingBox()).toEqual(full.getBoundingBox());
    // Il primo contorno è identico a quello del ♥.
    const cmds = empty.path.commands;
    const firstClose = cmds.findIndex((c: { type: string }) => c.type === 'Z');
    expect(cmds.slice(0, firstClose + 1)).toEqual(full.path.commands);
    // Il secondo contorno (il buco) è fatto di punti tutti a circa 0,083 h dal contorno esterno.
    const inner = cmds.slice(firstClose + 1).filter((c: { type: string }) => c.type === 'M' || c.type === 'L') as {
      x: number;
      y: number;
    }[];
    expect(inner.length).toBeGreaterThan(50);
    const outer: { x: number; y: number }[] = [];
    // Contorno esterno campionato fitto.
    let prev = { x: 0, y: 0 };
    for (const c of full.path.commands) {
      if (c.type === 'M') prev = { x: c.x, y: c.y };
      else if (c.type === 'C') {
        for (let i = 1; i <= 200; i++) {
          const t = i / 200;
          const u = 1 - t;
          outer.push({
            x: u * u * u * prev.x + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
            y: u * u * u * prev.y + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
          });
        }
        prev = { x: c.x, y: c.y };
      }
    }
    const s = EMPTY_HEART_STROKE * h;
    expect(EMPTY_HEART_STROKE).toBe(ISO_DIAMETER.stroke);
    for (const q of inner) {
      const d = Math.min(...outer.map((p) => Math.hypot(p.x - q.x, p.y - q.y)));
      expect(d).toBeGreaterThan(s - 2);
      expect(d).toBeLessThan(s + 2);
    }
  });

  it('il file incluso nel progetto corrisponde allo script', () => {
    const file = readFileSync('src/assets/fonts/diametro.otf');
    const committed = parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
    const fresh = parse(buildDiameterFont().toArrayBuffer());
    for (const c of ['⌀', '∅', '♥', '♡']) {
      expect(committed.charToGlyph(c).index, c).toBeGreaterThan(0);
      expect(committed.charToGlyph(c).path.toPathData(2)).toBe(fresh.charToGlyph(c).path.toPathData(2));
    }
  });
});

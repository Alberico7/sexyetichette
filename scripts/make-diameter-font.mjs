// Genera src/assets/fonts/diametro.otf: un mini-font con il solo simbolo del
// diametro ⌀ (U+2300), disegnato da zero con le proporzioni della ISO 3098.
// Vedi docs/2026-11-02-simbolo-diametro-iso-proporzionato.md.
//
// Uso: node scripts/make-diameter-font.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import opentype from 'opentype.js';

export const UNITS_PER_EM = 1000;
/** Altezza delle maiuscole di riferimento (in em), simile ai caratteri senza grazie più comuni. */
export const DESIGN_CAP_HEIGHT_EM = 0.716;

/** Proporzioni del simbolo in unità dell'altezza delle maiuscole (h). */
export const ISO_DIAMETER = {
  /** Inclinazione della barra sull'orizzontale, in gradi. */
  slashAngleDeg: 75,
  /** Diametro esterno del cerchio. */
  outerDiameter: 0.77,
  /** Altezza del centro del cerchio dalla linea di base. */
  centerY: 0.44,
  /** Spessore del tratto (cerchio e barra). */
  stroke: 0.083,
  /** Estremi verticali della barra, estremità arrotondate comprese. */
  slashBottom: -0.057,
  slashTop: 0.952,
  /** Margine sinistro e avanzamento. */
  leftBearing: 0.066,
  advance: 0.9,
};

const K = 0.5522847498; // approssimazione del quarto di cerchio con una curva cubica

function quarterArc(path, c, p0, p1) {
  // Arco antiorario da p0 a p1 attorno a c (90°).
  const t0 = { x: -(p0.y - c.y), y: p0.x - c.x };
  const t1 = { x: -(p1.y - c.y), y: p1.x - c.x };
  path.curveTo(p0.x + K * t0.x, p0.y + K * t0.y, p1.x - K * t1.x, p1.y - K * t1.y, p1.x, p1.y);
}

/** Cerchio come contorno chiuso; `ccw` = antiorario (contorno esterno). */
function circle(path, cx, cy, r, ccw) {
  const c = { x: cx, y: cy };
  const pts = [
    { x: cx + r, y: cy },
    { x: cx, y: cy + r },
    { x: cx - r, y: cy },
    { x: cx, y: cy - r },
  ];
  const order = ccw ? pts : [pts[0], pts[3], pts[2], pts[1]];
  path.moveTo(order[0].x, order[0].y);
  for (let i = 0; i < 4; i++) {
    const p0 = order[i];
    const p1 = order[(i + 1) % 4];
    if (ccw) quarterArc(path, c, p0, p1);
    else {
      // Arco orario: equivale all'antiorario percorso al contrario.
      const t0 = { x: p0.y - c.y, y: -(p0.x - c.x) };
      const t1 = { x: p1.y - c.y, y: -(p1.x - c.x) };
      path.curveTo(p0.x + K * t0.x, p0.y + K * t0.y, p1.x - K * t1.x, p1.y - K * t1.y, p1.x, p1.y);
    }
  }
  path.close();
}

/** Barra con estremità arrotondate, da A a B, spessore 2·w, in senso antiorario. */
function roundedBar(path, A, B, w) {
  const len = Math.hypot(B.x - A.x, B.y - A.y);
  const u = { x: (B.x - A.x) / len, y: (B.y - A.y) / len };
  const n = { x: -u.y, y: u.x }; // normale a sinistra
  const add = (p, v, s) => ({ x: p.x + v.x * s, y: p.y + v.y * s });
  const a1 = add(A, n, -w);
  const b1 = add(B, n, -w);
  const bTip = add(B, u, w);
  const b2 = add(B, n, w);
  const a2 = add(A, n, w);
  const aTip = add(A, u, -w);
  path.moveTo(a1.x, a1.y);
  path.lineTo(b1.x, b1.y);
  quarterArc(path, B, b1, bTip);
  quarterArc(path, B, bTip, b2);
  path.lineTo(a2.x, a2.y);
  quarterArc(path, A, a2, aTip);
  quarterArc(path, A, aTip, a1);
  path.close();
}

export function buildDiameterGlyphPath() {
  const h = DESIGN_CAP_HEIGHT_EM * UNITS_PER_EM;
  const g = ISO_DIAMETER;
  const s = g.stroke * h;
  const outerR = (g.outerDiameter * h) / 2;
  const cx = g.leftBearing * h + outerR;
  const cy = g.centerY * h;
  const path = new opentype.Path();
  // Anello: contorno esterno antiorario, interno orario.
  circle(path, cx, cy, outerR, true);
  circle(path, cx, cy, outerR - s, false);
  // Barra a 75° passante per il centro.
  const a = (g.slashAngleDeg * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) };
  const w = s / 2;
  const tTop = (g.slashTop * h - w - cy) / u.y;
  const tBottom = (cy - (g.slashBottom * h + w)) / u.y;
  roundedBar(path, { x: cx - u.x * tBottom, y: cy - u.y * tBottom }, { x: cx + u.x * tTop, y: cy + u.y * tTop }, w);
  return { path, advanceWidth: Math.round(g.advance * h) };
}

export function buildDiameterFont() {
  const { path, advanceWidth } = buildDiameterGlyphPath();
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: new opentype.Path() });
  const diameter = new opentype.Glyph({ name: 'uni2300', unicode: 0x2300, advanceWidth, path });
  return new opentype.Font({
    familyName: 'Etichettatrice Diametro',
    styleName: 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: 800,
    descender: -200,
    designer: 'Gli autori di Etichettatrice',
    license: 'MIT',
    version: '1.000',
    glyphs: [notdef, diameter],
  });
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('make-diameter-font.mjs')) {
  const font = buildDiameterFont();
  mkdirSync('src/assets/fonts', { recursive: true });
  writeFileSync('src/assets/fonts/diametro.otf', Buffer.from(font.toArrayBuffer()));
  console.log('Creato src/assets/fonts/diametro.otf');
}

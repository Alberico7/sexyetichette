// Genera src/assets/fonts/diametro.otf: un mini-font con il simbolo del diametro
// ⌀ (U+2300), disegnato da zero con le proporzioni della ISO 3098, la sua variante
// con la barra a 45° su ∅ (U+2205) e il cuore ♥ (U+2665).
// Vedi docs/2026-11-02-simbolo-diametro-iso-proporzionato.md e docs/2026-11-09-diametro-45.md.
// Il cuore: docs/2026-11-08-cuore-nascosto.md.
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

/** Inclinazione della barra della variante su ∅ (U+2205). Vedi docs/2026-11-09-diametro-45.md. */
export const DIAMETER_45_ANGLE_DEG = 45;

/**
 * ⌀ con la barra inclinata di `angleDeg`. La barra sporge dal cerchio della stessa
 * lunghezza (misurata lungo la barra) qualunque sia l'inclinazione: a 75° è il ⌀ ISO,
 * a 45° la barra resta dentro la larghezza del cerchio.
 */
export function buildDiameterGlyphPath(angleDeg = ISO_DIAMETER.slashAngleDeg) {
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
  // Lunghezze della barra dal centro, ricavate dalla barra ISO a 75°.
  const w = s / 2;
  const iso = Math.sin((g.slashAngleDeg * Math.PI) / 180);
  const tTop = (g.slashTop * h - w - cy) / iso;
  const tBottom = (cy - (g.slashBottom * h + w)) / iso;
  // Barra passante per il centro, inclinata di angleDeg.
  const a = (angleDeg * Math.PI) / 180;
  const u = { x: Math.cos(a), y: Math.sin(a) };
  roundedBar(path, { x: cx - u.x * tBottom, y: cy - u.y * tBottom }, { x: cx + u.x * tTop, y: cy + u.y * tTop }, w);
  return { path, advanceWidth: Math.round(g.advance * h) };
}

/** Proporzioni del cuore ♥ in unità dell'altezza delle maiuscole (h). Vedi docs/2026-11-08-cuore-nascosto.md. */
export const HEART = {
  /** Larghezza del cuore. */
  width: 0.95,
  /** Margine a sinistra e a destra. */
  sideBearing: 0.08,
};

/**
 * Cuore pieno ♥: dalla punta in basso (sulla linea di base) ai due lobi,
 * alto esattamente quanto le maiuscole. Contorno antiorario.
 */
export function buildHeartGlyphPath() {
  const h = DESIGN_CAP_HEIGHT_EM * UNITS_PER_EM;
  // Forma disegnata in un quadrato 1×1 (y verso l'alto), poi scalata e appoggiata sulla riga.
  const W = 1;
  const cx = 0.5;
  const segs = [
    // punta → lobo destro
    [cx + 0.18 * W, 0.22, cx + 0.5 * W, 0.42, cx + 0.5 * W, 0.7],
    // lobo destro → incavo centrale
    [cx + 0.5 * W, 0.98, cx + 0.06 * W, 1.08, cx, 0.8],
    // incavo centrale → lobo sinistro
    [cx - 0.06 * W, 1.08, cx - 0.5 * W, 0.98, cx - 0.5 * W, 0.7],
    // lobo sinistro → punta
    [cx - 0.5 * W, 0.42, cx - 0.18 * W, 0.22, cx, 0],
  ];
  const raw = new opentype.Path();
  raw.moveTo(cx, 0);
  for (const s of segs) raw.curveTo(...s);
  raw.close();
  const bb = raw.getBoundingBox();
  const sy = h / (bb.y2 - bb.y1);
  const sx = (HEART.width * h) / (bb.x2 - bb.x1);
  const left = HEART.sideBearing * h;
  const X = (x) => Math.round(left + (x - bb.x1) * sx);
  const Y = (y) => Math.round((y - bb.y1) * sy);
  const path = new opentype.Path();
  for (const c of raw.commands) {
    if (c.type === 'M') path.moveTo(X(c.x), Y(c.y));
    else if (c.type === 'C') path.curveTo(X(c.x1), Y(c.y1), X(c.x2), Y(c.y2), X(c.x), Y(c.y));
    else if (c.type === 'Z') path.close();
  }
  return { path, advanceWidth: Math.round((HEART.width + 2 * HEART.sideBearing) * h) };
}

export function buildDiameterFont() {
  const { path, advanceWidth } = buildDiameterGlyphPath();
  const notdef = new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: new opentype.Path() });
  const diameter = new opentype.Glyph({ name: 'uni2300', unicode: 0x2300, advanceWidth, path });
  const d45 = buildDiameterGlyphPath(DIAMETER_45_ANGLE_DEG);
  const diameter45 = new opentype.Glyph({
    name: 'uni2205',
    unicode: 0x2205,
    advanceWidth: d45.advanceWidth,
    path: d45.path,
  });
  const h = buildHeartGlyphPath();
  const heart = new opentype.Glyph({ name: 'uni2665', unicode: 0x2665, advanceWidth: h.advanceWidth, path: h.path });
  return new opentype.Font({
    familyName: 'Etichettatrice Diametro',
    styleName: 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: 800,
    descender: -200,
    designer: 'Gli autori di Etichettatrice',
    license: 'MIT',
    version: '1.000',
    glyphs: [notdef, diameter, diameter45, heart],
  });
}

if (
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('make-diameter-font.mjs')
) {
  const font = buildDiameterFont();
  mkdirSync('src/assets/fonts', { recursive: true });
  writeFileSync('src/assets/fonts/diametro.otf', Buffer.from(font.toArrayBuffer()));
  console.log('Creato src/assets/fonts/diametro.otf');
}

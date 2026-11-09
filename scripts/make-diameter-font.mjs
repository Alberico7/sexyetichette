// Genera src/assets/fonts/diametro.otf: un mini-font con il simbolo del diametro
// ⌀ (U+2300), disegnato da zero con le proporzioni della ISO 3098, la sua variante
// con la barra a 45° su ∅ (U+2205), il cuore ♥ (U+2665) e il cuore vuoto ♡ (U+2661).
// Vedi docs/2026-11-02-simbolo-diametro-iso-proporzionato.md e docs/2026-11-09-diametro-45.md.
// I cuori: docs/2026-11-08-cuore-nascosto.md e docs/2026-11-09-cuore-vuoto.md.
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
 * Contorno del cuore ♥ già scalato e appoggiato sulla riga (unità del font, non arrotondate):
 * punto di partenza (la punta) e quattro curve cubiche in senso antiorario.
 */
function heartOutline() {
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
  const P = (x, y) => ({ x: left + (x - bb.x1) * sx, y: (y - bb.y1) * sy });
  const start = P(cx, 0);
  const curves = [];
  let p0 = start;
  for (const s of segs) {
    const c = [p0, P(s[0], s[1]), P(s[2], s[3]), P(s[4], s[5])];
    curves.push(c);
    p0 = c[3];
  }
  return { h, start, curves, advanceWidth: Math.round((HEART.width + 2 * HEART.sideBearing) * h) };
}

/**
 * Cuore pieno ♥: dalla punta in basso (sulla linea di base) ai due lobi,
 * alto esattamente quanto le maiuscole. Contorno antiorario.
 */
export function buildHeartGlyphPath() {
  const { start, curves, advanceWidth } = heartOutline();
  const r = Math.round;
  const path = new opentype.Path();
  path.moveTo(r(start.x), r(start.y));
  for (const [, c1, c2, e] of curves) path.curveTo(r(c1.x), r(c1.y), r(c2.x), r(c2.y), r(e.x), r(e.y));
  path.close();
  return { path, advanceWidth };
}

function bezierPoint([p0, p1, p2, p3], t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

function bezierTangent([p0, p1, p2, p3], t) {
  const u = 1 - t;
  const x = 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x);
  const y = 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y);
  const len = Math.hypot(x, y);
  return { x: x / len, y: y / len };
}

/** Distanza di `q` dalla spezzata chiusa `poly`. */
function distanceToPolyline(q, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2));
    best = Math.min(best, Math.hypot(q.x - (a.x + t * dx), q.y - (a.y + t * dy)));
  }
  return best;
}

/** Spessore del bordo del cuore vuoto, in unità dell'altezza delle maiuscole: come il tratto del ⌀. */
export const EMPTY_HEART_STROKE = ISO_DIAMETER.stroke;

/**
 * Cuore vuoto ♡: lo stesso contorno esterno del ♥ e, dentro, un contorno a distanza
 * costante (il bordo), ottenuto spostando il contorno esterno verso l'interno lungo
 * la perpendicolare. Nell'incavo in alto il bordo interno gira con un arco; alla punta
 * si tolgono i punti che finirebbero oltre il lato opposto.
 * Vedi docs/2026-11-09-cuore-vuoto.md.
 */
export function buildEmptyHeartGlyphPath() {
  const { h, curves, advanceWidth } = heartOutline();
  const { path } = buildHeartGlyphPath();
  const s = EMPTY_HEART_STROKE * h;
  const STEPS = 64;
  // Contorno esterno fitto, per misurare le distanze.
  const outer = [];
  for (const c of curves) for (let i = 0; i < 256; i++) outer.push(bezierPoint(c, i / 256));
  // Candidati del contorno interno, nello stesso verso (antiorario): l'interno è a sinistra.
  const inward = (t) => ({ x: -t.y, y: t.x });
  const candidates = [];
  curves.forEach((c, k) => {
    for (let i = 0; i <= STEPS; i++) {
      const p = bezierPoint(c, i / STEPS);
      const n = inward(bezierTangent(c, i / STEPS));
      candidates.push({ x: p.x + n.x * s, y: p.y + n.y * s });
    }
    // Dopo la seconda curva c'è l'incavo (angolo rientrante): arco di raggio s attorno al vertice.
    if (k === 1) {
      const v = c[3];
      const n1 = inward(bezierTangent(c, 1));
      const n2 = inward(bezierTangent(curves[2], 0));
      const a1 = Math.atan2(n1.y, n1.x);
      const a2 = Math.atan2(n2.y, n2.x);
      for (let i = 1; i < 16; i++) {
        const a = a1 + ((a2 - a1) * i) / 16;
        candidates.push({ x: v.x + Math.cos(a) * s, y: v.y + Math.sin(a) * s });
      }
    }
  });
  // Restano solo i punti a distanza ≥ s da tutto il contorno esterno (alla punta i due lati si incrociano).
  const inner = [];
  for (const q of candidates) {
    if (distanceToPolyline(q, outer) < s - 0.5) continue;
    const r = { x: Math.round(q.x), y: Math.round(q.y) };
    const last = inner[inner.length - 1];
    if (!last || last.x !== r.x || last.y !== r.y) inner.push(r);
  }
  const first = inner[0];
  const end = inner[inner.length - 1];
  if (inner.length > 1 && first.x === end.x && first.y === end.y) inner.pop();
  // Contorno interno in senso orario (buco): si percorre al contrario.
  inner.reverse();
  path.moveTo(inner[0].x, inner[0].y);
  for (const q of inner.slice(1)) path.lineTo(q.x, q.y);
  path.close();
  return { path, advanceWidth };
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
  const e = buildEmptyHeartGlyphPath();
  const emptyHeart = new opentype.Glyph({
    name: 'uni2661',
    unicode: 0x2661,
    advanceWidth: e.advanceWidth,
    path: e.path,
  });
  return new opentype.Font({
    familyName: 'Etichettatrice Diametro',
    styleName: 'Regular',
    unitsPerEm: UNITS_PER_EM,
    ascender: 800,
    descender: -200,
    designer: 'Gli autori di Etichettatrice',
    license: 'MIT',
    version: '1.000',
    glyphs: [notdef, diameter, diameter45, heart, emptyHeart],
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

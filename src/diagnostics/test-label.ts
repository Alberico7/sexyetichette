/**
 * Etichetta di prova per verificare verso, zona non stampabile e allineamento.
 *
 * Disegnata direttamente a 1 pixel per punto della testina, nel verso di
 * lettura, e poi convertita con lo stesso percorso della stampa normale
 * (rotazione verso la testina, soglia a 1 bit).
 */
import type { LabelGeometry } from '@/model/geometry';
import { PRINT_DPI } from '@/model/units';
import { bitmapToRgba, countBlack, toWireBitmap } from '@/printer/raster';
import type { RgbaImage } from '@/printer/types';
import type { PreparedLabel } from '@/render/export';

export interface TestLabelText {
  /** Formato, per esempio «25×54 mm». */
  format: string;
  /** Densità in italiano. */
  density: string;
}

const dotsPerMm = PRINT_DPI / 25.4;

/** Punto dell'etichetta (in punti) alla distanza `mm` dal bordo. */
function mmToLabelDot(mm: number): number {
  return Math.round(mm * dotsPerMm);
}

/** Disegna l'area stampabile dell'etichetta di prova nel verso di lettura. */
export function drawTestLabel(geometry: LabelGeometry, text: TestLabelText): RgbaImage {
  const { printable, label } = geometry;
  const W = printable.width;
  const H = printable.height;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D non disponibile');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#000';

  const short = Math.min(W, H);
  const t1 = Math.max(6, Math.round(short * 0.035));
  const font = (px: number, bold = true) => `${bold ? 'bold ' : ''}${Math.max(9, Math.round(px))}px sans-serif`;

  // Area consigliata (stampabile meno il margine di sicurezza), nelle coordinate dell'immagine.
  const sx = geometry.safe.x - printable.x;
  const sy = geometry.safe.y - printable.y;
  const SW = geometry.safe.width;
  const SH = geometry.safe.height;

  // Bordo esterno di 1 punto sul limite dell'area consigliata.
  ctx.fillRect(sx, sy, SW, 1);
  ctx.fillRect(sx, sy + SH - 1, SW, 1);
  ctx.fillRect(sx, sy, 1, SH);
  ctx.fillRect(sx + SW - 1, sy, 1, SH);

  // Linea sul bordo esatto dell'etichetta, nel margine di sicurezza: mostra se il bordo vero si stampa.
  if (geometry.safetyZones.length) {
    if (geometry.wireRotation === 90) {
      ctx.fillRect(0, 0, W, 1);
      ctx.fillRect(0, H - 1, W, 1);
    } else {
      ctx.fillRect(0, 0, 1, H);
      ctx.fillRect(W - 1, 0, 1, H);
    }
  }

  // Bordo tratteggiato 1 mm più all'interno.
  const inset = mmToLabelDot(1);
  const dash = 6;
  for (let x = sx + inset; x < sx + SW - inset; x += dash * 2) {
    const w = Math.min(dash, sx + SW - inset - x);
    ctx.fillRect(x, sy + inset, w, 1);
    ctx.fillRect(x, sy + SH - 1 - inset, w, 1);
  }
  for (let y = sy + inset; y < sy + SH - inset; y += dash * 2) {
    const h = Math.min(dash, sy + SH - inset - y);
    ctx.fillRect(sx + inset, y, 1, h);
    ctx.fillRect(sx + SW - 1 - inset, y, 1, h);
  }

  // Tacche ogni millimetro, misurate dal bordo dell'etichetta (zona non stampabile compresa).
  const numberFont = font(t1 * 1.6, false);
  ctx.font = numberFont;
  ctx.textBaseline = 'top';
  const labelWidthMm = label.width / dotsPerMm;
  const labelHeightMm = label.height / dotsPerMm;
  for (let mm = 0; mm <= labelWidthMm; mm++) {
    const x = mmToLabelDot(mm) - printable.x;
    if (x < 0 || x >= W) continue;
    const len = mm % 10 === 0 ? t1 * 3 : mm % 5 === 0 ? t1 * 2 : t1;
    ctx.fillRect(x, 0, 1, len);
    ctx.fillRect(x, H - len, 1, len);
    if (mm % 10 === 0 && mm > 0) {
      ctx.textAlign = 'center';
      ctx.fillText(String(mm), x, t1 * 3 + 2);
    }
  }
  for (let mm = 0; mm <= labelHeightMm; mm++) {
    const y = mmToLabelDot(mm) - printable.y;
    if (y < 0 || y >= H) continue;
    const len = mm % 10 === 0 ? t1 * 3 : mm % 5 === 0 ? t1 * 2 : t1;
    ctx.fillRect(0, y, len, 1);
    ctx.fillRect(W - len, y, len, 1);
    if (mm % 10 === 0 && mm > 0) {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(mm), t1 * 3 + 2, y);
      ctx.textBaseline = 'top';
    }
  }

  // Angoli numerati 1–4 in senso orario dall'alto a sinistra.
  const cornerFont = font(t1 * 2.2);
  ctx.font = cornerFont;
  const c = inset + t1 * 4;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('1', c, c);
  ctx.fillText('2', W - c, c);
  ctx.fillText('3', W - c, H - c);
  ctx.fillText('4', c, H - c);

  // Lato che esce per primo dalla stampante (inizio dell'etichetta): triangolo verso il bordo.
  const tri = t1 * 2.5;
  ctx.beginPath();
  if (geometry.wireRotation === 90) {
    // Lungo il rotolo: l'inizio è il lato sinistro.
    const cy = H / 2;
    const x0 = inset + t1 * 1.5;
    ctx.moveTo(x0, cy);
    ctx.lineTo(x0 + tri, cy - tri * 0.7);
    ctx.lineTo(x0 + tri, cy + tri * 0.7);
  } else {
    // Attraverso il rotolo: l'inizio è il lato in alto.
    const cx = W / 2;
    const y0 = inset + t1 * 4.5;
    ctx.moveTo(cx, y0);
    ctx.lineTo(cx - tri * 0.7, y0 + tri);
    ctx.lineTo(cx + tri * 0.7, y0 + tri);
  }
  ctx.closePath();
  ctx.fill();

  // Testi centrali.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const main = Math.min(short * 0.2, W / 6);
  ctx.font = font(main);
  ctx.fillText('ALTO', W / 2, geometry.wireRotation === 90 ? H * 0.3 : H * 0.42);
  ctx.font = font(main * 0.5, false);
  ctx.fillText(`PROVA ${text.format}`, W / 2, geometry.wireRotation === 90 ? H * 0.55 : H * 0.6);
  ctx.fillText(`densità ${text.density} · triangolo: esce prima`, W / 2, H * 0.72);

  const pixels = ctx.getImageData(0, 0, W, H);
  return {
    width: W,
    height: H,
    data: new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
  };
}

/** Etichetta di prova pronta da stampare, come `prepareLabel`. */
export function prepareTestLabel(geometry: LabelGeometry, text: TestLabelText): PreparedLabel & { blackDots: number } {
  const image = drawTestLabel(geometry, text);
  const wireBitmap = toWireBitmap(image, { rotate: geometry.wireRotation });
  return { geometry, wireBitmap, wireImage: bitmapToRgba(wireBitmap), blackDots: countBlack(wireBitmap) };
}

/**
 * Conversione dell'immagine dell'etichetta nel bitmap a 1 bit che riceve la stampante.
 *
 * Il risultato viene rimandato al driver come RGBA con soli pixel bianchi o neri:
 * il dithering del driver lascia invariati questi pixel, quindi l'anteprima
 * mostra esattamente ciò che verrà stampato (verificato nei test).
 */
import { getPixel, renderImage, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { RgbaImage } from './types';

export interface RasterOptions {
  /** Rotazione dall'orientamento di lettura a quello della testina. */
  rotate: 0 | 90 | 180 | 270;
  /** Soglia di nero (0–255). Le immagini fotografiche vengono retinate prima, nel rendering. */
  threshold?: number;
}

/** Immagine nel verso di lettura → bitmap nell'orientamento della testina. */
export function toWireBitmap(image: RgbaImage, options: RasterOptions): LabelBitmap {
  return renderImage(image, {
    threshold: options.threshold ?? 128,
    dither: false,
    rotate: options.rotate,
  });
}

/**
 * Chiama `visit(x, y)` per ogni punto nero, leggendo il bitmap un byte alla volta
 * (i byte vuoti, la maggior parte, vengono saltati).
 */
export function forEachBlack(bitmap: LabelBitmap, visit: (x: number, y: number) => void): void {
  const { widthPx, heightPx, data } = bitmap;
  const rowBytes = Math.ceil(widthPx / 8);
  for (let y = 0; y < heightPx; y++) {
    const base = y * rowBytes;
    for (let b = 0; b < rowBytes; b++) {
      const byte = data[base + b]!;
      if (byte === 0) continue;
      const x0 = b * 8;
      for (let bit = 0; bit < 8; bit++) {
        if (byte & (0x80 >> bit)) {
          const x = x0 + bit;
          if (x < widthPx) visit(x, y);
        }
      }
    }
  }
}

/** Bitmap → RGBA bianco e nero (nero = 1). */
export function bitmapToRgba(bitmap: LabelBitmap): RgbaImage {
  const { widthPx, heightPx } = bitmap;
  const data = new Uint8Array(widthPx * heightPx * 4).fill(255);
  forEachBlack(bitmap, (x, y) => {
    const i = (y * widthPx + x) * 4;
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  });
  return { width: widthPx, height: heightPx, data };
}

/** Numero di punti neri, utile per i test e per avvisare se l'etichetta è vuota. */
export function countBlack(bitmap: LabelBitmap): number {
  let n = 0;
  forEachBlack(bitmap, () => n++);
  return n;
}

export function bitmapsEqual(a: LabelBitmap, b: LabelBitmap): boolean {
  if (a.widthPx !== b.widthPx || a.heightPx !== b.heightPx) return false;
  for (let y = 0; y < a.heightPx; y++) {
    for (let x = 0; x < a.widthPx; x++) if (getPixel(a, x, y) !== getPixel(b, x, y)) return false;
  }
  return true;
}

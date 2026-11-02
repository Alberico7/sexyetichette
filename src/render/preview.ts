/**
 * Anteprima fedele: disegna il bitmap che verrà inviato alla stampante,
 * riportato nel verso di lettura, sull'etichetta intera a 1 pixel per punto.
 */
import { rotateBitmap, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { LabelGeometry } from '@/model/geometry';
import { forEachBlack } from '@/printer/raster';

/** Riporta il bitmap della testina nel verso di lettura. */
export function wireToReading(bitmap: LabelBitmap, wireRotation: 0 | 90): LabelBitmap {
  return wireRotation === 90 ? rotateBitmap(bitmap, 270) : bitmap;
}

export function paintPreview(
  canvas: HTMLCanvasElement,
  wireBitmap: LabelBitmap,
  geometry: LabelGeometry,
): void {
  const { label, printable, deadZones } = geometry;
  canvas.width = label.width;
  canvas.height = label.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, label.width, label.height);

  // Il bitmap della testina viene riportato nel verso di lettura senza copie intermedie.
  // Rotazione di 90° (vedi rotateBitmap): punto testina (x, y) ↔ lettura (y, larghezza − 1 − x).
  const rotated = geometry.wireRotation === 90;
  const rw = rotated ? wireBitmap.heightPx : wireBitmap.widthPx;
  const rh = rotated ? wireBitmap.widthPx : wireBitmap.heightPx;
  const img = ctx.createImageData(rw, rh);
  const px = new Uint32Array(img.data.buffer);
  px.fill(0xffffffff); // bianco opaco
  const black = 0xff000000; // nero opaco (byte in ordine little-endian: R, G, B, A)
  forEachBlack(wireBitmap, (x, y) => {
    if (rotated) px[(rh - 1 - x) * rw + y] = black;
    else px[y * rw + x] = black;
  });
  ctx.putImageData(img, printable.x, printable.y);

  // Zone non stampabili tratteggiate.
  for (const z of deadZones) {
    ctx.save();
    ctx.fillStyle = 'rgba(200, 60, 60, 0.12)';
    ctx.fillRect(z.x, z.y, z.width, z.height);
    ctx.beginPath();
    ctx.rect(z.x, z.y, z.width, z.height);
    ctx.clip();
    ctx.strokeStyle = 'rgba(200, 60, 60, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let d = -z.height; d < z.width; d += 16) {
      ctx.moveTo(z.x + d, z.y + z.height);
      ctx.lineTo(z.x + d + z.height, z.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Anteprima fedele: disegna il bitmap che verrà inviato alla stampante,
 * riportato nel verso di lettura, sull'etichetta intera a 1 pixel per punto.
 */
import { rotateBitmap, getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import type { LabelGeometry } from '@/model/geometry';

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

  const reading = wireToReading(wireBitmap, geometry.wireRotation);
  const img = ctx.createImageData(reading.widthPx, reading.heightPx);
  for (let y = 0; y < reading.heightPx; y++) {
    for (let x = 0; x < reading.widthPx; x++) {
      const i = (y * reading.widthPx + x) * 4;
      const v = getPixel(reading, x, y) ? 0 : 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
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

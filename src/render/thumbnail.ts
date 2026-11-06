/**
 * Miniatura dell'etichetta per l'elenco delle recenti: l'area stampabile nel verso
 * di lettura, ricavata dal bitmap appena stampato (nessun nuovo rendering).
 */
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import type { LabelGeometry } from '@/model/geometry';
import { forEachBlack } from '@/printer/raster';

export const THUMBNAIL_MAX_SIDE = 240;

/** Dimensioni della miniatura: lato più lungo ≤ `maxSide`, proporzioni dell'area stampabile. */
export function thumbnailSize(
  width: number,
  height: number,
  maxSide = THUMBNAIL_MAX_SIDE,
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Data URL PNG della miniatura; stringa vuota se il canvas non è disponibile. */
export function thumbnailDataUrl(
  wireBitmap: LabelBitmap,
  geometry: LabelGeometry,
  maxSide = THUMBNAIL_MAX_SIDE,
): string {
  const rotated = geometry.wireRotation === 90;
  const rw = rotated ? wireBitmap.heightPx : wireBitmap.widthPx;
  const rh = rotated ? wireBitmap.widthPx : wireBitmap.heightPx;
  const full = document.createElement('canvas');
  full.width = rw;
  full.height = rh;
  const fctx = full.getContext('2d');
  if (!fctx) return '';
  const img = fctx.createImageData(rw, rh);
  const px = new Uint32Array(img.data.buffer);
  px.fill(0xffffffff);
  // Stessa trasformazione dell'anteprima (vedi paintPreview).
  forEachBlack(wireBitmap, (x, y) => {
    if (rotated) px[(rh - 1 - x) * rw + y] = 0xff000000;
    else px[y * rw + x] = 0xff000000;
  });
  fctx.putImageData(img, 0, 0);

  const size = thumbnailSize(rw, rh, maxSide);
  const small = document.createElement('canvas');
  small.width = size.width;
  small.height = size.height;
  const sctx = small.getContext('2d');
  if (!sctx) return '';
  sctx.imageSmoothingEnabled = true;
  sctx.imageSmoothingQuality = 'high';
  sctx.drawImage(full, 0, 0, size.width, size.height);
  return small.toDataURL('image/png');
}

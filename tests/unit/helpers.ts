import { createDocument } from '@/model/document';
import { documentGeometry } from '@/model/geometry';
import type { LabelDocument } from '@/model/types';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapToRgba, toWireBitmap } from '@/printer/raster';
import type { RgbaImage } from '@/printer/types';
import type { PreparedLabel } from '@/render/export';

export function addressDoc(): LabelDocument {
  return createDocument(findMediaById('address-standard')!);
}

/**
 * Sostituto del rendering Konva per i test in Node: disegna una barra nera
 * a sinistra e un quadrato in basso a destra, nel verso di lettura.
 */
export async function fakePrepare(doc: LabelDocument): Promise<PreparedLabel> {
  const geometry = documentGeometry(doc, LW550_HEAD);
  const { width, height } = geometry.printable;
  const data = new Uint8Array(width * height * 4).fill(255);
  const black = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = 0;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < 10; x++) black(x, y);
  for (let y = height - 20; y < height; y++) for (let x = width - 20; x < width; x++) black(x, y);
  const image: RgbaImage = { width, height, data };
  const wireBitmap = toWireBitmap(image, { rotate: geometry.wireRotation });
  return { geometry, wireBitmap, wireImage: bitmapToRgba(wireBitmap) };
}

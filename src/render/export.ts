/**
 * Esportazione dell'etichetta a risoluzione di stampa e preparazione del lavoro.
 */
import Konva from './konva';
import type { LabelBitmap } from '@mbtech-nl/bitmap';
import { documentGeometry, type HeadSpec, type LabelGeometry } from '@/model/geometry';
import type { LabelDocument } from '@/model/types';
import { bitmapToRgba, toWireBitmap } from '@/printer/raster';
import type { RgbaImage } from '@/printer/types';
import { buildContent, waitForFonts } from './scene';

/**
 * Disegna l'area stampabile dell'etichetta a 300 dpi, nel verso di lettura,
 * su fondo bianco. Restituisce i pixel RGBA.
 */
export async function renderPrintableRgba(doc: LabelDocument, head: HeadSpec): Promise<{
  image: RgbaImage;
  geometry: LabelGeometry;
}> {
  const geometry = documentGeometry(doc, head);
  const { printable } = geometry;
  await waitForFonts(doc.elements);

  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: printable.width, height: printable.height });
  try {
    const layer = new Konva.Layer({ imageSmoothingEnabled: false, listening: false });
    stage.add(layer);
    // La stampa è sempre a 1 pixel per punto, qualunque sia la densità dello schermo.
    layer.getCanvas().setPixelRatio(1);
    layer.add(new Konva.Rect({ x: 0, y: 0, width: printable.width, height: printable.height, fill: '#fff' }));
    const content = buildContent(doc.elements);
    content.position({ x: -printable.x, y: -printable.y });
    layer.add(content);
    // Nessun layer.draw(): toCanvas disegna già la scena a 1 pixel per punto.

    const canvas = layer.toCanvas({ x: 0, y: 0, width: printable.width, height: printable.height, pixelRatio: 1 });
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas 2D non disponibile');
    const pixels = ctx.getImageData(0, 0, printable.width, printable.height);
    return {
      image: {
        width: pixels.width,
        height: pixels.height,
        data: new Uint8Array(pixels.data.buffer, pixels.data.byteOffset, pixels.data.byteLength),
      },
      geometry,
    };
  } finally {
    stage.destroy();
  }
}

export interface PreparedLabel {
  geometry: LabelGeometry;
  /** Bitmap a 1 bit nell'orientamento della testina: è ciò che verrà stampato. */
  wireBitmap: LabelBitmap;
  /** Lo stesso bitmap come RGBA bianco/nero, da inviare al driver. */
  wireImage: RgbaImage;
}

export async function prepareLabel(doc: LabelDocument, head: HeadSpec): Promise<PreparedLabel> {
  const { image, geometry } = await renderPrintableRgba(doc, head);
  const wireBitmap = toWireBitmap(image, { rotate: geometry.wireRotation });
  return { geometry, wireBitmap, wireImage: bitmapToRgba(wireBitmap) };
}

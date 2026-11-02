/**
 * Costruzione della scena Konva a partire dal modello.
 *
 * Unità della scena: punti di stampa a 300 dpi, nel verso di lettura,
 * con origine nell'angolo dell'etichetta intera. L'editor mostra la scena
 * scalata; la stampa la esporta a scala 1. Nessun riferimento a Vue o USB.
 */
import Konva from 'konva';
import type { LabelElement, TextElement } from '@/model/types';
import { mmToDotsExact, ptToMm } from '@/model/units';

/** Attributo che collega un nodo Konva all'elemento del modello. */
export const ELEMENT_ID_ATTR = 'elementId';

export function fontStyle(el: Pick<TextElement, 'bold' | 'italic'>): string {
  if (el.bold && el.italic) return 'italic bold';
  if (el.bold) return 'bold';
  if (el.italic) return 'italic';
  return 'normal';
}

function buildText(group: Konva.Group, el: TextElement, w: number, h: number): void {
  if (el.invert) {
    group.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: '#000', listening: false }));
  }
  group.add(
    new Konva.Text({
      x: 0,
      y: 0,
      width: w,
      height: h,
      text: el.text,
      fontFamily: el.fontFamily,
      fontSize: mmToDotsExact(ptToMm(el.fontSizePt)),
      fontStyle: fontStyle(el),
      align: el.align,
      verticalAlign: el.verticalAlign,
      wrap: 'word',
      lineHeight: 1.1,
      padding: 0,
      fill: el.invert ? '#fff' : '#000',
      listening: false,
    }),
  );
}

/**
 * Nodo di un elemento: un gruppo centrato sul riquadro, così la rotazione
 * avviene attorno al centro come nel modello.
 */
export function buildElementNode(el: LabelElement): Konva.Group {
  const w = mmToDotsExact(el.width);
  const h = mmToDotsExact(el.height);
  const group = new Konva.Group({
    x: mmToDotsExact(el.x) + w / 2,
    y: mmToDotsExact(el.y) + h / 2,
    width: w,
    height: h,
    offsetX: w / 2,
    offsetY: h / 2,
    rotation: el.rotation,
  });
  group.setAttr(ELEMENT_ID_ATTR, el.id);
  // Area trasparente per poter toccare l'elemento anche dove non c'è inchiostro.
  group.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: 'rgba(0,0,0,0)', name: 'hit' }));
  switch (el.type) {
    case 'text':
      buildText(group, el, w, h);
      break;
  }
  return group;
}

/** Gruppo con tutti gli elementi, nell'ordine del modello (l'ultimo sta sopra). */
export function buildContent(elements: readonly LabelElement[]): Konva.Group {
  const content = new Konva.Group({ name: 'content' });
  for (const el of elements) content.add(buildElementNode(el));
  return content;
}

/** Attende i font usati, così testo in anteprima e in stampa è identico. */
export async function waitForFonts(elements: readonly LabelElement[]): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const loads = new Set<string>();
  for (const el of elements) {
    if (el.type === 'text') loads.add(`${fontStyle(el).replace('normal', '')} 20px ${el.fontFamily}`.trim());
  }
  await Promise.all([...loads].map((f) => document.fonts.load(f).catch(() => [])));
  await document.fonts.ready;
}

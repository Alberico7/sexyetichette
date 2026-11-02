/**
 * Costruzione della scena Konva a partire dal modello.
 *
 * Unità della scena: punti di stampa a 300 dpi, nel verso di lettura,
 * con origine nell'angolo dell'etichetta intera. L'editor mostra la scena
 * scalata; la stampa la esporta a scala 1. Nessun riferimento a Vue o USB.
 */
import Konva, { type Group } from './konva';
import type { LabelElement, TextElement } from '@/model/types';
import { mmToDotsExact, ptToMm } from '@/model/units';
import { TEXT_LINE_HEIGHT, fitFontSize, type FitResult } from './fit';

/** Attributo che collega un nodo Konva all'elemento del modello. */
export const ELEMENT_ID_ATTR = 'elementId';

export function fontStyle(el: Pick<TextElement, 'bold' | 'italic'>): string {
  if (el.bold && el.italic) return 'italic bold';
  if (el.bold) return 'bold';
  if (el.italic) return 'italic';
  return 'normal';
}

/** Nodo di misura riutilizzato per ogni combinazione di carattere e stile. */
const probes = new Map<string, InstanceType<typeof Konva.Text>>();

/** Misura di una riga con lo stesso motore usato per disegnarla. */
function measureWith(el: Pick<TextElement, 'fontFamily' | 'bold' | 'italic'>) {
  const key = `${fontStyle(el)}|${el.fontFamily}`;
  let probe = probes.get(key);
  if (!probe) {
    probe = new Konva.Text({ fontFamily: el.fontFamily, fontStyle: fontStyle(el), padding: 0 });
    probes.set(key, probe);
  }
  const p = probe;
  return (line: string, fontSizeDots: number): number => {
    p.fontSize(fontSizeDots);
    return p.measureSize(line).width;
  };
}

/**
 * Cache dei risultati dell'adattamento: scena, pannello e anteprima chiedono
 * spesso la stessa cosa (stesso testo, carattere e riquadro).
 */
const FIT_CACHE_LIMIT = 300;
const fitCache = new Map<string, FitResult>();

export function clearFitCache(): void {
  fitCache.clear();
}

// Se un font termina il caricamento, le misure precedenti possono essere cambiate.
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.addEventListener('loadingdone', clearFitCache);
}

/**
 * Dimensione effettiva del testo: quella scelta, oppure quella calcolata
 * se l'adattamento automatico è attivo. Usata da editor, anteprima, stampa e pannello.
 */
export function resolveFontSize(el: TextElement): FitResult {
  if (!el.autoFit) return { sizePt: el.fontSizePt, overflow: false };
  const key = JSON.stringify([el.text, el.fontFamily, el.bold, el.italic, el.width, el.height]);
  const cached = fitCache.get(key);
  if (cached) return cached;
  const result = fitFontSize(el.text, mmToDotsExact(el.width), mmToDotsExact(el.height), measureWith(el));
  if (fitCache.size >= FIT_CACHE_LIMIT) fitCache.delete(fitCache.keys().next().value as string);
  fitCache.set(key, result);
  return result;
}

function buildText(group: Group, el: TextElement, w: number, h: number): void {
  const { sizePt } = resolveFontSize(el);
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
      fontSize: mmToDotsExact(ptToMm(sizePt)),
      fontStyle: fontStyle(el),
      align: el.align,
      verticalAlign: el.verticalAlign,
      // Con l'adattamento automatico si va a capo solo dove l'utente ha premuto Invio.
      wrap: el.autoFit ? 'none' : 'word',
      lineHeight: TEXT_LINE_HEIGHT,
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
export function buildElementNode(el: LabelElement): Group {
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

/** Firma di un elemento: se non cambia, il suo nodo nell'editor non va ricostruito. */
export function elementSignature(el: LabelElement): string {
  return JSON.stringify(el);
}

/** Gruppo con tutti gli elementi, nell'ordine del modello (l'ultimo sta sopra). */
export function buildContent(elements: readonly LabelElement[]): Group {
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

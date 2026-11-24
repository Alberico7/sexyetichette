/**
 * Costruzione della scena Konva a partire dal modello.
 *
 * Unità della scena: punti di stampa a 300 dpi, nel verso di lettura,
 * con origine nell'angolo dell'etichetta intera. L'editor mostra la scena
 * scalata; la stampa la esporta a scala 1. Nessun riferimento a Vue o USB.
 */
import Konva, { type Group } from './konva';
import type { BarcodeElement, LabelElement, TextElement } from '@/model/types';
import { READER_WINDOW_MM, checkBarcodeValue, code128Widths, layoutBarcode } from '@/model/barcode';
import { ISO_FONT } from '@/model/fonts';
import { dotsToMm, mmToDotsExact, ptToMm } from '@/model/units';
import { TEXT_LINE_HEIGHT, fitFontSize, type FitResult } from './fit';
import { usesSymbolFont } from '@/model/text';
import { ensureDiameterFont, fontStack, onDiameterFontReady } from './diameter-font';
import { onWebFontReady, requestFont } from './web-fonts';

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
  const family = fontStack(el.fontFamily);
  const key = `${fontStyle(el)}|${family}`;
  let probe = probes.get(key);
  if (!probe) {
    probe = new Konva.Text({ fontFamily: family, fontStyle: fontStyle(el), padding: 0 });
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
  baselineShift.clear();
}

// Se un font termina il caricamento, le misure precedenti possono essere cambiate.
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.addEventListener('loadingdone', clearFitCache);
  onDiameterFontReady(clearFitCache);
  onWebFontReady(clearFitCache);
}

/**
 * Dimensione effettiva del testo: quella scelta, oppure quella calcolata
 * se l'adattamento automatico è attivo. Usata da editor, anteprima, stampa e pannello.
 */
export function resolveFontSize(el: TextElement): FitResult {
  if (!el.autoFit) return { sizePt: el.fontSizePt, overflow: false };
  const key = JSON.stringify([el.text, fontStack(el.fontFamily), el.bold, el.italic, el.width, el.height]);
  const cached = fitCache.get(key);
  if (cached) return cached;
  const result = fitFontSize(el.text, mmToDotsExact(el.width), mmToDotsExact(el.height), measureWith(el));
  if (fitCache.size >= FIT_CACHE_LIMIT) fitCache.delete(fitCache.keys().next().value as string);
  fitCache.set(key, result);
  return result;
}

/**
 * Correzione verticale, in em: quanto spostare in basso il testo perché le maiuscole
 * siano centrate sulla riga. Konva centra lo spazio dichiarato dal font
 * (ascendente e discendente), che in alcuni font è molto sbilanciato: osifont,
 * il «Tecnico ISO 3098», senza correzione esce circa 0,16 em più in alto.
 */
const baselineShift = new Map<string, number>();

export function verticalShiftEm(el: Pick<TextElement, 'fontFamily' | 'bold' | 'italic'>): number {
  const family = fontStack(el.fontFamily);
  const key = `${fontStyle(el)}|${family}`;
  const cached = baselineShift.get(key);
  if (cached !== undefined) return cached;
  if (typeof document === 'undefined') return 0;
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return 0;
  const size = 100;
  ctx.font = `${fontStyle(el).replace('normal', '')} ${size}px ${family}`.trim();
  const m = ctx.measureText('H');
  const ascent = m.fontBoundingBoxAscent;
  const descent = m.fontBoundingBoxDescent;
  const cap = m.actualBoundingBoxAscent;
  const shift =
    [ascent, descent, cap].every(Number.isFinite) && cap > 0 ? (cap / 2 - (ascent - descent) / 2) / size : 0;
  baselineShift.set(key, shift);
  return shift;
}

/** Distanza del centro della sottolineatura dalla riga di base, in em. Vedi docs/2026-11-06-sottolineato.md. */
export const UNDERLINE_OFFSET_EM = 0.12;

function buildText(group: Group, el: TextElement, w: number, h: number): void {
  // Primo uso di un simbolo del mini-font (⌀, ∅, ♥, ♡) con questo carattere: prepara il mini-font (l'editor si ridisegna quando è pronto).
  if (usesSymbolFont(el.text)) void ensureDiameterFont(el.fontFamily);
  // Font scaricabile non ancora pronto: lo chiedo (l'editor si ridisegna quando arriva).
  requestFont(el.fontFamily, fontStyle(el));
  const { sizePt } = resolveFontSize(el);
  const fontSize = mmToDotsExact(ptToMm(sizePt));
  if (el.invert) {
    group.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: '#000', listening: false }));
  }
  group.add(
    new Konva.Text({
      x: 0,
      // Maiuscole centrate sulla riga con ogni carattere (vedi verticalShiftEm).
      y: verticalShiftEm(el) * fontSize,
      width: w,
      height: h,
      text: el.text,
      // Il simbolo ⌀ viene dal mini-font ISO, proporzionato al carattere scelto.
      fontFamily: fontStack(el.fontFamily),
      fontSize,
      fontStyle: fontStyle(el),
      textDecoration: el.underline ? 'underline' : '',
      // Centro della linea sotto la riga di base, come nei browser (Konva userebbe 0,25 em: staccata dal testo).
      underlineOffset: Math.round(fontSize * UNDERLINE_OFFSET_EM),
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

/** Carattere e stile del testo sotto i codici a barre. */
const BARCODE_TEXT_FONT = ISO_FONT;
const BARCODE_TEXT_STYLE = 'bold';

/** Misure del testo sotto il codice, in punti, per un riquadro alto `h`. */
export function barcodeTextMetrics(h: number): { fontSize: number; block: number } {
  const fontSize = Math.round(Math.min(48, Math.max(18, h * 0.2)));
  return { fontSize, block: Math.round(fontSize * 1.15) + Math.round(fontSize * 0.25) };
}

/** Grigio chiaro: si vede nell'editor, ma la conversione a 1 bit lo rende bianco (non si stampa). */
const HINT_COLOR = '#b0b0b0';

/**
 * Codice a barre: barre larghe un numero intero di punti, centrate, con le zone di quiete,
 * e il contenuto scritto sotto. Il riquadro è già allineato ai punti (vedi buildElementNode).
 * Vedi docs/2026-11-24-codici-a-barre.md.
 */
function buildBarcode(group: Group, el: BarcodeElement, w: number, h: number): void {
  const problem = checkBarcodeValue(el.value);
  const layout = problem ? null : layoutBarcode(code128Widths(el.value), w);
  if (!layout?.fits) {
    // Solo un'indicazione nell'editor; la stampa è bloccata finché il codice ha un problema.
    const hint = problem?.kind === 'empty' ? 'codice vuoto' : problem ? 'codice non valido' : 'il codice non entra';
    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        stroke: HINT_COLOR,
        strokeWidth: 2,
        dash: [8, 6],
        listening: false,
      }),
    );
    group.add(
      new Konva.Text({
        x: 0,
        y: 0,
        width: w,
        height: h,
        text: hint,
        align: 'center',
        verticalAlign: 'middle',
        fontSize: Math.max(18, Math.min(40, h / 4)),
        fill: HINT_COLOR,
        listening: false,
      }),
    );
    return;
  }
  const text = el.showText ? barcodeTextMetrics(h) : null;
  if (text) requestFont(BARCODE_TEXT_FONT, BARCODE_TEXT_STYLE);
  const barsHeight = Math.max(12, h - (text?.block ?? 0));
  const widths = code128Widths(el.value);
  const { module, barsX } = layout;
  group.add(
    new Konva.Shape({
      listening: false,
      fill: '#000',
      sceneFunc: (ctx, shape) => {
        ctx.beginPath();
        let x = barsX;
        widths.forEach((modules, i) => {
          const width = modules * module;
          if (i % 2 === 0) ctx.rect(x, 0, width, barsHeight);
          x += width;
        });
        ctx.closePath();
        ctx.fillShape(shape);
      },
    }),
  );
  if (text) {
    group.add(
      new Konva.Text({
        x: 0,
        y: barsHeight + Math.round(text.fontSize * 0.25),
        width: w,
        text: el.value,
        fontFamily: fontStack(BARCODE_TEXT_FONT),
        fontStyle: BARCODE_TEXT_STYLE,
        fontSize: text.fontSize,
        align: 'center',
        wrap: 'none',
        padding: 0,
        fill: '#000',
        listening: false,
      }),
    );
  }
}

/** Numero pari di punti più vicino: con un centro intero, i bordi restano su punti interi anche ruotando di 90°. */
const evenDots = (mm: number) => Math.max(2, 2 * Math.round(mmToDotsExact(mm) / 2));

export interface BarcodeStatus {
  /** Messaggio che blocca la stampa, o null se il codice è a posto. */
  error: string | null;
  /** Larghezza del codice con le zone di quiete, in mm (0 se non si disegna). */
  widthMm: number;
  /** Più largo della finestra del lettore dell'officina (avviso, non blocca). */
  wideForReader: boolean;
}

/** Stato di un codice a barre: usato dal pannello e dai controlli prima della stampa. */
export function barcodeStatus(el: BarcodeElement): BarcodeStatus {
  const problem = checkBarcodeValue(el.value);
  if (problem?.kind === 'empty') return { error: 'Scrivi il contenuto del codice.', widthMm: 0, wideForReader: false };
  if (problem) {
    return {
      error: `«${problem.char}» non si può mettere in un codice a barre: solo lettere senza accento, cifre, spazio e segni come - . / _`,
      widthMm: 0,
      wideForReader: false,
    };
  }
  const layout = layoutBarcode(code128Widths(el.value), evenDots(el.width));
  if (!layout.fits) {
    return {
      error: 'Il codice non entra: allarga il riquadro o accorcia il contenuto.',
      widthMm: 0,
      wideForReader: false,
    };
  }
  const widthMm = dotsToMm(layout.totalWidth);
  return { error: null, widthMm, wideForReader: widthMm > READER_WINDOW_MM };
}

/** Rotazione di un codice a barre: solo multipli di 90°, perché le barre restino nette. */
export function barcodeRotation(rotation: number): number {
  return (((Math.round(rotation / 90) * 90) % 360) + 360) % 360;
}

/**
 * Nodo di un elemento: un gruppo centrato sul riquadro, così la rotazione
 * avviene attorno al centro come nel modello. I codici a barre sono allineati ai punti
 * della testina (centro intero, lati pari) perché le barre non vengano sfumate.
 */
export function buildElementNode(el: LabelElement): Group {
  const barcode = el.type === 'barcode';
  const w = barcode ? evenDots(el.width) : mmToDotsExact(el.width);
  const h = barcode ? evenDots(el.height) : mmToDotsExact(el.height);
  const cx = mmToDotsExact(el.x + el.width / 2);
  const cy = mmToDotsExact(el.y + el.height / 2);
  const group = new Konva.Group({
    x: barcode ? Math.round(cx) : cx,
    y: barcode ? Math.round(cy) : cy,
    width: w,
    height: h,
    offsetX: w / 2,
    offsetY: h / 2,
    rotation: barcode ? barcodeRotation(el.rotation) : el.rotation,
  });
  group.setAttr(ELEMENT_ID_ATTR, el.id);
  // Area trasparente per poter toccare l'elemento anche dove non c'è inchiostro.
  group.add(new Konva.Rect({ x: 0, y: 0, width: w, height: h, fill: 'rgba(0,0,0,0)', name: 'hit' }));
  switch (el.type) {
    case 'text':
      buildText(group, el, w, h);
      break;
    case 'barcode':
      buildBarcode(group, el, w, h);
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
    if (el.type === 'barcode' && el.showText) loads.add(`${BARCODE_TEXT_STYLE} 20px ${BARCODE_TEXT_FONT}`);
  }
  await Promise.all([...loads].map((f) => document.fonts.load(f).catch(() => [])));
  // Mini-font del diametro ISO per i testi che contengono ⌀.
  const families = new Set<string>();
  for (const el of elements) if (el.type === 'text' && usesSymbolFont(el.text)) families.add(el.fontFamily);
  await Promise.all([...families].map((f) => ensureDiameterFont(f)));
  await document.fonts.ready;
}

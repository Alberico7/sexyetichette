/**
 * Modello dell'etichetta. Indipendente da canvas, Vue e stampante.
 *
 * Convenzioni:
 * - tutte le misure sono in millimetri;
 * - le coordinate degli elementi sono nel verso di lettura dell'etichetta,
 *   con origine nell'angolo in alto a sinistra dell'etichetta intera
 *   (zona non stampabile compresa);
 * - `x`, `y`, `width`, `height` descrivono il riquadro non ruotato;
 *   la rotazione avviene attorno al centro del riquadro.
 */

/** Formato del rotolo, nel senso fisico della stampante. */
export interface MediaFormat {
  id: string;
  name: string;
  /** Larghezza attraverso la testina, in mm. */
  widthMm: number;
  /** Lunghezza nel senso di avanzamento, in mm. Assente = rotolo continuo. */
  lengthMm?: number;
  /** Lunghezza nel senso di avanzamento in punti a 300 dpi (dal catalogo, se nota). */
  lengthDots?: number;
  cornerRadiusMm?: number;
  /** Suggerimento del catalogo sul verso di lettura. */
  defaultOrientation?: 'horizontal' | 'vertical';
  skus?: string[];
}

/**
 * Verso del contenuto rispetto al rotolo.
 * - `along`: il testo corre lungo il rotolo (l'immagine viene ruotata di 90° per la testina);
 * - `across`: il testo corre attraverso il rotolo (nessuna rotazione).
 */
export type ContentDirection = 'along' | 'across';

export type HorizontalAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

interface BaseElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Gradi, in senso orario. */
  rotation: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  /** Dimensione del carattere in punti tipografici. */
  fontSizePt: number;
  bold: boolean;
  italic: boolean;
  align: HorizontalAlign;
  verticalAlign: VerticalAlign;
  /** Testo bianco su fondo nero. */
  invert: boolean;
}

export type LabelElement = TextElement;
export type ElementType = LabelElement['type'];

export const DOCUMENT_FORMAT = 'etichettatrice';
export const DOCUMENT_VERSION = 1;

export interface LabelDocument {
  format: typeof DOCUMENT_FORMAT;
  version: typeof DOCUMENT_VERSION;
  id: string;
  name: string;
  media: MediaFormat;
  direction: ContentDirection;
  /** Lunghezza scelta per i rotoli continui, in mm. */
  continuousLengthMm: number;
  elements: LabelElement[];
  created: string;
  modified: string;
}

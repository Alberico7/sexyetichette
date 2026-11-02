import type { ContentDirection, LabelDocument, MediaFormat } from './types';
import { mmToDots, PRINT_DPI } from './units';

/** Caratteristiche della testina usate per calcolare l'area stampabile. */
export interface HeadSpec {
  dpi: number;
  /** Punti della testina (larghezza massima stampabile attraverso il rotolo). */
  headDots: number;
  /** Zona non raggiungibile all'inizio di ogni etichetta, nel senso di avanzamento. */
  leadingDots: number;
  /** Zona non raggiungibile alla fine di ogni etichetta. */
  trailingDots: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Geometria dell'etichetta in punti a 300 dpi, nel verso di lettura.
 *
 * Il rettangolo `printable` è la parte che la testina può raggiungere:
 * è anche l'esatta dimensione dell'immagine inviata alla stampante
 * (prima della rotazione verso la testina).
 */
export interface LabelGeometry {
  /** Dimensioni dell'etichetta intera nel verso di lettura. */
  label: { width: number; height: number };
  printable: Rect;
  /** Zona non stampabile (vuota se assente). */
  deadZones: Rect[];
  /** Rotazione da applicare all'immagine letta per ottenere l'orientamento della testina. */
  wireRotation: 0 | 90;
  /** Punti attraverso la testina. */
  crossDots: number;
  /** Lunghezza totale dell'etichetta nel senso di avanzamento. */
  feedDots: number;
}

export function feedLengthDots(media: MediaFormat, continuousLengthMm: number): number {
  if (media.lengthDots !== undefined && media.lengthDots > 0) return media.lengthDots;
  return mmToDots(media.lengthMm ?? continuousLengthMm, PRINT_DPI);
}

export function computeGeometry(
  media: MediaFormat,
  direction: ContentDirection,
  continuousLengthMm: number,
  head: HeadSpec,
): LabelGeometry {
  const crossDots = Math.min(head.headDots, mmToDots(media.widthMm, head.dpi));
  const feedDots = feedLengthDots(media, continuousLengthMm);
  const leading = Math.min(head.leadingDots, Math.max(0, feedDots - 1));
  const trailing = Math.min(head.trailingDots, Math.max(0, feedDots - leading - 1));
  const printableFeed = feedDots - leading - trailing;

  if (direction === 'across') {
    // Nessuna rotazione: la prima riga stampata è in alto.
    const deadZones: Rect[] = [];
    if (leading > 0) deadZones.push({ x: 0, y: 0, width: crossDots, height: leading });
    if (trailing > 0)
      deadZones.push({ x: 0, y: feedDots - trailing, width: crossDots, height: trailing });
    return {
      label: { width: crossDots, height: feedDots },
      printable: { x: 0, y: leading, width: crossDots, height: printableFeed },
      deadZones,
      wireRotation: 0,
      crossDots,
      feedDots,
    };
  }

  // Rotazione di 90° in senso orario: la colonna sinistra dell'immagine
  // diventa la prima riga stampata, quindi la zona iniziale è a sinistra.
  const deadZones: Rect[] = [];
  if (leading > 0) deadZones.push({ x: 0, y: 0, width: leading, height: crossDots });
  if (trailing > 0)
    deadZones.push({ x: feedDots - trailing, y: 0, width: trailing, height: crossDots });
  return {
    label: { width: feedDots, height: crossDots },
    printable: { x: leading, y: 0, width: printableFeed, height: crossDots },
    deadZones,
    wireRotation: 90,
    crossDots,
    feedDots,
  };
}

export function documentGeometry(doc: LabelDocument, head: HeadSpec): LabelGeometry {
  return computeGeometry(doc.media, doc.direction, doc.continuousLengthMm, head);
}

/** Verso consigliato in base al formato. */
export function defaultDirection(media: MediaFormat): ContentDirection {
  if (media.defaultOrientation === 'horizontal') return 'along';
  if (media.defaultOrientation === 'vertical') return 'across';
  // Senza indicazioni: il testo corre lungo il lato più lungo.
  const length = media.lengthMm ?? Number.POSITIVE_INFINITY;
  return length > media.widthMm ? 'along' : 'across';
}

/**
 * Adattamento automatico della dimensione del testo al riquadro.
 * Funzione pura: la misura delle righe viene passata dall'esterno
 * (in produzione è la stessa misura che usa Konva per disegnare).
 */
import { mmToDotsExact, ptToMm } from '@/model/units';

export const FIT_MIN_PT = 4;
export const FIT_MAX_PT = 200;
export const FIT_STEP_PT = 0.5;
/** Interlinea usata per disegnare il testo (deve coincidere con `render/scene.ts`). */
export const TEXT_LINE_HEIGHT = 1.1;
/** Margine interno di sicurezza, in frazione del riquadro, per lato. */
export const FIT_PADDING = 0.02;

export interface FitResult {
  sizePt: number;
  /** `true` se il testo non entra nemmeno alla dimensione minima. */
  overflow: boolean;
}

/** Larghezza di una riga in punti di stampa, alla dimensione data in punti di stampa. */
export type MeasureLine = (line: string, fontSizeDots: number) => number;

export function ptToDots(pt: number): number {
  return mmToDotsExact(ptToMm(pt));
}

/** Righe come le ha scritte l'utente: il testo va a capo solo con Invio. */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/**
 * Dimensione più grande (a passi di 0,5 pt) per cui la riga più lunga sta
 * nella larghezza e tutte le righe stanno nell'altezza del riquadro.
 */
export function fitFontSize(
  text: string,
  boxWidthDots: number,
  boxHeightDots: number,
  measure: MeasureLine,
  limits: { minPt?: number; maxPt?: number } = {},
): FitResult {
  const minPt = limits.minPt ?? FIT_MIN_PT;
  const maxPt = limits.maxPt ?? FIT_MAX_PT;
  const lines = splitLines(text);
  const availW = boxWidthDots * (1 - 2 * FIT_PADDING);
  const availH = boxHeightDots * (1 - 2 * FIT_PADDING);

  const fits = (pt: number): boolean => {
    const size = ptToDots(pt);
    if (lines.length * size * TEXT_LINE_HEIGHT > availH) return false;
    for (const line of lines) if (line && measure(line, size) > availW) return false;
    return true;
  };

  // Testo vuoto o solo spazi: nessun vincolo di larghezza, conta solo l'altezza.
  let lo = Math.round(minPt / FIT_STEP_PT);
  let hi = Math.round(maxPt / FIT_STEP_PT);
  if (!fits(lo * FIT_STEP_PT)) return { sizePt: minPt, overflow: true };
  // Ricerca binaria sull'ultimo valore che entra.
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(mid * FIT_STEP_PT)) lo = mid;
    else hi = mid - 1;
  }
  return { sizePt: lo * FIT_STEP_PT, overflow: false };
}

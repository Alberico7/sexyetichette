/**
 * Codici a barre 1D: Code 128 (insiemi B e C). Funzioni pure, senza disegno.
 * Codificatore ripreso dal progetto «Compilatore misure» dello stesso autore, già
 * verificato con zxing. Vedi docs/2026-11-24-codici-a-barre.md.
 */

/** Larghezze dei 107 simboli Code 128 (barra, spazio, barra…), in moduli. L'ultimo è lo stop. */
const PATTERN = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
]; // prettier-ignore

const START_B = 104;
const START_C = 105;
const CODE_B = 100;
const STOP = 106;

/** Zona di quiete obbligatoria a ciascun lato, in moduli. */
export const QUIET_ZONE_MODULES = 10;
/** Barra più stretta: almeno 2 punti a 300 dpi (0,17 mm). */
export const MIN_MODULE_DOTS = 2;
/** Barra più stretta quando il codice entra comodo: 3 punti (0,25 mm), più tollerante per un lettore a contatto. */
export const MAX_MODULE_DOTS = 3;
/** Finestra del Datalogic Touch 90 dell'officina, con un po' di margine: oltre, avviso. */
export const READER_WINDOW_MM = 85;

/**
 * Primo carattere che il Code 128 (insieme B) non può contenere, o '' se vanno tutti bene.
 * Si accettano solo i caratteri ASCII stampabili, da 32 (spazio) a 126 (~): niente accenti né simboli.
 */
export function firstUnencodable(s: string): string {
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 32 || c > 126) return ch;
  }
  return '';
}

/** Valori dei simboli: start, dati, cifra di controllo, stop. Insieme C per le sole cifre (2 per simbolo). */
export function code128Symbols(value: string): number[] {
  const bad = firstUnencodable(value);
  if (bad) throw new Error(`Carattere non codificabile: ${bad}`);
  const symbols: number[] = [];
  if (/^\d+$/.test(value) && value.length >= 2) {
    symbols.push(START_C);
    const even = value.length - (value.length % 2);
    for (let i = 0; i < even; i += 2) symbols.push(Number(value.slice(i, i + 2)));
    if (even < value.length) symbols.push(CODE_B, value.charCodeAt(even) - 32);
  } else {
    symbols.push(START_B);
    for (const ch of value) symbols.push(ch.charCodeAt(0) - 32);
  }
  let sum = symbols[0]!;
  for (let i = 1; i < symbols.length; i++) sum += i * symbols[i]!;
  symbols.push(sum % 103, STOP);
  return symbols;
}

/** Larghezze alternate barra/spazio in moduli, a partire da una barra (senza zone di quiete). */
export function code128Widths(value: string): number[] {
  return code128Symbols(value).flatMap((s) => [...PATTERN[s]!].map(Number));
}

export type BarcodeProblem = { kind: 'empty' } | { kind: 'unencodable'; char: string } | null;

/** Controllo del contenuto, prima del disegno. */
export function checkBarcodeValue(value: string): BarcodeProblem {
  if (value === '') return { kind: 'empty' };
  const char = firstUnencodable(value);
  return char ? { kind: 'unencodable', char } : null;
}

/**
 * Segni che un lettore «a tastiera» può scrivere diversi a seconda del layout configurato
 * (italiano o americano): lettere, cifre, spazio e punto escono sempre uguali.
 * Esperienza del Compilatore misure (docs del 2026-11-23 di quel progetto).
 */
export function keyboardSensitive(value: string): boolean {
  return /[^A-Za-z0-9 .]/.test(value);
}

export interface BarcodeLayout {
  /** Larghezza di un modulo in punti (0 se il codice non entra). */
  module: number;
  /** Il codice, zone di quiete comprese, entra nel riquadro con un modulo di almeno 2 punti. */
  fits: boolean;
  /** Inizio della prima barra, in punti dal bordo sinistro del riquadro. */
  barsX: number;
  /** Larghezza delle sole barre, in punti. */
  barsWidth: number;
  /** Larghezza con le zone di quiete, in punti. */
  totalWidth: number;
}

/**
 * Sceglie il modulo più grande (fino a 3 punti) con cui il codice, zone di quiete comprese,
 * entra nella larghezza del riquadro, e lo centra. Tutto in punti interi.
 */
export function layoutBarcode(widths: readonly number[], boxWidthDots: number): BarcodeLayout {
  const barModules = widths.reduce((a, b) => a + b, 0);
  const totalModules = barModules + 2 * QUIET_ZONE_MODULES;
  const module = Math.min(MAX_MODULE_DOTS, Math.floor(boxWidthDots / totalModules));
  if (module < MIN_MODULE_DOTS) return { module: 0, fits: false, barsX: 0, barsWidth: 0, totalWidth: 0 };
  const barsWidth = barModules * module;
  return {
    module,
    fits: true,
    barsX: Math.floor((boxWidthDots - barsWidth) / 2),
    barsWidth,
    totalWidth: totalModules * module,
  };
}

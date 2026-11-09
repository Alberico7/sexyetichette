/**
 * O barrata (U+00D8). Non ha più un pulsante (si usa il simbolo ISO ⌀),
 * ma resta qui per riferimento e per i test.
 */
export const DIAMETER_SYMBOL = 'Ø';

/**
 * Simbolo del diametro ISO (U+2300). Molti font non lo contengono: il browser
 * lo prende da un altro font e può risultare più piccolo o mancare.
 */
export const DIAMETER_SIGN = '⌀';

/**
 * Simbolo del diametro con la barra a 45°. Non esiste un carattere apposta: si usa
 * ∅ (U+2205, insieme vuoto), che il mini-font dell'app disegna come ⌀ con la barra
 * a 45°. Vedi docs/2026-11-09-diametro-45.md.
 */
export const DIAMETER_45_SIGN = '∅';

/** Parola inserita dal pulsante «AFKEUR» (scarto), così com'è, senza spazi. */
export const REJECT_WORD = 'AFKEUR';

/** Testo inserito dal pulsante «N. R.»: NON RIPARABILE su due righe. */
export const UNREPAIRABLE_TEXT = 'NON\nRIPARABILE';

export interface TextEdit {
  text: string;
  /** Posizione del cursore dopo l'inserimento. */
  cursor: number;
}

/**
 * Inserisce `insert` al posto della selezione [start, end) di `text`.
 * Posizioni fuori intervallo vengono limitate; senza posizione si aggiunge in fondo.
 */
export function insertAtSelection(
  text: string,
  insert: string,
  start: number | null = text.length,
  end: number | null = start,
): TextEdit {
  const len = text.length;
  const s = Math.min(len, Math.max(0, start ?? len));
  const e = Math.min(len, Math.max(s, end ?? s));
  return { text: text.slice(0, s) + insert + text.slice(e), cursor: s + insert.length };
}

/** Cuore pieno (U+2665): nero, adatto alla stampa termica. Disegnato nel mini-font `diametro.otf`. */
export const HEART = '♥';

/**
 * Codice nascosto che diventa ♥ mentre si scrive (nessun pulsante).
 * Il `#` davanti e l'`*` dopo evitano di trasformare un `<3` scritto apposta. Vedi docs/2026-11-08-cuore-nascosto.md.
 */
export const HEART_CODE = '#<3*';

/** Cuore vuoto (U+2661), disegnato nel mini-font `diametro.otf`. Vedi docs/2026-11-09-cuore-vuoto.md. */
export const EMPTY_HEART = '♡';

/** Codice nascosto che diventa ♡ mentre si scrive: come quello del ♥, con il trattino al posto dell'asterisco. */
export const EMPTY_HEART_CODE = '#<3-';

const HEART_CODES: readonly (readonly [string, string])[] = [
  [HEART_CODE, HEART],
  [EMPTY_HEART_CODE, EMPTY_HEART],
];

function replaceCodes(text: string): string {
  return HEART_CODES.reduce((t, [code, symbol]) => t.split(code).join(symbol), text);
}

/**
 * Sostituisce ogni `#<3*` con ♥ e ogni `#<3-` con ♡, e sposta il cursore di conseguenza.
 * Restituisce `null` se il testo non contiene nessun codice.
 */
export function replaceHeartCode(text: string, cursor: number | null = text.length): TextEdit | null {
  if (!HEART_CODES.some(([code]) => text.includes(code))) return null;
  const pos = Math.min(text.length, Math.max(0, cursor ?? text.length));
  const before = replaceCodes(text.slice(0, pos));
  const after = replaceCodes(text.slice(pos));
  // Un codice a cavallo del cursore (raro: cursore in mezzo al codice incollato) si sistema sul testo intero.
  const joined = replaceCodes(before + after);
  return { text: joined, cursor: Math.min(joined.length, before.length) };
}

/** Il testo usa un simbolo del mini-font dell'app (⌀, ∅, ♥ o ♡), che va caricato prima di disegnare. */
export function usesSymbolFont(text: string): boolean {
  return [DIAMETER_SIGN, DIAMETER_45_SIGN, HEART, EMPTY_HEART].some((c) => text.includes(c));
}

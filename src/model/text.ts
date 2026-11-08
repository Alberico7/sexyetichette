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
 * Il `#` evita di trasformare un `<3` scritto apposta. Vedi docs/2026-11-08-cuore-nascosto.md.
 */
export const HEART_CODE = '#<3';

/**
 * Sostituisce ogni `#<3` con ♥ e sposta il cursore di conseguenza.
 * Restituisce `null` se il testo non contiene il codice.
 */
export function replaceHeartCode(text: string, cursor: number | null = text.length): TextEdit | null {
  if (!text.includes(HEART_CODE)) return null;
  const pos = Math.min(text.length, Math.max(0, cursor ?? text.length));
  const before = text.slice(0, pos).split(HEART_CODE).join(HEART);
  const after = text.slice(pos).split(HEART_CODE).join(HEART);
  // Un codice a cavallo del cursore (raro: cursore in mezzo al codice incollato) si sistema sul testo intero.
  const joined = (before + after).split(HEART_CODE).join(HEART);
  return { text: joined, cursor: Math.min(joined.length, before.length) };
}

/** Il testo usa un simbolo del mini-font dell'app (⌀ o ♥), che va caricato prima di disegnare. */
export function usesSymbolFont(text: string): boolean {
  return text.includes(DIAMETER_SIGN) || text.includes(HEART);
}

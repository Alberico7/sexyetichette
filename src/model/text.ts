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

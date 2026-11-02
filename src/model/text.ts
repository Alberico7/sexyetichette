/** Simbolo del diametro: O barrata (U+00D8), presente in tutti i font. */
export const DIAMETER_SYMBOL = 'Ø';

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

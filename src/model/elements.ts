/**
 * Piccole funzioni comuni a tutti i tipi di elemento (testo, codice a barre).
 */
import type { LabelElement } from './types';

/** Il contenuto scritto dall'utente: il testo, o il contenuto del codice. */
export function elementContent(el: LabelElement): string {
  return el.type === 'text' ? el.text : el.value;
}

/**
 * Ultime stampe della sessione, in testa al testo della diagnostica.
 *
 * Per ogni stampa: copie chieste, etichette inviate davvero (comandi ESC n) ed
 * etichette rimaste sul rotolo prima e dopo, lette dalle risposte di stato
 * della stampante durante il lavoro. Solo in memoria.
 * Vedi docs/2026-11-06-diagnostica-piu-semplice.md.
 */
import { formatTime } from './log';

export const PRINT_HISTORY_MAX = 10;

export interface PrintRecord {
  at: number;
  copies: number;
  /** Etichette inviate (ESC n); assente se il traffico USB non è osservabile. */
  labelsSent?: number;
  density: string;
  media: string;
  remainingBefore?: number;
  remainingAfter?: number;
  /** `single`, `job` (un lavoro con più etichette) o `one-by-one`. */
  mode?: string;
  /** Fermata con «Ferma» dopo questo numero di etichette. */
  stoppedAfter?: number;
  error?: string;
}

/** Etichette rimaste sul rotolo nella risposta a ESC A della 550 (byte 27–28, little endian). */
export function remainingLabels(status: Uint8Array): number | undefined {
  if (status.length < 29) return undefined;
  const n = status[27]! | (status[28]! << 8);
  // Risposta senza dati del rotolo (per esempio 04 00 … 00): non è un conteggio.
  return n > 0 ? n : undefined;
}

export class PrintHistory {
  private list: PrintRecord[] = [];

  add(r: PrintRecord): void {
    this.list.push(r);
    if (this.list.length > PRINT_HISTORY_MAX) this.list.shift();
  }

  get records(): readonly PrintRecord[] {
    return this.list;
  }

  clear(): void {
    this.list = [];
  }

  toText(): string {
    const lines = [`Ultime stampe (${this.list.length}):`];
    if (!this.list.length) lines.push('  (nessuna stampa in questa sessione)');
    for (const r of [...this.list].reverse()) {
      const parts = [`copie chieste ${r.copies}`];
      parts.push(`etichette inviate ${r.labelsSent ?? '?'}`);
      if (r.remainingBefore !== undefined || r.remainingAfter !== undefined) {
        parts.push(`rimaste sul rotolo ${r.remainingBefore ?? '?'} → ${r.remainingAfter ?? '?'}`);
      }
      parts.push(`densità ${r.density}`, `formato ${r.media}`);
      if (r.mode) parts.push(`modo ${r.mode}`);
      if (r.stoppedAfter !== undefined) parts.push(`FERMATA dopo ${r.stoppedAfter}`);
      if (r.error) parts.push(`ERRORE: ${r.error}`);
      lines.push(`  ${formatTime(r.at)} · ${parts.join(' · ')}`);
    }
    return lines.join('\n');
  }
}

export const printHistory = new PrintHistory();

/**
 * Copie multiple sulla LabelWriter 550, nell'ordine del driver ufficiale DYMO.
 *
 * La libreria (`write550Job`) legge la risposta a `ESC A 2` PRIMA di spedire
 * l'etichetta successiva e numera le etichette da 0. Il driver Linux ufficiale
 * DYMO (dymosoftware/Drivers, LW5xx_Linux) numera da 1 e legge la risposta DOPO
 * aver spedito l'etichetta successiva. Sulla 550 vera la sequenza della libreria
 * stampa una sola etichetta e lascia la stampante in errore (prova del 2026-11-06).
 *
 * Sequenza per N etichette:
 *   preambolo · etichetta 1 · [ESC A 2 · etichetta k · lettura] per k = 2…N
 *   · ESC A 0 · lettura · ESC E ESC Q
 *
 * «Ferma»: smette di spedire etichette e chiude il lavoro nel modo normale.
 * Vedi docs/2026-11-06-copie-multiple-550.md.
 */
import { build550Recovery, build550StatusRequest, STATUS_BYTE_COUNT_550 } from '@thermal-label/labelwriter-core';

/** Come stampare 2 o più copie. `'one-by-one'`: N lavori da 1 copia (riserva provata su carta). */
export type MultiCopyMode = 'job' | 'one-by-one';
export const MULTI_COPY_MODE: MultiCopyMode = 'job';

/** Attesa massima della risposta di stato dopo un'etichetta (come la libreria). */
export const LABEL_HANDSHAKE_TIMEOUT_MS = 15_000;

export interface Transport550 {
  write(data: Uint8Array): Promise<void>;
  read(length: number, timeout?: number): Promise<Uint8Array>;
}

/** Lavoro composto dalla libreria (`compose550Job`). */
export interface Composed550 {
  preamble: Uint8Array;
  labels: Uint8Array[];
  finalize: Uint8Array;
}

export interface CopiesControl {
  /** «Ferma» toccato: niente altre etichette. */
  shouldStop?: () => boolean;
  /** Etichette spedite finora, sul totale. */
  onProgress?: (sent: number, total: number) => void;
  /** Problema bloccante nella risposta di stato (carta finita…), oppure `null`. */
  statusProblem?: (status: Uint8Array) => StatusProblem | null;
  /** Nota per il registro. */
  log?: (message: string) => void;
}

export interface CopiesResult {
  total: number;
  /** Etichette spedite alla stampante. */
  sent: number;
  stopped: boolean;
}

/** Errore riportato dalla stampante nella risposta di stato (codice e messaggio della libreria). */
export interface StatusProblem {
  code: string;
  message: string;
}

/** Errore a metà lavoro: quante etichette erano già partite. */
export class CopiesError extends Error {
  constructor(
    message: string,
    readonly sent: number,
    readonly total: number,
    override readonly cause?: unknown,
    readonly statusError?: StatusProblem,
  ) {
    super(message);
    this.name = 'CopiesError';
  }
}

/** Indice delle etichette da 1 (2 byte little-endian dopo `ESC n`), come il driver DYMO. */
export function numberLabelsFromOne(labels: readonly Uint8Array[]): Uint8Array[] {
  return labels.map((segment, i) => {
    if (segment[0] !== 0x1b || segment[1] !== 0x6e) throw new Error('etichetta senza ESC n all’inizio');
    const copy = new Uint8Array(segment);
    copy[2] = (i + 1) & 0xff;
    copy[3] = ((i + 1) >> 8) & 0xff;
    return copy;
  });
}

/** Indice di etichetta nella risposta di stato (byte 5–6). */
export function statusLabelIndex(status: Uint8Array): number {
  return (status[5] ?? 0) | ((status[6] ?? 0) << 8);
}

/**
 * Spedisce un lavoro con più etichette nell'ordine DYMO. Il blocco della
 * stampante (`ESC A 1`) va chiesto prima, da chi chiama.
 */
export async function write550CopiesDymoOrder(
  transport: Transport550,
  job: Composed550,
  control: CopiesControl = {},
): Promise<CopiesResult> {
  const labels = numberLabelsFromOne(job.labels);
  const total = labels.length;
  const log = control.log ?? (() => {});
  let sent = 0;

  const readStatus = async (): Promise<Uint8Array> => {
    const status = await transport.read(STATUS_BYTE_COUNT_550, LABEL_HANDSHAKE_TIMEOUT_MS);
    const problem = control.statusProblem?.(status) ?? null;
    if (problem) throw new CopiesError(problem.message, sent, total, undefined, problem);
    return status;
  };

  try {
    await transport.write(job.preamble);
    await transport.write(labels[0]!);
    sent = 1;
    control.onProgress?.(sent, total);
    let stopped = false;
    for (let k = 1; k < total; k++) {
      if (control.shouldStop?.()) {
        stopped = true;
        log(`Copie: fermata dall’utente dopo ${sent} di ${total} etichette inviate`);
        break;
      }
      await transport.write(build550StatusRequest(2));
      await transport.write(labels[k]!);
      sent = k + 1;
      control.onProgress?.(sent, total);
      const status = await readStatus();
      log(
        `Copie: etichetta ${sent} di ${total} inviata, stato: indice ${statusLabelIndex(status)}, codice ${status[0]}`,
      );
    }
    // Chiusura normale, anche dopo «Ferma»: domanda di stato finale, avanzamento al taglio, fine lavoro.
    await transport.write(build550StatusRequest(0));
    await readStatus();
    await transport.write(job.finalize);
    return { total, sent, stopped };
  } catch (err) {
    // Lavoro rimasto aperto: ESC Q lo chiude e rilascia la stampante, così non resta bloccata.
    try {
      await transport.write(build550Recovery());
      log('Copie: lavoro interrotto, inviato ESC Q per sbloccare la stampante');
    } catch {
      // Trasporto chiuso: non si può fare altro.
    }
    if (err instanceof CopiesError) throw err;
    throw new CopiesError(err instanceof Error ? err.message : String(err), sent, total, err);
  }
}

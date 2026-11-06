/**
 * Osservazione del traffico USB tra la libreria e la stampante.
 *
 * Avvolge `write` e `read` del trasporto della libreria (un campo privato di
 * `WebLabelWriterPrinter`) e registra direzione, dimensione, durata, esito e il
 * comando riconosciuto. Le risposte della stampante (stato, rotolo, versione)
 * sono registrate in esadecimale; dei dati di stampa solo la dimensione.
 *
 * Non cambia i dati né l'ordine delle operazioni.
 */
import { toHex } from './hex';
import { describeError, type DiagnosticLog } from './log';

export { toHex };

const ESC = 0x1b;

/** Oltre questa dimensione una scrittura contiene dati di stampa: niente esadecimale. */
const MAX_TX_HEX = 16;
/** Le risposte della 550 sono al massimo di 64 byte. */
const MAX_RX_HEX = 128;

const COMMANDS: Record<number, string> = {
  0x41: 'ESC A (stato)',
  0x55: 'ESC U (dati del rotolo)',
  0x56: 'ESC V (versione)',
  0x73: 'ESC s (inizio lavoro)',
  0x6e: 'ESC n (indice etichetta)',
  0x44: 'ESC D (intestazione etichetta)',
  0x47: 'ESC G (fine etichetta)',
  0x45: 'ESC E (avanzamento)',
  0x51: 'ESC Q (fine lavoro / sblocco)',
  0x43: 'ESC C (densità)',
  0x68: 'ESC h (modo testo)',
  0x69: 'ESC i (modo grafica)',
  0x74: 'ESC T (velocità)',
  0x40: 'ESC @ (riavvio)',
  0x2a: 'ESC * (impostazioni di fabbrica)',
};

/** Nome del primo comando contenuto in una scrittura. */
export function describeCommand(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === ESC) {
    const name = COMMANDS[bytes[1]!] ?? `ESC 0x${bytes[1]!.toString(16).padStart(2, '0')}`;
    if (bytes[1] === 0x41 && bytes.length >= 3) {
      const lock = bytes[2];
      const what = lock === 1 ? 'richiesta lock' : lock === 2 ? 'tra un’etichetta e l’altra' : 'senza lock';
      return `${name}, ${what}`;
    }
    return name;
  }
  return 'dati';
}

export interface TransportLike {
  write(data: Uint8Array): Promise<void>;
  read(length: number, timeout?: number): Promise<Uint8Array>;
}

export interface TracedRead {
  requested: number;
  bytes?: Uint8Array;
  error?: string;
  ms: number;
}

export interface UsbTrace {
  /** Ultima risposta ricevuta (o errore). */
  lastRead: TracedRead | null;
  /** Ultima risposta per codice di comando (`0x55` = ESC U, `0x41` = ESC A, `0x56` = ESC V). */
  readsByOpcode: Map<number, TracedRead>;
  /** Ultimo comando scritto. */
  lastCommand: string | null;
  /** Chiamata dopo ogni scrittura e lettura riuscita (per esempio per contare le etichette di una stampa). */
  listener: ((event: { dir: 'tx' | 'rx'; opcode: number | null; bytes: Uint8Array }) => void) | null;
  /** Ripristina i metodi originali. */
  detach(): void;
}

/**
 * Avvolge un trasporto. Restituisce `null` se l'oggetto non ha la forma attesa
 * (per esempio in una versione futura della libreria): la stampa non cambia.
 */
export function traceTransport(transport: unknown, log: DiagnosticLog, now: () => number = () => performance.now()): UsbTrace | null {
  if (
    typeof transport !== 'object' ||
    transport === null ||
    typeof (transport as TransportLike).write !== 'function' ||
    typeof (transport as TransportLike).read !== 'function'
  ) {
    return null;
  }
  const target = transport as TransportLike;
  const originalWrite = target.write;
  const originalRead = target.read;
  let lastOpcode: number | null = null;
  const remember = (r: TracedRead) => {
    trace.lastRead = r;
    if (lastOpcode !== null) trace.readsByOpcode.set(lastOpcode, r);
  };
  const trace: UsbTrace = {
    lastRead: null,
    readsByOpcode: new Map(),
    lastCommand: null,
    listener: null,
    detach() {
      target.write = originalWrite;
      target.read = originalRead;
    },
  };

  target.write = async function (data: Uint8Array): Promise<void> {
    const command = describeCommand(data);
    trace.lastCommand = command;
    lastOpcode = data.length >= 2 && data[0] === ESC ? data[1]! : null;
    const started = now();
    try {
      await originalWrite.call(this, data);
      const ms = Math.round(now() - started);
      const hex = data.length <= MAX_TX_HEX ? toHex(data) : undefined;
      log.add('tx', `${command} · ${data.length} byte · ${ms} ms`, hex);
      trace.listener?.({ dir: 'tx', opcode: lastOpcode, bytes: data });
    } catch (err) {
      log.add('error', `Scrittura USB fallita: ${command} · ${data.length} byte`, describeError(err));
      throw err;
    }
  };

  target.read = async function (length: number, timeout?: number): Promise<Uint8Array> {
    const started = now();
    try {
      const bytes = await originalRead.call(this, length, timeout);
      const ms = Math.round(now() - started);
      remember({ requested: length, bytes: new Uint8Array(bytes), ms });
      log.add('rx', `risposta a ${trace.lastCommand ?? '?'} · ${bytes.length}/${length} byte · ${ms} ms`, toHex(bytes, MAX_RX_HEX));
      trace.listener?.({ dir: 'rx', opcode: lastOpcode, bytes });
      return bytes;
    } catch (err) {
      const ms = Math.round(now() - started);
      const message = describeError(err);
      remember({ requested: length, error: message, ms });
      log.add('error', `Lettura USB fallita dopo ${ms} ms (attesi ${length} byte, comando ${trace.lastCommand ?? '?'})`, message);
      throw err;
    }
  };

  return trace;
}

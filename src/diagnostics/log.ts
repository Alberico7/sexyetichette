/**
 * Registro degli eventi della sessione, solo in memoria.
 *
 * Tiene gli ultimi `LOG_CAPACITY` eventi: collegamento, stati, errori (con il
 * messaggio originale della libreria), traffico USB con la stampante, errori
 * JavaScript non gestiti e avvisi della libreria. Non viene salvato né inviato:
 * finisce solo nel testo che l'utente sceglie di copiare o condividere.
 */

export const LOG_CAPACITY = 300;

export type LogKind = 'app' | 'usb' | 'tx' | 'rx' | 'error' | 'warn';

export interface LogEntry {
  /** Millisecondi dall'epoca. */
  t: number;
  kind: LogKind;
  message: string;
  detail?: string;
}

export class DiagnosticLog {
  private buffer: LogEntry[] = [];
  private dropped = 0;
  readonly startedAt: number;

  constructor(
    readonly capacity = LOG_CAPACITY,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.startedAt = now();
  }

  add(kind: LogKind, message: string, detail?: string): void {
    const entry: LogEntry = { t: this.now(), kind, message };
    if (detail) entry.detail = detail;
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) {
      this.buffer.shift();
      this.dropped++;
    }
  }

  get entries(): readonly LogEntry[] {
    return this.buffer;
  }

  /** Eventi scartati perché il registro era pieno. */
  get droppedCount(): number {
    return this.dropped;
  }

  clear(): void {
    this.buffer = [];
    this.dropped = 0;
  }

  toText(): string {
    const lines: string[] = [];
    if (this.dropped > 0) lines.push(`(${this.dropped} eventi più vecchi non conservati)`);
    for (const e of this.buffer) {
      lines.push(`${formatTime(e.t)} ${KIND_LABELS[e.kind]} ${e.message}`);
      if (e.detail) lines.push(`             ${e.detail}`);
    }
    return lines.join('\n');
  }
}

const KIND_LABELS: Record<LogKind, string> = {
  app: 'APP ',
  usb: 'USB ',
  tx: '→   ',
  rx: '←   ',
  error: 'ERR ',
  warn: 'AVV ',
};

/** Ora locale con i millisecondi: 16:40:12.345 */
export function formatTime(t: number): string {
  const d = new Date(t);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** Descrizione di un errore qualsiasi, con nome e messaggio originali. */
export function describeError(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const name = 'name' in err ? String((err as { name: unknown }).name) : 'Error';
    return `${name}: ${String(err.message)}`;
  }
  return String(err);
}

/** Il registro dell'app. */
export const diagLog = new DiagnosticLog();

let installed = false;

/**
 * Registra errori non gestiti e avvisi della libreria della stampante
 * (i messaggi della console che iniziano con `[transport` o `[labelwriter`).
 */
export function installGlobalCapture(log: DiagnosticLog = diagLog, target: Window = window): void {
  if (installed) return;
  installed = true;
  target.addEventListener('error', (event) => {
    log.add('error', 'Errore JavaScript non gestito', `${event.message} (${event.filename}:${event.lineno})`);
  });
  target.addEventListener('unhandledrejection', (event) => {
    log.add('error', 'Promessa rifiutata non gestita', describeError(event.reason));
  });
  for (const level of ['warn', 'debug', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      const first = args[0];
      if (typeof first === 'string' && /^\[(transport|labelwriter|thermal)/i.test(first)) {
        log.add(level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'usb', `Libreria: ${first}`);
      }
      original(...args);
    };
  }
}

/**
 * Implementazione reale di `PrinterPort` su `@thermal-label/labelwriter-web`.
 * Tutto ciò che riguarda la libreria resta in questo file.
 */
import { fromUSBDeviceAll, requestPrinters, type WebLabelWriterPrinter } from '@thermal-label/labelwriter-web';
import { compose550Job, parseStatus, renderImage, type PrinterStatus } from '@thermal-label/labelwriter-core';
import { AppErrorException, appError, checkEnvironment, fromStatusError, toAppError, type AppError } from './errors';
import { diagLog, describeError } from '@/diagnostics/log';
import { classifyMediaRead, readWithRetry } from '@/diagnostics/media-read';
import { remainingLabels } from '@/diagnostics/print-history';
import { CopiesError, MULTI_COPY_MODE, write550CopiesDymoOrder, type Transport550 } from './copies';
import { traceTransport, type UsbTrace } from '@/diagnostics/usb-trace';
import { browserWatchdogDeps, startStatusWatchdog } from './status-watchdog';
import { versionProductId } from './engine-version';
import { LW550_VENDOR_ID, toLibraryMedia } from './media';
import { summarizeUsbDevice } from './usb-diagnostics';
import type {
  AppPrinterStatus,
  EngineVersionInfo,
  MediaReadResult,
  PrintControl,
  PrintJob,
  PrintOutcome,
  PrinterInfo,
  PrinterPort,
  PrinterProbe,
  ProbeResult,
  RawStatusInfo,
  UsbPrintCounts,
} from './types';

const OP_STATUS = 0x41;
const OP_SKU = 0x55;
const OP_VERSION = 0x56;
const OP_LABEL_INDEX = 0x6e;

function elapsed(start: number): number {
  return Math.round(performance.now() - start);
}

function usbName(d: USBDevice): string {
  return `${d.productName ?? '?'} (0x${d.vendorId.toString(16)}:0x${d.productId.toString(16)})`;
}

export function toAppStatus(status: PrinterStatus): AppPrinterStatus {
  return {
    ready: status.ready,
    mediaLoaded: status.mediaLoaded,
    problems: status.errors.map(fromStatusError),
    details: (status.details ?? []).map((d) => ({ label: d.label, value: d.value })),
  };
}

/** Argomenti passati a `print()` della libreria (esportata per i test con il driver reale). */
export function libraryPrintArgs(job: PrintJob): Parameters<WebLabelWriterPrinter['print']> {
  return [
    { width: job.image.width, height: job.image.height, data: job.image.data },
    toLibraryMedia(job.media, job.labelLengthDots),
    {
      copies: job.copies,
      density: job.density,
      // L'immagine è già nell'orientamento della testina: niente rotazione automatica.
      rotate: 0,
      labelLengthDots: job.labelLengthDots,
    },
  ];
}

function infoFrom(printer: WebLabelWriterPrinter): PrinterInfo {
  const usb = printer.device.transports.usb;
  const vid = usb ? Number.parseInt(String(usb.vid), 16) : LW550_VENDOR_ID;
  const pid = usb ? Number.parseInt(String(usb.pid), 16) : 0;
  return {
    model: printer.model,
    key: printer.device.key,
    vendorId: vid,
    productId: pid,
    // L'app è pensata e provata solo per la 550 standard (verificata dalla libreria);
    // la 550 Turbo e gli altri modelli sono trattati come non verificati.
    verified: printer.device.key === 'LW_550',
  };
}

/** Sceglie dalla mappa per motore l'adapter da usare (sulla 550 ce n'è uno solo). */
function pickAdapter(map: Readonly<Record<string, unknown>>): WebLabelWriterPrinter {
  const adapter = (map.primary ?? map.label ?? Object.values(map)[0]) as WebLabelWriterPrinter | undefined;
  if (!adapter) throw new AppErrorException(appError('access-denied', 'Nessun motore di stampa aperto'));
  return adapter;
}

export class WebUsbPrinterPort implements PrinterPort {
  readonly kind = 'webusb' as const;
  private printer: WebLabelWriterPrinter | null = null;
  private usbDevice: USBDevice | null = null;
  private trace: UsbTrace | null = null;
  private disconnectListeners = new Set<() => void>();
  private availableListeners = new Set<() => void>();
  private readonly handleUsbConnect = (event: USBConnectionEvent) => {
    // Il browser segnala solo i dispositivi già autorizzati per questo sito.
    diagLog.add('usb', `Dispositivo inserito: ${usbName(event.device)}`);
    if (event.device.vendorId !== LW550_VENDOR_ID || this.printer) return;
    for (const cb of this.availableListeners) cb();
  };
  private readonly handleUsbDisconnect = (event: USBConnectionEvent) => {
    diagLog.add('usb', `Dispositivo scollegato: ${usbName(event.device)}`);
    if (this.usbDevice && event.device !== this.usbDevice) return;
    // Se non conosco il dispositivo, verifico che sia una LabelWriter.
    if (!this.usbDevice && event.device.vendorId !== LW550_VENDOR_ID) return;
    if (!this.printer) return;
    this.printer = null;
    this.usbDevice = null;
    this.trace?.detach();
    this.trace = null;
    for (const cb of this.disconnectListeners) cb();
  };

  constructor() {
    if (typeof navigator !== 'undefined' && navigator.usb) {
      navigator.usb.addEventListener('disconnect', this.handleUsbDisconnect);
      navigator.usb.addEventListener('connect', this.handleUsbConnect);
    }
  }

  get connected(): boolean {
    return this.printer?.connected ?? false;
  }

  async connect(): Promise<PrinterInfo> {
    const envError = checkEnvironment();
    if (envError) throw new AppErrorException(envError);
    await this.closeQuietly();
    try {
      const map = await requestPrinters({ transport: 'usb' });
      diagLog.add('app', `Motori aperti dalla libreria: ${Object.keys(map).join(', ') || 'nessuno'}`);
      this.printer = pickAdapter(map);
      this.usbDevice = await this.findUsbDevice();
      this.attachTrace();
      return infoFrom(this.printer);
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
  }

  /**
   * Riapre senza selettore una stampante già autorizzata.
   * L'API nuova della libreria apre sempre il selettore, quindi qui uso
   * `fromUSBDeviceAll` (deprecata ma presente nella 0.6.4).
   */
  async reconnect(): Promise<PrinterInfo | null> {
    if (checkEnvironment()) return null;
    const devices = await navigator.usb.getDevices();
    const device = devices.find((d) => d.vendorId === LW550_VENDOR_ID);
    if (!device) return null;
    await this.closeQuietly();
    try {
      const map = await fromUSBDeviceAll(device);
      diagLog.add('app', `Motori aperti dalla libreria: ${Object.keys(map).join(', ') || 'nessuno'}`);
      this.printer = pickAdapter(map);
      this.usbDevice = device;
      this.attachTrace();
      return infoFrom(this.printer);
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
  }

  /** Osserva il traffico USB della libreria (campo privato `transport`). */
  private attachTrace(): void {
    this.trace?.detach();
    const transport = (this.printer as unknown as { transport?: unknown } | null)?.transport;
    this.trace = traceTransport(transport, diagLog);
    if (!this.trace) diagLog.add('warn', 'Traffico USB non osservabile con questa versione della libreria');
  }

  private async findUsbDevice(): Promise<USBDevice | null> {
    try {
      const devices = await navigator.usb.getDevices();
      return devices.find((d) => d.vendorId === LW550_VENDOR_ID && d.opened) ?? null;
    } catch {
      return null;
    }
  }

  private async closeQuietly(): Promise<void> {
    const p = this.printer;
    this.printer = null;
    this.usbDevice = null;
    this.trace?.detach();
    this.trace = null;
    if (p) {
      try {
        await p.close();
      } catch {
        // già chiusa
      }
    }
  }

  async disconnect(): Promise<void> {
    await this.closeQuietly();
  }

  private require(): WebLabelWriterPrinter {
    if (!this.printer) throw new AppErrorException(appError('not-connected'));
    return this.printer;
  }

  async getStatus(): Promise<AppPrinterStatus> {
    try {
      return toAppStatus(await this.require().getStatus());
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
  }

  onStatus(cb: (status: AppPrinterStatus) => void, onError?: (err: AppError) => void): () => void {
    const printer = this.require();
    // Il polling della libreria (ogni 4 s) ignora gli errori: li gestisce il controllo in
    // status-watchdog.ts, che distingue una stampante muta da una pagina sospesa dal telefono.
    const watchdog = startStatusWatchdog({
      ...browserWatchdogDeps(),
      requestStatus: async () => {
        if (!this.printer) return false;
        try {
          const s = await this.printer.getStatus();
          watchdog.seen();
          cb(toAppStatus(s));
          return true;
        } catch {
          return false;
        }
      },
      onTimeout: (detail) => {
        if (this.printer) onError?.(appError('timeout', detail));
      },
      log: (message) => diagLog.add('app', message),
    });
    const unsubscribe = printer.onStatus((s) => {
      watchdog.seen();
      cb(toAppStatus(s));
    });
    return () => {
      unsubscribe();
      watchdog.stop();
    };
  }

  async readMedia(): Promise<MediaReadResult> {
    const result = await readWithRetry(() => this.readMediaOnce());
    if (result.ok) {
      diagLog.add(
        'app',
        `Rotolo letto: ${result.detected.media.name} (codice ${result.detected.sku}), tentativi ${result.attempts}`,
      );
    } else {
      diagLog.add('warn', `Rotolo non letto (${result.reason}), tentativi ${result.attempts}`, result.detail);
    }
    return result;
  }

  /** Un solo tentativo di lettura del rotolo, con la causa precisa se fallisce. */
  private async readMediaOnce(): Promise<MediaReadResult> {
    if (!this.printer) return notConnected();
    return readMediaWith(this.printer, this.trace);
  }

  probe(): PrinterProbe | null {
    const printer = this.printer;
    if (!printer) return null;
    const device = this.usbDevice;
    return {
      device: () => (device ? summarizeUsbDevice(device) : null),
      version: async (): Promise<ProbeResult<EngineVersionInfo>> => {
        const start = performance.now();
        this.trace?.readsByOpcode.delete(OP_VERSION);
        try {
          const v = await printer.getEngineVersion();
          const read = this.trace?.readsByOpcode.get(OP_VERSION);
          const r: ProbeResult<EngineVersionInfo> = { ok: Boolean(v), ms: elapsed(start) };
          if (v) {
            r.value = {
              hardware: v.hwVersion,
              firmwareKind: v.fwKind,
              firmware: `${v.fwMajor}.${v.fwMinor}`,
              firmwareDate: v.fwReleaseDate,
              pid: versionProductId(v.rawBytes ? new Uint8Array(v.rawBytes) : undefined, v.pid),
            };
          } else {
            r.error = read?.error ?? `Risposta non valida (${read?.bytes?.length ?? '?'} byte)`;
          }
          const bytes = v?.rawBytes ?? read?.bytes;
          if (bytes) r.bytes = new Uint8Array(bytes);
          return r;
        } catch (err) {
          return { ok: false, error: describeError(err), ms: elapsed(start) };
        }
      },
      status: async (): Promise<ProbeResult<RawStatusInfo>> => {
        const start = performance.now();
        try {
          const s = await printer.getStatus();
          const value: RawStatusInfo = { status: toAppStatus(s) };
          const r: ProbeResult<RawStatusInfo> = { ok: true, ms: elapsed(start), value };
          const raw = s.rawBytes?.length ? s.rawBytes : this.trace?.readsByOpcode.get(OP_STATUS)?.bytes;
          if (raw && raw.length > 0) {
            r.bytes = new Uint8Array(raw);
            value.printStatus = raw[0]!;
          }
          return r;
        } catch (err) {
          return { ok: false, error: describeError(err), ms: elapsed(start) };
        }
      },
      media: () => this.readMediaOnce(),
    };
  }

  async print(job: PrintJob, control: PrintControl = {}): Promise<PrintOutcome> {
    const printer = this.require();
    const total = job.copies;
    let mode: PrintOutcome['mode'] = total > 1 ? MULTI_COPY_MODE : 'single';
    const usb = this.countUsb();
    diagLog.add(
      'app',
      `Stampa: immagine ${job.image.width}×${job.image.height} punti, etichetta ${job.labelLengthDots} punti, ${total} copie, densità ${job.density}, formato ${job.media.id}`,
    );
    let sent = 0;
    try {
      let result: { sent: number; stopped: boolean };
      if (total === 1) {
        await printer.print(...libraryPrintArgs(job));
        result = { sent: 1, stopped: false };
        control.onProgress?.(1, 1);
      } else {
        const copies = await printCopies(printer, job, control, MULTI_COPY_MODE, (n) => (sent = n));
        mode = copies.mode;
        result = copies;
      }
      sent = result.sent;
      diagLog.add(
        'app',
        result.stopped ? `Stampa fermata: ${result.sent} di ${total} etichette inviate` : 'Stampa completata',
      );
      return { mode, total, sent: result.sent, stopped: result.stopped, usb: usb.counts };
    } catch (err) {
      if (err instanceof CopiesError) sent = err.sent;
      const cause = err instanceof CopiesError ? (err.statusError ?? err.cause ?? err) : err;
      const e =
        cause && typeof cause === 'object' && 'code' in cause && 'message' in cause && !(cause instanceof Error)
          ? fromStatusError(cause as { code: string; message: string })
          : toAppError(cause);
      if (total > 1) e.partial = { sent, total, usb: usb.counts };
      diagLog.add('error', 'Stampa non riuscita', describeError(cause));
      throw new AppErrorException(e);
    } finally {
      usb.stop();
    }
  }

  /** Conteggi dal traffico USB osservato: etichette inviate (ESC n) e contatore del rotolo. */
  private countUsb(): { counts: UsbPrintCounts | undefined; stop(): void } {
    const trace = this.trace;
    if (!trace) return { counts: undefined, stop() {} };
    const counts: UsbPrintCounts = { labelsSent: 0 };
    trace.listener = (e) => {
      if (e.dir === 'tx' && e.opcode === OP_LABEL_INDEX) counts.labelsSent++;
      if (e.dir === 'rx' && e.opcode === OP_STATUS) {
        const left = remainingLabels(e.bytes);
        if (left === undefined) return;
        counts.remainingBefore ??= left;
        counts.remainingAfter = left;
      }
    };
    return {
      counts,
      stop() {
        trace.listener = null;
      },
    };
  }

  async recover(): Promise<void> {
    try {
      diagLog.add('app', 'Ripristino stampante richiesto dall’utente');
      await this.require().recover();
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }

  onDeviceAvailable(cb: () => void): () => void {
    this.availableListeners.add(cb);
    return () => this.availableListeners.delete(cb);
  }
}

/**
 * Un tentativo di `getMedia()` con la causa precisa in caso di fallimento,
 * ricavata dai byte osservati sul trasporto (esportata per i test con il driver reale).
 */
export async function readMediaWith(
  printer: Pick<WebLabelWriterPrinter, 'getMedia'>,
  trace: UsbTrace | null,
): Promise<MediaReadResult> {
  trace?.readsByOpcode.delete(OP_SKU);
  try {
    const sku = await printer.getMedia();
    const read = trace?.readsByOpcode.get(OP_SKU);
    return classifyMediaRead({ sku, bytes: read?.bytes, readError: read?.error });
  } catch (err) {
    const read = trace?.readsByOpcode.get(OP_SKU);
    return classifyMediaRead({ error: err, bytes: read?.bytes, readError: read?.error });
  }
}

function notConnected(): MediaReadResult {
  return {
    ok: false,
    reason: 'not-connected',
    message: 'Stampante non collegata.',
    detail: 'not-connected',
    attempts: 1,
  };
}

/** Parti interne di `WebLabelWriterPrinter` usate per le copie multiple (0.6.4). */
interface LibraryInternals {
  run<T>(fn: () => Promise<T>): Promise<T>;
  acquireLock(): Promise<void>;
  transport: Transport550;
}

/**
 * Coda dei comandi, blocco della stampante e trasporto della libreria. Sono
 * campi privati: se una versione futura li cambia, `null` e si stampa una
 * copia alla volta.
 */
function libraryInternals(printer: WebLabelWriterPrinter): LibraryInternals | null {
  const p = printer as unknown as {
    serializer?: { run?: unknown };
    doAcquire550Lock?: unknown;
    transport?: { write?: unknown; read?: unknown };
  };
  const serializer = p.serializer;
  const transport = p.transport;
  if (
    typeof serializer?.run !== 'function' ||
    typeof p.doAcquire550Lock !== 'function' ||
    typeof transport?.write !== 'function' ||
    typeof transport.read !== 'function'
  ) {
    return null;
  }
  const run = serializer.run as <T>(fn: () => Promise<T>) => Promise<T>;
  const acquire = p.doAcquire550Lock as () => Promise<void>;
  return {
    run: <T>(fn: () => Promise<T>) => run.call(serializer, fn) as Promise<T>,
    acquireLock: () => acquire.call(printer),
    transport: transport as Transport550,
  };
}

/** Riserva: N lavori da 1 copia, il percorso provato su carta. */
async function printOneByOne(
  printer: WebLabelWriterPrinter,
  job: PrintJob,
  control: PrintControl,
  onSent: (n: number) => void,
): Promise<{ sent: number; stopped: boolean }> {
  const total = job.copies;
  for (let i = 0; i < total; i++) {
    if (i > 0 && control.shouldStop?.()) return { sent: i, stopped: true };
    try {
      await printer.print(...libraryPrintArgs({ ...job, copies: 1 }));
    } catch (err) {
      throw new CopiesError(err instanceof Error ? err.message : String(err), i, total, err);
    }
    onSent(i + 1);
    control.onProgress?.(i + 1, total);
  }
  return { sent: total, stopped: false };
}

/**
 * Due o più copie. Modo `'job'`: un lavoro con più etichette nell'ordine del
 * driver DYMO, nella coda dei comandi della libreria (nessuna richiesta di
 * stato si infila a metà). Se le parti interne della libreria mancano, o con
 * il modo `'one-by-one'`, un lavoro da 1 copia per volta.
 */
export async function printCopies(
  printer: WebLabelWriterPrinter,
  job: PrintJob,
  control: PrintControl,
  mode: 'job' | 'one-by-one' = MULTI_COPY_MODE,
  onSent: (n: number) => void = () => {},
): Promise<{ sent: number; stopped: boolean; mode: 'job' | 'one-by-one' }> {
  const internals = mode === 'job' ? libraryInternals(printer) : null;
  if (mode === 'job' && !internals) {
    diagLog.add('warn', 'Copie: parti interne della libreria non trovate, stampo una copia alla volta');
  }
  if (!internals) return { ...(await printOneByOne(printer, job, control, onSent)), mode: 'one-by-one' };
  const result = await internals.run(async () => {
    await internals.acquireLock();
    const [image, media, options] = libraryPrintArgs(job);
    const bitmap = renderImage(image, { dither: true, rotate: 0 });
    const composed = compose550Job(printer.device, bitmap, options, media);
    return write550CopiesDymoOrder(internals.transport, composed, {
      ...control,
      onProgress: (sent, total) => {
        onSent(sent);
        control.onProgress?.(sent, total);
      },
      statusProblem: (bytes) => {
        if (bytes[0] === 3) return { code: 'job_cancelled', message: 'Print job cancelled on the printer' };
        return parseStatus(printer.device, bytes).errors[0] ?? null;
      },
      log: (m) => diagLog.add('app', m),
    });
  });
  return { sent: result.sent, stopped: result.stopped, mode: 'job' };
}

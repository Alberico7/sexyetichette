/**
 * Implementazione reale di `PrinterPort` su `@thermal-label/labelwriter-web`.
 * Tutto ciò che riguarda la libreria resta in questo file.
 */
import {
  fromUSBDeviceAll,
  requestPrinters,
  type WebLabelWriterPrinter,
} from '@thermal-label/labelwriter-web';
import type { PrinterStatus } from '@thermal-label/labelwriter-core';
import {
  AppErrorException,
  appError,
  checkEnvironment,
  fromStatusError,
  toAppError,
  type AppError,
} from './errors';
import { diagLog, describeError } from '@/diagnostics/log';
import { classifyMediaRead, readWithRetry } from '@/diagnostics/media-read';
import { traceTransport, type UsbTrace } from '@/diagnostics/usb-trace';
import { versionProductId } from './engine-version';
import { LW550_VENDOR_ID, toLibraryMedia } from './media';
import { summarizeUsbDevice } from './usb-diagnostics';
import type {
  AppPrinterStatus,
  EngineVersionInfo,
  MediaReadResult,
  PrintJob,
  PrinterInfo,
  PrinterPort,
  PrinterProbe,
  ProbeResult,
  RawStatusInfo,
} from './types';

const OP_STATUS = 0x41;
const OP_SKU = 0x55;
const OP_VERSION = 0x56;

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
    // Il polling della libreria (ogni 4 s) ignora gli errori: li gestisco con un mio
    // controllo, così una stampante muta viene segnalata.
    let lastOk = Date.now();
    const unsubscribe = printer.onStatus((s) => {
      lastOk = Date.now();
      cb(toAppStatus(s));
    });
    const watchdog = setInterval(() => {
      if (!this.printer) return;
      // Durante una stampa lunga il polling attende il lock: tolleranza ampia.
      if (Date.now() - lastOk > 30_000) {
        onError?.(appError('timeout', 'Nessuno stato ricevuto da 30 secondi'));
        lastOk = Date.now();
      }
    }, 5_000);
    return () => {
      unsubscribe();
      clearInterval(watchdog);
    };
  }

  async readMedia(): Promise<MediaReadResult> {
    const result = await readWithRetry(() => this.readMediaOnce());
    if (result.ok) {
      diagLog.add('app', `Rotolo letto: ${result.detected.media.name} (codice ${result.detected.sku}), tentativi ${result.attempts}`);
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

  async print(job: PrintJob): Promise<void> {
    const printer = this.require();
    try {
      diagLog.add(
        'app',
        `Stampa: immagine ${job.image.width}×${job.image.height} punti, etichetta ${job.labelLengthDots} punti, ${job.copies} copie, densità ${job.density}, formato ${job.media.id}`,
      );
      await printer.print(...libraryPrintArgs(job));
      diagLog.add('app', 'Stampa completata dalla libreria');
    } catch (err) {
      diagLog.add('error', 'Stampa non riuscita', describeError(err));
      throw new AppErrorException(toAppError(err));
    }
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
export async function readMediaWith(printer: Pick<WebLabelWriterPrinter, 'getMedia'>, trace: UsbTrace | null): Promise<MediaReadResult> {
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
  return { ok: false, reason: 'not-connected', message: 'Stampante non collegata.', detail: 'not-connected', attempts: 1 };
}

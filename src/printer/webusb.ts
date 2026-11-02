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
import { LW550_VENDOR_ID, mediaFromSku, toLibraryMedia } from './media';
import type { AppPrinterStatus, DetectedMedia, PrintJob, PrinterInfo, PrinterPort } from './types';

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
  private disconnectListeners = new Set<() => void>();
  private readonly handleUsbDisconnect = (event: USBConnectionEvent) => {
    if (this.usbDevice && event.device !== this.usbDevice) return;
    // Se non conosco il dispositivo, verifico che sia una LabelWriter.
    if (!this.usbDevice && event.device.vendorId !== LW550_VENDOR_ID) return;
    if (!this.printer) return;
    this.printer = null;
    this.usbDevice = null;
    for (const cb of this.disconnectListeners) cb();
  };

  constructor() {
    if (typeof navigator !== 'undefined' && navigator.usb) {
      navigator.usb.addEventListener('disconnect', this.handleUsbDisconnect);
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
      this.printer = pickAdapter(map);
      this.usbDevice = await this.findUsbDevice();
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
      this.printer = pickAdapter(map);
      this.usbDevice = device;
      return infoFrom(this.printer);
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
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

  async readMedia(): Promise<DetectedMedia | null> {
    const printer = this.require();
    try {
      const sku = await printer.getMedia();
      if (!sku) return null;
      const found = mediaFromSku(sku);
      if (!found) return null;
      const result: DetectedMedia = { sku: sku.sku.trim(), media: found.media, fromCatalog: found.fromCatalog };
      if (sku.totalLabelCount > 0) result.totalLabels = sku.totalLabelCount;
      return result;
    } catch {
      return null;
    }
  }

  async print(job: PrintJob): Promise<void> {
    const printer = this.require();
    try {
      await printer.print(...libraryPrintArgs(job));
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
  }

  async recover(): Promise<void> {
    try {
      await this.require().recover();
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }
}

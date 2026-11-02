/**
 * Stampante simulata, per sviluppo e test senza hardware.
 * Viene caricata solo in modalità sviluppo o test (vedi `printer/index.ts`).
 *
 * Imita il comportamento del driver reale nei punti che contano per l'app:
 * lock di stampa, controllo dello stato prima della stampa, messaggi d'errore
 * con lo stesso testo della libreria, dithering finale del driver.
 */
import { renderImage, type LabelBitmap } from '@mbtech-nl/bitmap';
import { AppErrorException, appError, fromStatusError, toAppError, type AppError } from './errors';
import { LW550_HEAD, findMediaById, mediaFromSku } from './media';
import type { AppPrinterStatus, DetectedMedia, PrintJob, PrinterInfo, PrinterPort } from './types';

export type SimulatedFault =
  | 'none'
  | 'no-media'
  | 'counterfeit'
  | 'cover-open'
  | 'busy'
  | 'timeout'
  | 'disconnect-on-print'
  | 'nfc-unreadable';

export interface SimulatedConfig {
  /** Esito del selettore: dispositivo scelto, selettore chiuso o dispositivo non supportato. */
  picker: 'ok' | 'cancel' | 'denied' | 'unknown-device';
  model: 'LW_550' | 'LW_550_TURBO';
  /** SKU del rotolo inserito (letto via NFC). */
  rollSku: string;
  fault: SimulatedFault;
  /** Ritardo per etichetta, in ms. */
  delayMs: number;
}

export interface RecordedJob {
  job: PrintJob;
  /** Bitmap ottenuto applicando all'immagine lo stesso dithering del driver. */
  driverBitmap: LabelBitmap;
  at: number;
}

const DEFAULT_CONFIG: SimulatedConfig = {
  picker: 'ok',
  model: 'LW_550',
  rollSku: '30252',
  fault: 'none',
  delayMs: 150,
};

function domException(name: string, message: string): Error {
  if (typeof DOMException !== 'undefined') return new DOMException(message, name);
  const e = new Error(message);
  e.name = name;
  return e;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export class SimulatedPrinterPort implements PrinterPort {
  readonly kind = 'simulated' as const;
  config: SimulatedConfig;
  readonly jobs: RecordedJob[] = [];
  private isConnected = false;
  private printing = false;
  private statusListeners = new Set<(s: AppPrinterStatus) => void>();
  private disconnectListeners = new Set<() => void>();
  private availableListeners = new Set<() => void>();
  /** La stampante è stata autorizzata (selettore) almeno una volta. */
  private authorized = false;
  /** Il cavo è inserito. */
  private plugged = true;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<SimulatedConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get connected(): boolean {
    return this.isConnected;
  }

  configure(patch: Partial<SimulatedConfig>): void {
    this.config = { ...this.config, ...patch };
    if (this.isConnected) void this.emitStatus();
  }

  private info(): PrinterInfo {
    const turbo = this.config.model === 'LW_550_TURBO';
    return {
      model: turbo ? 'LabelWriter 550 Turbo (simulata)' : 'LabelWriter 550 (simulata)',
      key: this.config.model,
      vendorId: 0x0922,
      productId: turbo ? 0x0029 : 0x0028,
      verified: !turbo,
      serialNumber: 'SIM-0001',
    };
  }

  async connect(): Promise<PrinterInfo> {
    await sleep(Math.min(this.config.delayMs, 50));
    try {
      switch (this.config.picker) {
        case 'cancel':
          throw domException('NotFoundError', 'No device selected.');
        case 'denied':
          throw domException('SecurityError', 'Access denied.');
        case 'unknown-device':
          throw new Error('Unsupported USB device: VID=0x1234 PID=0x5678');
      }
    } catch (err) {
      throw new AppErrorException(toAppError(err));
    }
    this.isConnected = true;
    this.authorized = true;
    this.plugged = true;
    return this.info();
  }

  /** Come il browser: riapre senza selettore solo se già autorizzata e inserita. */
  async reconnect(): Promise<PrinterInfo | null> {
    if (!this.authorized || !this.plugged) return null;
    this.isConnected = true;
    return this.info();
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.stopPolling();
  }

  /** Simula lo scollegamento fisico del cavo. */
  unplug(): void {
    this.plugged = false;
    if (!this.isConnected) return;
    this.isConnected = false;
    this.stopPolling();
    for (const cb of this.disconnectListeners) cb();
  }

  private require(): void {
    if (!this.isConnected) throw new AppErrorException(appError('not-connected'));
  }

  /** Stato grezzo nello stesso formato della libreria. */
  private rawStatus(): { ready: boolean; mediaLoaded: boolean; errors: { code: string; message: string }[] } {
    const errors: { code: string; message: string }[] = [];
    switch (this.config.fault) {
      case 'no-media':
        errors.push({ code: 'no_media', message: 'No label roll loaded' });
        break;
      case 'counterfeit':
        errors.push({ code: 'counterfeit_media', message: 'Loaded label roll failed Dymo NFC authentication' });
        break;
      case 'cover-open':
        errors.push({ code: 'cover_open', message: 'Printer cover is open' });
        break;
    }
    const mediaLoaded = this.config.fault !== 'no-media';
    return { ready: errors.length === 0 && !this.printing, mediaLoaded, errors };
  }

  async getStatus(): Promise<AppPrinterStatus> {
    this.require();
    if (this.config.fault === 'timeout') {
      throw new AppErrorException(appError('timeout', 'TransportTimeoutError: simulated'));
    }
    const raw = this.rawStatus();
    return {
      ready: raw.ready,
      mediaLoaded: raw.mediaLoaded,
      problems: raw.errors.map(fromStatusError),
      details: [
        { label: 'Simulazione', value: 'attiva' },
        { label: 'Roll SKU', value: this.config.rollSku },
      ],
    };
  }

  private async emitStatus(): Promise<void> {
    try {
      const s = await this.getStatus();
      for (const cb of this.statusListeners) cb(s);
    } catch {
      // ignorato, come nel polling della libreria
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  onStatus(cb: (status: AppPrinterStatus) => void, onError?: (err: AppError) => void): () => void {
    this.require();
    this.statusListeners.add(cb);
    void this.emitStatus();
    if (!this.pollTimer) {
      this.pollTimer = setInterval(() => {
        if (this.config.fault === 'timeout') {
          onError?.(appError('timeout', 'simulated'));
          return;
        }
        void this.emitStatus();
      }, 4000);
    }
    return () => {
      this.statusListeners.delete(cb);
      if (this.statusListeners.size === 0) this.stopPolling();
    };
  }

  async readMedia(): Promise<DetectedMedia | null> {
    this.require();
    await sleep(Math.min(this.config.delayMs, 50));
    if (this.config.fault === 'nfc-unreadable' || this.config.fault === 'no-media') return null;
    const fromCatalog = mediaFromSku({
      sku: this.config.rollSku,
      labelWidthMm: 28,
      labelLengthMm: 89,
      labelType: 'die',
    });
    if (!fromCatalog) return null;
    return { sku: this.config.rollSku, media: fromCatalog.media, fromCatalog: fromCatalog.fromCatalog, totalLabels: 130 };
  }

  async print(job: PrintJob): Promise<void> {
    this.require();
    try {
      // Stessi controlli del driver reale, con gli stessi messaggi.
      if (this.printing || this.config.fault === 'busy') {
        throw new Error(`Print lock on ${this.config.model} is held by another host. Wait for it to finish.`);
      }
      const raw = this.rawStatus();
      const first = raw.errors[0];
      if (first) throw new Error(`Cannot print on ${this.config.model}: ${first.message} (${first.code})`);
      if (this.config.fault === 'timeout') {
        const e = new Error('Transfer timed out after 15000 ms');
        e.name = 'TransportTimeoutError';
        throw e;
      }
      validateJob(job);
      this.printing = true;
      for (let i = 0; i < job.copies; i++) {
        await sleep(this.config.delayMs);
        if (this.config.fault === 'disconnect-on-print') {
          this.unplug();
          const e = new Error('Transport closed');
          e.name = 'TransportClosedError';
          throw e;
        }
      }
      const driverBitmap = renderImage(job.image, { dither: true, rotate: 0 });
      this.jobs.push({ job, driverBitmap, at: Date.now() });
    } catch (err) {
      throw err instanceof AppErrorException ? err : new AppErrorException(toAppError(err));
    } finally {
      this.printing = false;
    }
  }

  async recover(): Promise<void> {
    this.require();
    this.printing = false;
    if (this.config.fault === 'busy') this.config.fault = 'none';
  }

  onDisconnect(cb: () => void): () => void {
    this.disconnectListeners.add(cb);
    return () => this.disconnectListeners.delete(cb);
  }

  /** Simula l'inserimento del cavo (evento `connect` di WebUSB). */
  plugIn(): void {
    this.plugged = true;
    if (!this.authorized || this.isConnected) return;
    for (const cb of this.availableListeners) cb();
  }

  onDeviceAvailable(cb: () => void): () => void {
    this.availableListeners.add(cb);
    return () => this.availableListeners.delete(cb);
  }
}

/** Controlli di coerenza sul lavoro: aiutano a trovare errori nel rendering. */
export function validateJob(job: PrintJob): void {
  const { image } = job;
  if (image.width <= 0 || image.height <= 0) throw new Error('Immagine vuota');
  if (image.width > LW550_HEAD.headDots) {
    throw new Error(`Immagine larga ${image.width} punti: la testina ne ha ${LW550_HEAD.headDots}`);
  }
  if (image.data.length !== image.width * image.height * 4) throw new Error('Dimensione dati RGBA errata');
  if (job.copies < 1 || !Number.isInteger(job.copies)) throw new Error('Numero di copie non valido');
  if (job.labelLengthDots < image.height) throw new Error('Lunghezza etichetta minore dell’immagine');
  if (!findMediaById(job.media.id) && !job.media.id.startsWith('custom') && !job.media.id.startsWith('nfc')) {
    throw new Error(`Formato sconosciuto: ${job.media.id}`);
  }
}

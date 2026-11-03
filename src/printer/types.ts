import type { MediaFormat } from '@/model/types';
import type { AppError } from './errors';

/** Immagine RGBA (4 byte per pixel). */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export type Density = 'light' | 'medium' | 'normal' | 'high';

export interface PrinterInfo {
  model: string;
  /** Chiave del registro (es. `LW_550`). */
  key: string;
  vendorId: number;
  productId: number;
  /** `true` se il modello è stato verificato dagli autori della libreria. */
  verified: boolean;
  serialNumber?: string;
}

export interface AppPrinterStatus {
  ready: boolean;
  mediaLoaded: boolean;
  /** Problemi segnalati dalla stampante, già tradotti. */
  problems: AppError[];
  /** Righe diagnostiche fornite dal driver (etichetta e valore). */
  details: { label: string; value: string }[];
}

export interface DetectedMedia {
  /** Codice letto dal tag NFC del rotolo. */
  sku: string;
  /** Voce del catalogo corrispondente, oppure formato ricavato dalle misure del tag. */
  media: MediaFormat;
  /** `true` se il formato è stato trovato nel catalogo. */
  fromCatalog: boolean;
  totalLabels?: number;
}

/** Motivo per cui il rotolo non è stato letto. */
export type MediaReadReason =
  | 'timeout'
  | 'short'
  | 'bad-magic'
  | 'no-size'
  | 'invalid'
  | 'error'
  | 'unsupported'
  | 'not-connected';

/** Esito della lettura del rotolo via NFC. */
export type MediaReadResult =
  | {
      ok: true;
      detected: DetectedMedia;
      /** Campi del tag, in italiano. */
      fields: { label: string; value: string }[];
      bytes?: Uint8Array;
      attempts: number;
    }
  | {
      ok: false;
      reason: MediaReadReason;
      /** Spiegazione in italiano. */
      message: string;
      /** Messaggio tecnico. */
      detail: string;
      bytes?: Uint8Array;
      attempts: number;
    };

/** Una riga di dettaglio: etichetta e valore. */
export interface DetailRow {
  label: string;
  value: string;
}

/** Endpoint USB di un'interfaccia. */
export interface EndpointInfo {
  number: number;
  direction: 'in' | 'out';
  type: string;
  packetSize: number;
}

/** Descrizione del dispositivo USB aperto, per la diagnostica. */
export interface UsbDeviceSummary {
  productName: string;
  manufacturerName: string;
  vendorId: number;
  productId: number;
  usbVersion: string;
  /** Versione del dispositivo (`bcdDevice`), di solito il firmware. */
  deviceVersion: string;
  serialTail?: string;
  interfaces: { number: number; classCode: number; className: string; claimed: boolean; endpoints: EndpointInfo[] }[];
}

/** Risposta grezza di un comando di sola lettura. */
export interface ProbeResult<T> {
  ok: boolean;
  value?: T;
  /** Byte ricevuti, se disponibili. */
  bytes?: Uint8Array;
  error?: string;
  ms: number;
}

export interface EngineVersionInfo {
  hardware: string;
  firmwareKind: string;
  firmware: string;
  firmwareDate: string;
  pid: number;
}

export interface RawStatusInfo {
  status: AppPrinterStatus;
  /** Byte 0 della risposta: 0 inattiva, 1 in stampa, 2 errore, 5 lock di un altro host. */
  printStatus?: number;
}

/**
 * Comandi di sola lettura per la diagnostica. Nessuno stampa, fa avanzare
 * la carta o cambia impostazioni.
 */
export interface PrinterProbe {
  device(): UsbDeviceSummary | null;
  /** `ESC V`. */
  version(): Promise<ProbeResult<EngineVersionInfo>>;
  /** `ESC A 0`. */
  status(): Promise<ProbeResult<RawStatusInfo>>;
  /** `ESC U`, un solo tentativo. */
  media(): Promise<MediaReadResult>;
}

/**
 * Lavoro di stampa già pronto: immagine nell'orientamento della testina
 * (larghezza = punti attraverso il rotolo), solo pixel bianchi o neri.
 */
export interface PrintJob {
  image: RgbaImage;
  media: MediaFormat;
  /** Lunghezza totale dell'etichetta in punti, zona non stampabile compresa. */
  labelLengthDots: number;
  copies: number;
  density: Density;
}

/** Interfaccia minima tra l'app e la stampante. */
export interface PrinterPort {
  readonly kind: 'webusb' | 'simulated';
  /** Apre il selettore del browser: va chiamata dentro un gesto dell'utente. */
  connect(): Promise<PrinterInfo>;
  /** Riapre una stampante già autorizzata senza selettore. `null` se non ce n'è. */
  reconnect(): Promise<PrinterInfo | null>;
  disconnect(): Promise<void>;
  readonly connected: boolean;
  getStatus(): Promise<AppPrinterStatus>;
  /** Restituisce la funzione per annullare l'iscrizione. */
  onStatus(cb: (status: AppPrinterStatus) => void, onError?: (err: AppError) => void): () => void;
  /** Lettura del rotolo via NFC, con un secondo tentativo se la prima fallisce. */
  readMedia(): Promise<MediaReadResult>;
  /** Comandi di sola lettura per la diagnostica; `null` se non collegata. */
  probe(): PrinterProbe | null;
  print(job: PrintJob): Promise<void>;
  recover(): Promise<void>;
  /** Chiamata quando la stampante viene scollegata fisicamente. */
  onDisconnect(cb: () => void): () => void;
  /** Chiamata quando viene inserita una stampante già autorizzata in passato. */
  onDeviceAvailable(cb: () => void): () => void;
}

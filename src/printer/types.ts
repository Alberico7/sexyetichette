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
  /** Lettura del rotolo via NFC. `null` se la lettura non è disponibile o fallisce. */
  readMedia(): Promise<DetectedMedia | null>;
  print(job: PrintJob): Promise<void>;
  recover(): Promise<void>;
  /** Chiamata quando la stampante viene scollegata fisicamente. */
  onDisconnect(cb: () => void): () => void;
}

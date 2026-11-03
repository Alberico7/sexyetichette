/**
 * Lettura del rotolo (NFC): classificazione della causa quando fallisce,
 * campi del tag in italiano e confronto con il catalogo.
 *
 * Logica pura: riceve ciò che la libreria ha restituito (o l'errore) e i byte
 * osservati sul trasporto USB.
 */
import type { SkuInfo } from '@thermal-label/labelwriter-core';
import { findMediaBySku, mediaFromSku } from '@/printer/media';
import type { DetectedMedia, MediaReadReason, MediaReadResult } from '@/printer/types';
import { describeError } from './log';
import { toHex } from './hex';

export const SKU_BYTES = 63;
export const SKU_MAGIC = 0xcab6;

export const REASON_MESSAGES: Record<MediaReadReason, string> = {
  timeout: 'La stampante non ha risposto alla richiesta dei dati del rotolo.',
  short: 'La stampante ha risposto con meno dati del previsto.',
  'bad-magic': 'La stampante ha risposto, ma i dati non sono quelli di un tag DYMO valido (tag vuoto, non originale o letto male).',
  'no-size': 'Il tag del rotolo è stato letto ma non contiene le misure dell’etichetta.',
  invalid: 'La risposta della stampante non è valida.',
  error: 'Errore durante la lettura del rotolo.',
  unsupported: 'Questa stampante non permette di leggere il rotolo.',
  'not-connected': 'Stampante non collegata.',
};

type SkuLike = Pick<SkuInfo, 'sku' | 'labelWidthMm' | 'labelLengthMm' | 'labelType'> & Partial<SkuInfo>;

export interface ClassifyInput {
  /** Valore restituito da `getMedia()`; assente se ha lanciato un errore. */
  sku?: SkuLike | undefined;
  error?: unknown;
  /** Byte ricevuti in risposta a `ESC U`, se osservati. */
  bytes?: Uint8Array | undefined;
  /** Errore della lettura USB osservato sul trasporto. */
  readError?: string | undefined;
}

function u16le(b: Uint8Array, o: number): number {
  return (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
}

function isTimeout(text: string): boolean {
  return /timeout|timed out|tempo scaduto/i.test(text);
}

function failure(reason: MediaReadReason, detail: string, bytes?: Uint8Array): MediaReadResult {
  const r: MediaReadResult = { ok: false, reason, message: REASON_MESSAGES[reason], detail, attempts: 1 };
  if (bytes) r.bytes = bytes;
  return r;
}

/** Esito di un singolo tentativo di lettura. */
export function classifyMediaRead(input: ClassifyInput): MediaReadResult {
  const { sku, error, bytes, readError } = input;
  if (error !== undefined) {
    const text = describeError(error);
    if (/UnsupportedOperation/i.test(text)) return failure('unsupported', text, bytes);
    if (isTimeout(text) || (readError && isTimeout(readError))) return failure('timeout', text, bytes);
    return failure('error', text, bytes);
  }
  if (sku) {
    const found = mediaFromSku(sku);
    if (!found) {
      return failure('no-size', `Codice «${sku.sku.trim() || '(vuoto)'}», larghezza ${sku.labelWidthMm} mm, lunghezza ${sku.labelLengthMm} mm`, bytes);
    }
    const detected: DetectedMedia = { sku: sku.sku.trim(), media: found.media, fromCatalog: found.fromCatalog };
    if ((sku.totalLabelCount ?? 0) > 0) detected.totalLabels = sku.totalLabelCount!;
    const ok: MediaReadResult = { ok: true, detected, fields: skuFields(sku), attempts: 1 };
    if (bytes) ok.bytes = bytes;
    return ok;
  }
  // `getMedia()` ha restituito `undefined`: risposta corta o codice errato.
  if (readError) return failure(isTimeout(readError) ? 'timeout' : 'error', readError, bytes);
  if (!bytes) return failure('invalid', 'La libreria non ha restituito dati e i byte ricevuti non sono disponibili.');
  if (bytes.length < SKU_BYTES) return failure('short', `Ricevuti ${bytes.length} byte su ${SKU_BYTES}.`, bytes);
  const magic = u16le(bytes, 0);
  if (magic !== SKU_MAGIC) {
    return failure('bad-magic', `Codice iniziale 0x${magic.toString(16).padStart(4, '0')} invece di 0x${SKU_MAGIC.toString(16)}.`, bytes);
  }
  return failure('invalid', 'Dati del tag non interpretabili.', bytes);
}

/** Ripete la lettura una volta (o più) se fallisce. */
export async function readWithRetry(
  readOnce: () => Promise<MediaReadResult>,
  { retries = 1, delayMs = 500, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) } = {},
): Promise<MediaReadResult> {
  let result = await readOnce();
  let attempts = 1;
  while (!result.ok && attempts <= retries && result.reason !== 'unsupported' && result.reason !== 'not-connected') {
    await sleep(delayMs);
    result = await readOnce();
    attempts++;
  }
  return { ...result, attempts };
}

const mm = (n: number | undefined) => (n === undefined ? '–' : `${String(n).replace('.', ',')} mm`);

/** Tutti i campi del tag NFC, in italiano. */
export function skuFields(sku: SkuLike): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: 'Codice (SKU)', value: sku.sku.trim() || '(vuoto)' },
  ];
  const add = (label: string, value: unknown) => {
    if (value !== undefined && value !== '') rows.push({ label, value: String(value) });
  };
  add('Marca', sku.brand);
  add('Materiale', sku.material);
  add('Tipo', sku.labelType);
  add('Colore etichetta', sku.labelColor);
  add('Colore stampa', sku.contentColor);
  rows.push({ label: 'Larghezza', value: mm(sku.labelWidthMm) });
  rows.push({ label: 'Lunghezza', value: mm(sku.labelLengthMm) });
  if (sku.linerWidthMm !== undefined) add('Larghezza del supporto', mm(sku.linerWidthMm));
  if (sku.printableHorizontalOffsetMm !== undefined) add('Offset stampabile orizzontale', mm(sku.printableHorizontalOffsetMm));
  if (sku.printableVerticalOffsetMm !== undefined) add('Offset stampabile verticale', mm(sku.printableVerticalOffsetMm));
  if (sku.verticalOffsetMm !== undefined) add('Offset verticale', mm(sku.verticalOffsetMm));
  if (sku.markerType !== undefined) add('Tipo di tacca', sku.markerType);
  if (sku.markerPitchMm !== undefined) add('Passo delle tacche', mm(sku.markerPitchMm));
  add('Etichette totali', sku.totalLabelCount);
  if (sku.totalLengthMm !== undefined) add('Lunghezza totale', mm(sku.totalLengthMm));
  add('Margine contatore', sku.counterMargin);
  add('Contatore', sku.counterStrategy);
  add('Data di produzione', sku.productionDate);
  add('Ora di produzione', sku.productionTime);
  add('Versione del tag', sku.version);
  add('Regione', sku.region);
  return rows;
}

export interface CatalogComparison {
  /** Nome del formato nel catalogo, se il codice è noto. */
  catalogName?: string;
  /** Le misure del tag coincidono con quelle del catalogo (in un verso o nell'altro). */
  sizeMatches?: boolean;
  message: string;
}

export function compareWithCatalog(sku: SkuLike): CatalogComparison {
  const entry = findMediaBySku(sku.sku);
  if (!entry) {
    return { message: `Codice «${sku.sku.trim() || '(vuoto)'}» non presente nel catalogo dell’app: uso le misure lette dal tag.` };
  }
  const near = (a: number, b: number | undefined) => b !== undefined && Math.abs(a - b) <= 0.6;
  const w = sku.labelWidthMm;
  const l = sku.labelLengthMm;
  const same = (near(w, entry.widthMm) && (l === 0 ? entry.lengthMm === undefined : near(l, entry.lengthMm))) ||
    (near(l, entry.widthMm) && near(w, entry.lengthMm));
  return {
    catalogName: entry.name,
    sizeMatches: same,
    message: same
      ? `Codice nel catalogo: ${entry.name}. Misure coincidenti.`
      : `Codice nel catalogo: ${entry.name}, ma le misure del tag (${mm(w)} × ${mm(l)}) sono diverse.`,
  };
}

/** Testo da copiare sulla lettura del rotolo. */
export function mediaReadToText(result: MediaReadResult): string {
  const lines: string[] = [];
  if (result.ok) {
    lines.push(`Rotolo letto: ${result.detected.media.name} (codice ${result.detected.sku || '–'})`);
    for (const f of result.fields) lines.push(`  ${f.label}: ${f.value}`);
  } else {
    lines.push(`Rotolo non letto: ${result.message}`);
    lines.push(`  Causa: ${result.reason}`);
    lines.push(`  Dettagli: ${result.detail}`);
  }
  lines.push(`  Tentativi: ${result.attempts}`);
  if (result.bytes) lines.push(`  Byte ricevuti (${result.bytes.length}): ${toHex(result.bytes)}`);
  return lines.join('\n');
}

/**
 * Catalogo dei formati per la LabelWriter 550 e caratteristiche della testina.
 * È l'unico punto, insieme a `webusb.ts`, che importa i dati della libreria.
 */
import {
  DEVICES,
  MEDIA,
  getPrintableCanvasDots,
  type LabelWriterMedia,
  type SkuInfo,
} from '@thermal-label/labelwriter-core';
import type { HeadSpec } from '@/model/geometry';
import type { MediaFormat } from '@/model/types';
import { mmToDots } from '@/model/units';
import { EU_CODES, EU_NEW_FORMATS } from './eu-skus';

const LW_550 = DEVICES.LW_550;
const LW_550_ENGINE = LW_550.engines[0]!;

/** Testina e zona non stampabile della 550, ricavate dal registro della libreria. */
export const LW550_HEAD: HeadSpec = (() => {
  const dots = getPrintableCanvasDots(LW_550_ENGINE);
  return {
    dpi: LW_550_ENGINE.dpi,
    headDots: LW_550_ENGINE.headDots,
    leadingDots: dots.leadingDots,
    trailingDots: dots.trailingDots,
  };
})();

export const LW550_VENDOR_ID = 0x0922;
export const LW550_PRODUCT_ID = 0x0028;
export const LW550_TURBO_PRODUCT_ID = 0x0029;

/** Nomi italiani per le voci del catalogo. */
const ITALIAN_NAMES: Record<string, string> = {
  'return-address': 'Indirizzo mittente',
  'address-standard': 'Indirizzo',
  'address-large': 'Indirizzo grande',
  'shipping-standard': 'Spedizione',
  'shipping-large': 'Spedizione grande',
  'lever-arch': 'Dorso raccoglitore',
  'file-folder': 'Cartella',
  'multi-purpose-extra-small': 'Multiuso extra piccola (2 per riga)',
  'multi-purpose-square': 'Multiuso quadrata',
  'multi-purpose-small': 'Multiuso piccola',
  'multi-purpose-medium': 'Multiuso media',
  'multi-purpose-medium-removable': 'Multiuso media removibile',
  'multi-purpose-large': 'Multiuso grande',
  'multi-purpose-video-top': 'Videocassetta (lato superiore)',
  removable: 'Removibile',
  shelving: 'Scaffale',
  'appointment-card': 'Biglietto da visita / appuntamento',
  'book-spine': 'Dorso libro',
  'barcode-dymo-file': 'Codice a barre',
  'name-badge': 'Badge nominativo',
  'name-badge-non-adhesive': 'Badge non adesivo',
  'price-tag': 'Cartellino prezzo',
  'price-tag-2up': 'Cartellino prezzo (2 per riga)',
  'continuous-57': 'Rotolo continuo 57 mm non adesivo',
};

function formatMm(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function toMediaFormat(m: LabelWriterMedia): MediaFormat {
  const base = ITALIAN_NAMES[String(m.id)] ?? m.name;
  const size =
    m.heightMm !== undefined ? `${formatMm(m.widthMm)}×${formatMm(m.heightMm)} mm` : `${formatMm(m.widthMm)} mm`;
  const fmt: MediaFormat = {
    id: String(m.id),
    name: m.type === 'continuous' ? base : `${base} ${size}`,
    widthMm: m.widthMm,
  };
  if (m.heightMm !== undefined) fmt.lengthMm = m.heightMm;
  if (m.lengthDots !== undefined) fmt.lengthDots = m.lengthDots;
  if (m.cornerRadiusMm !== undefined) fmt.cornerRadiusMm = m.cornerRadiusMm;
  if (m.defaultOrientation !== undefined) fmt.defaultOrientation = m.defaultOrientation;
  if (m.skus) fmt.skus = [...m.skus];
  return fmt;
}

/** Formati della tabella DYMO Europa assenti dalla libreria. */
function newEuFormat(f: (typeof EU_NEW_FORMATS)[number]): MediaFormat {
  return {
    id: f.id,
    name: `${f.base} ${formatMm(f.widthMm)}×${formatMm(f.lengthMm)} mm`,
    widthMm: f.widthMm,
    lengthMm: f.lengthMm,
    lengthDots: mmToDots(f.lengthMm),
  };
}

/** Aggiunge i codici europei mostrati (articolo e numero breve), senza doppioni. */
function withEuCodes(fmt: MediaFormat): MediaFormat {
  const extra = EU_CODES.filter((e) => e.mediaId === fmt.id).flatMap((e) => e.shown);
  if (extra.length === 0) return fmt;
  const all = [...(fmt.skus ?? [])];
  for (const code of extra) if (!all.some((s) => normalizeSku(s) === normalizeSku(code))) all.push(code);
  return { ...fmt, skus: all };
}

/** Formati compatibili con la testina standard della 550, con i codici europei. */
export const CATALOG: readonly MediaFormat[] = [
  ...(Object.values(MEDIA) as unknown as LabelWriterMedia[])
    .filter(
      (m) =>
        (m.type === 'die-cut' || m.type === 'continuous') &&
        (m.targetModels === undefined || m.targetModels.includes('lw')),
    )
    .map(toMediaFormat),
  ...EU_NEW_FORMATS.map(newEuFormat),
].map(withEuCodes);

/** Codici delle confezioni multiple e varianti: cercabili ma non mostrati. */
const HIDDEN_CODES: ReadonlyMap<string, string> = new Map(
  EU_CODES.flatMap((e) => e.more.map((code) => [normalizeSku(code), e.mediaId] as const)),
);

/** Tutti i codici di un formato, compresi quelli non mostrati nell'elenco. */
export function allSkus(media: MediaFormat): string[] {
  const hidden = [...HIDDEN_CODES].filter(([, id]) => id === media.id).map(([code]) => code);
  return [...(media.skus ?? []), ...hidden];
}

/** Formato predefinito: multiuso piccola 25×54 mm (SKU 30336). */
export const DEFAULT_MEDIA_ID = 'multi-purpose-small';

export function defaultMedia(): MediaFormat {
  return structuredClone(CATALOG.find((m) => m.id === DEFAULT_MEDIA_ID) ?? CATALOG[0]!);
}

export function findMediaById(id: string): MediaFormat | undefined {
  return CATALOG.find((m) => m.id === id);
}

export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

export function findMediaBySku(sku: string): MediaFormat | undefined {
  const wanted = normalizeSku(sku);
  if (!wanted) return undefined;
  const byShown = CATALOG.find((m) => m.skus?.some((s) => normalizeSku(s) === wanted));
  if (byShown) return byShown;
  const id = HIDDEN_CODES.get(wanted);
  return id ? findMediaById(id) : undefined;
}

/** Formato personalizzato. `lengthMm` assente = continuo. */
export function customMedia(widthMm: number, lengthMm?: number): MediaFormat {
  const fmt: MediaFormat = {
    id: lengthMm ? `custom-${widthMm}x${lengthMm}` : `custom-${widthMm}`,
    name: lengthMm
      ? `Personalizzato ${formatMm(widthMm)}×${formatMm(lengthMm)} mm`
      : `Continuo ${formatMm(widthMm)} mm`,
    widthMm,
  };
  if (lengthMm) {
    fmt.lengthMm = lengthMm;
    fmt.lengthDots = mmToDots(lengthMm);
  }
  return fmt;
}

/**
 * Dati NFC del rotolo → formato.
 * Prima cerco lo SKU nel catalogo (che conosce la lunghezza esatta in punti);
 * altrimenti uso le misure lette dal tag.
 */
export function mediaFromSku(sku: Pick<SkuInfo, 'sku' | 'labelWidthMm' | 'labelLengthMm' | 'labelType'>): {
  media: MediaFormat;
  fromCatalog: boolean;
} | null {
  const fromCatalog = findMediaBySku(sku.sku);
  if (fromCatalog) return { media: withRollSize(structuredClone(fromCatalog), sku), fromCatalog: true };
  if (!(sku.labelWidthMm > 0)) return null;
  const continuous = sku.labelType === 'continuous' || !(sku.labelLengthMm > 0);
  const media = customMedia(sku.labelWidthMm, continuous ? undefined : sku.labelLengthMm);
  const code = sku.sku.trim();
  media.id = `nfc-${code || 'sconosciuto'}`;
  media.name = `${code ? `Rotolo ${code}` : 'Rotolo rilevato'} ${media.name.replace(/^(Personalizzato|Continuo) /, '')}`;
  if (code) media.skus = [code];
  return { media, fromCatalog: false };
}

/** Oltre questa differenza il dato del chip non è una correzione dell'arrotondamento: si tiene il catalogo. */
const ROLL_SIZE_MAX_FIX_MM = 2;

/**
 * Il catalogo arrotonda molte misure in pollici (es. 25,4 → 25 mm). Il chip del rotolo
 * dà la misura vera: con la larghezza arrotondata il contenuto usciva spostato
 * di 0,4 mm (prova del 2026-11-05). Il nome del formato non cambia.
 */
export function withRollSize(
  media: MediaFormat,
  sku: Pick<SkuInfo, 'labelWidthMm' | 'labelLengthMm'>,
): MediaFormat {
  const fix = (catalog: number | undefined, roll: number) =>
    catalog !== undefined && roll > 0 && Math.abs(roll - catalog) > 0.05 && Math.abs(roll - catalog) <= ROLL_SIZE_MAX_FIX_MM;
  if (fix(media.widthMm, sku.labelWidthMm)) media.widthMm = sku.labelWidthMm;
  if (fix(media.lengthMm, sku.labelLengthMm) && Math.abs(sku.labelLengthMm - media.lengthMm!) > 0.2) {
    media.lengthMm = sku.labelLengthMm;
    media.lengthDots = mmToDots(sku.labelLengthMm);
  }
  return media;
}

/** Confronto tra formato scelto e formato rilevato, a meno di mezzo millimetro. */
export function sameMediaSize(a: MediaFormat, b: MediaFormat): boolean {
  const near = (x?: number, y?: number) =>
    x === undefined || y === undefined ? x === y : Math.abs(x - y) <= 0.6;
  return near(a.widthMm, b.widthMm) && near(a.lengthMm, b.lengthMm);
}

/** Descrittore nel formato della libreria. */
export function toLibraryMedia(media: MediaFormat, labelLengthDots: number): LabelWriterMedia {
  const out: LabelWriterMedia = {
    id: media.id,
    name: media.name,
    widthMm: media.widthMm,
    type: media.lengthMm === undefined ? 'continuous' : 'die-cut',
    lengthDots: labelLengthDots,
  };
  if (media.lengthMm !== undefined) out.heightMm = media.lengthMm;
  return out;
}

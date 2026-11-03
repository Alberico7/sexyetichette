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

/** Formati compatibili con la testina standard della 550. */
export const CATALOG: readonly MediaFormat[] = (Object.values(MEDIA) as unknown as LabelWriterMedia[])
  .filter(
    (m) =>
      (m.type === 'die-cut' || m.type === 'continuous') &&
      (m.targetModels === undefined || m.targetModels.includes('lw')),
  )
  .map(toMediaFormat);

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
  return CATALOG.find((m) => m.skus?.some((s) => normalizeSku(s) === wanted));
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
  if (fromCatalog) return { media: structuredClone(fromCatalog), fromCatalog: true };
  if (!(sku.labelWidthMm > 0)) return null;
  const continuous = sku.labelType === 'continuous' || !(sku.labelLengthMm > 0);
  const media = customMedia(sku.labelWidthMm, continuous ? undefined : sku.labelLengthMm);
  const code = sku.sku.trim();
  media.id = `nfc-${code || 'sconosciuto'}`;
  media.name = `${code ? `Rotolo ${code}` : 'Rotolo rilevato'} ${media.name.replace(/^(Personalizzato|Continuo) /, '')}`;
  if (code) media.skus = [code];
  return { media, fromCatalog: false };
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

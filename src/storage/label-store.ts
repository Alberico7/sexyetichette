/**
 * Etichetta attuale ed etichette recenti, salvate solo su questo dispositivo (localStorage).
 * Vedi docs/2026-11-03-etichetta-salvata-recenti-ristampa.md.
 */
import { DOCUMENT_FORMAT, DOCUMENT_VERSION, type LabelDocument, type TextElement } from '@/model/types';
import { isMedia } from '@/settings';

export const CURRENT_LABEL_KEY = 'etichettatrice.etichetta';
export const RECENT_KEY = 'etichettatrice.recenti';
export const MAX_RECENT = 20;

export interface RecentLabel {
  id: string;
  /** Data dell'ultima stampa (ISO). */
  printedAt: string;
  /** Miniatura in bianco e nero (data URL PNG); vuota se non disponibile. */
  thumbnail: string;
  doc: LabelDocument;
}

/** Accesso minimo allo storage, sostituibile nei test. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStorage(): KeyValueStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';

function parseText(v: unknown): TextElement | null {
  if (typeof v !== 'object' || v === null) return null;
  const e = v as Record<string, unknown>;
  if (e.type !== 'text' || !isStr(e.id) || !isStr(e.text) || !isStr(e.fontFamily)) return null;
  if (![e.x, e.y, e.width, e.height, e.rotation, e.fontSizePt].every(isNum)) return null;
  if ((e.width as number) <= 0 || (e.height as number) <= 0 || (e.fontSizePt as number) <= 0) return null;
  if (![e.bold, e.italic, e.invert].every(isBool)) return null;
  if (!['left', 'center', 'right'].includes(e.align as string)) return null;
  if (!['top', 'middle', 'bottom'].includes(e.verticalAlign as string)) return null;
  if (e.autoFit !== undefined && !isBool(e.autoFit)) return null;
  const el: TextElement = {
    id: e.id,
    type: 'text',
    x: e.x as number,
    y: e.y as number,
    width: e.width as number,
    height: e.height as number,
    rotation: e.rotation as number,
    text: e.text,
    fontFamily: e.fontFamily,
    fontSizePt: e.fontSizePt as number,
    bold: e.bold as boolean,
    italic: e.italic as boolean,
    align: e.align as TextElement['align'],
    verticalAlign: e.verticalAlign as TextElement['verticalAlign'],
    invert: e.invert as boolean,
  };
  if (e.autoFit !== undefined) el.autoFit = e.autoFit as boolean;
  return el;
}

/**
 * Controlla un documento letto dallo storage. Dati non validi o di una versione
 * sconosciuta → `null`. Gli elementi non validi e i testi vuoti vengono scartati.
 */
export function parseDocument(v: unknown): LabelDocument | null {
  if (typeof v !== 'object' || v === null) return null;
  const d = v as Record<string, unknown>;
  if (d.format !== DOCUMENT_FORMAT || d.version !== DOCUMENT_VERSION) return null;
  if (!isStr(d.id) || !isStr(d.name) || !isMedia(d.media)) return null;
  if (d.direction !== 'along' && d.direction !== 'across') return null;
  if (!isNum(d.continuousLengthMm) || d.continuousLengthMm <= 0) return null;
  if (!Array.isArray(d.elements)) return null;
  const elements = d.elements.map(parseText).filter((e): e is TextElement => e !== null && e.text.trim() !== '');
  const now = new Date().toISOString();
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    id: d.id,
    name: d.name,
    media: structuredClone(d.media),
    direction: d.direction,
    continuousLengthMm: d.continuousLengthMm,
    elements,
    created: isStr(d.created) ? d.created : now,
    modified: isStr(d.modified) ? d.modified : now,
  };
}

function readJson(key: string, storage: KeyValueStorage | null): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function loadCurrentLabel(storage = defaultStorage()): LabelDocument | null {
  return parseDocument(readJson(CURRENT_LABEL_KEY, storage));
}

/** Salva l'etichetta attuale; restituisce `false` se lo storage non è disponibile o è pieno. */
export function saveCurrentLabel(doc: LabelDocument, storage = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(CURRENT_LABEL_KEY, JSON.stringify(doc));
    return true;
  } catch {
    return false;
  }
}

export function parseRecents(v: unknown): RecentLabel[] {
  if (!Array.isArray(v)) return [];
  const out: RecentLabel[] = [];
  for (const item of v) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    const doc = parseDocument(r.doc);
    if (!doc || !isStr(r.id) || !isStr(r.printedAt)) continue;
    const thumbnail = isStr(r.thumbnail) && r.thumbnail.startsWith('data:image/png') ? r.thumbnail : '';
    out.push({ id: r.id, printedAt: r.printedAt, thumbnail, doc });
  }
  return out.slice(0, MAX_RECENT);
}

export function loadRecents(storage = defaultStorage()): RecentLabel[] {
  return parseRecents(readJson(RECENT_KEY, storage));
}

/**
 * Salva le recenti. Se lo spazio non basta toglie le più vecchie e riprova.
 * Restituisce l'elenco effettivamente salvato (vuoto se non è stato possibile).
 */
export function saveRecents(list: readonly RecentLabel[], storage = defaultStorage()): RecentLabel[] {
  if (!storage) return [];
  let items = list.slice(0, MAX_RECENT);
  for (;;) {
    try {
      if (items.length === 0) storage.removeItem(RECENT_KEY);
      else storage.setItem(RECENT_KEY, JSON.stringify(items));
      return items;
    } catch {
      if (items.length === 0) return [];
      items = items.slice(0, -1);
    }
  }
}

/**
 * Impronta del contenuto: due etichette con la stessa impronta stampano lo stesso.
 * Esclude id, nomi e date.
 */
export function labelSignature(doc: LabelDocument): string {
  return JSON.stringify({
    w: doc.media.widthMm,
    l: doc.media.lengthMm ?? null,
    ld: doc.media.lengthDots ?? null,
    c: doc.media.lengthMm === undefined ? doc.continuousLengthMm : null,
    dir: doc.direction,
    el: doc.elements.map((e) => [
      e.type,
      e.x,
      e.y,
      e.width,
      e.height,
      e.rotation,
      e.text,
      e.fontFamily,
      e.fontSizePt,
      e.bold,
      e.italic,
      e.align,
      e.verticalAlign,
      e.invert,
      e.autoFit ?? false,
    ]),
  });
}

/** Mette in cima l'etichetta appena stampata; un'etichetta identica già presente viene spostata. */
export function addRecent(list: readonly RecentLabel[], entry: RecentLabel): RecentLabel[] {
  const sig = labelSignature(entry.doc);
  return [entry, ...list.filter((r) => labelSignature(r.doc) !== sig)].slice(0, MAX_RECENT);
}

/** Testi dell'etichetta su una riga, per l'elenco. */
export function recentSummary(doc: LabelDocument, max = 60): string {
  const text = doc.elements
    .map((e) => e.text.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' · ');
  if (!text) return '(etichetta vuota)';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const MONTHS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

/** «oggi 14:32», «ieri 09:05», «28 ott», «28 ott 2025». */
export function formatWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff === 0) return `oggi ${hm}`;
  if (diff === 1) return `ieri ${hm}`;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

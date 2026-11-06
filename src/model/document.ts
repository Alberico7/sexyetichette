import { defaultDirection } from './geometry';
import {
  DOCUMENT_FORMAT,
  DOCUMENT_VERSION,
  type LabelDocument,
  type LabelElement,
  type MediaFormat,
  type TextElement,
} from './types';
import { DEFAULT_FONT } from './fonts';
import { dotsToMm } from './units';

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_CONTINUOUS_LENGTH_MM = 50;

export function createDocument(media: MediaFormat, name = 'Nuova etichetta'): LabelDocument {
  const now = new Date().toISOString();
  return {
    format: DOCUMENT_FORMAT,
    version: DOCUMENT_VERSION,
    id: newId(),
    name,
    media: { ...media },
    direction: defaultDirection(media),
    continuousLengthMm: DEFAULT_CONTINUOUS_LENGTH_MM,
    elements: [],
    created: now,
    modified: now,
  };
}

/** Area utile in mm (verso di lettura), usata per posizionare i nuovi elementi. */
export interface AreaMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function areaFromDots(rect: { x: number; y: number; width: number; height: number }): AreaMm {
  return {
    x: dotsToMm(rect.x),
    y: dotsToMm(rect.y),
    width: dotsToMm(rect.width),
    height: dotsToMm(rect.height),
  };
}

export function createTextElement(area: AreaMm, text = 'Testo'): TextElement {
  const margin = Math.min(2, area.width / 10, area.height / 10);
  return {
    id: newId(),
    type: 'text',
    x: area.x + margin,
    y: area.y + margin,
    width: Math.max(5, area.width - margin * 2),
    height: Math.max(3, area.height - margin * 2),
    rotation: 0,
    text,
    fontFamily: DEFAULT_FONT,
    fontSizePt: 14,
    bold: false,
    italic: false,
    underline: false,
    align: 'center',
    verticalAlign: 'middle',
    invert: false,
    autoFit: true,
  };
}

export function cloneElement<T extends LabelElement>(el: T): T {
  return structuredClone(el);
}

export function touch(doc: LabelDocument): void {
  doc.modified = new Date().toISOString();
}

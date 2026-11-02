/**
 * Impostazioni ricordate sul dispositivo: densità, ultimo formato e verso del contenuto.
 * Le copie non vengono salvate (tornano a 1 dopo ogni stampa, per evitare stampe multiple per errore).
 */
import type { ContentDirection, MediaFormat } from '@/model/types';
import type { Density } from '@/printer/types';

export const SETTINGS_STORAGE_KEY = 'etichettatrice.impostazioni';

export interface SavedSettings {
  density?: Density;
  media?: MediaFormat;
  direction?: ContentDirection;
}

const DENSITIES: Density[] = ['light', 'medium', 'normal', 'high'];

function isMedia(v: unknown): v is MediaFormat {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as MediaFormat;
  return (
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    typeof m.widthMm === 'number' &&
    m.widthMm > 0 &&
    (m.lengthMm === undefined || (typeof m.lengthMm === 'number' && m.lengthMm > 0))
  );
}

/** Legge e valida le impostazioni; valori non validi vengono ignorati. */
export function parseSettings(raw: string | null): SavedSettings {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const out: SavedSettings = {};
    if (DENSITIES.includes(data.density as Density)) out.density = data.density as Density;
    if (isMedia(data.media)) out.media = data.media;
    if (data.direction === 'along' || data.direction === 'across') out.direction = data.direction;
    return out;
  } catch {
    return {};
  }
}

export function loadSettings(): SavedSettings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
  } catch {
    return {};
  }
}

export function saveSettings(patch: SavedSettings): void {
  try {
    const next = { ...loadSettings(), ...patch };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // archiviazione non disponibile: le impostazioni valgono solo per questa sessione
  }
}

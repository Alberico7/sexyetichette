/**
 * Simbolo del diametro ISO (⌀) proporzionato al testo.
 *
 * Il mini-font `diametro.otf` contiene solo ⌀, disegnato secondo la ISO 3098 per
 * un'altezza delle maiuscole di 0,716 em. Per ogni carattere usato dall'app
 * registro una variante con `size-adjust`, così ⌀ è alto esattamente quanto le
 * maiuscole di quel carattere sul dispositivo. Grazie a `unicode-range` il
 * browser usa queste varianti solo per ⌀: le altre lettere restano del carattere scelto.
 */
import fontUrl from '@/assets/fonts/diametro.otf?url';

/** Altezza delle maiuscole per cui è disegnato il glifo (vedi scripts/make-diameter-font.mjs). */
export const DESIGN_CAP_HEIGHT_EM = 0.716;
const FACE_PREFIX = 'Etichettatrice Diametro';
/** ⌀, ∅ (⌀ a 45°, docs/2026-11-09-diametro-45.md) e il cuore ♥ (docs/2026-11-08-cuore-nascosto.md). */
const UNICODE_RANGE = 'U+2205, U+2300, U+2665';

let fontData: Promise<ArrayBuffer> | null = null;
/** Carattere → nome della variante registrata (solo quando è pronta). */
const ready = new Map<string, string>();
const pending = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function faceName(family: string): string {
  return `${FACE_PREFIX} ${family.replace(/[^a-z0-9-]/gi, '_')}`;
}

/** Elenco di caratteri da usare nel disegno: la variante di ⌀ (se pronta) e poi il carattere scelto. */
export function fontStack(family: string): string {
  const face = ready.get(family);
  return face ? `"${face}", ${family}` : family;
}

/** Altezza delle maiuscole del carattere, in em, misurata sulla «H». */
export function measureCapHeightEm(family: string): number {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return DESIGN_CAP_HEIGHT_EM;
  const size = 200;
  ctx.font = `${size}px ${family}`;
  const m = ctx.measureText('H');
  const h = m.actualBoundingBoxAscent;
  return h > 0 ? h / size : DESIGN_CAP_HEIGHT_EM;
}

/** Registra (una volta) la variante di ⌀ per il carattere indicato. */
export function ensureDiameterFont(family: string): Promise<void> {
  if (ready.has(family)) return Promise.resolve();
  const existing = pending.get(family);
  if (existing) return existing;
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return Promise.resolve();
  const task = (async () => {
    fontData ??= fetch(fontUrl).then((r) => {
      if (!r.ok) throw new Error(`Font del diametro non trovato (${r.status})`);
      return r.arrayBuffer();
    });
    const data = await fontData;
    // Il carattere scelto deve essere caricato prima di misurarlo.
    await document.fonts.load(`200px ${family}`, 'H').catch(() => []);
    const ratio = measureCapHeightEm(family) / DESIGN_CAP_HEIGHT_EM;
    // `sizeAdjust` è supportato da Chromium ma non ancora dai tipi di TypeScript.
    const descriptors = {
      unicodeRange: UNICODE_RANGE,
      sizeAdjust: `${(ratio * 100).toFixed(2)}%`,
    } as FontFaceDescriptors;
    const face = new FontFace(faceName(family), data, descriptors);
    await face.load();
    document.fonts.add(face);
    ready.set(family, face.family);
    for (const cb of listeners) cb();
  })()
    .catch(() => {
      // Senza il mini-font ⌀ viene comunque disegnato con il font di sistema.
    })
    .finally(() => pending.delete(family));
  pending.set(family, task);
  return task;
}

/** Notifica quando una nuova variante è pronta (l'editor si ridisegna). */
export function onDiameterFontReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

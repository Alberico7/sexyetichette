/**
 * Caratteri disponibili per i testi. Il valore è un elenco CSS di font
 * (salvato nell'etichetta così com'è).
 */

/**
 * Carattere tecnico ISO 3098 (osifont, LGPL 3 con font exception), dichiarato
 * in render/web-fonts.ts. Il browser lo scarica solo quando serve.
 * Vedi docs/2026-11-04-carattere-tecnico-iso-3098.md.
 */
export const ISO_FONT_FACE = 'Etichettatrice ISO 3098';
export const ISO_FONT = `"${ISO_FONT_FACE}", sans-serif`;

/**
 * Noto Sans (SIL OFL 1.1), il più simile a Segoe UI nelle cifre in grassetto,
 * dichiarato in render/web-fonts.ts. Vedi docs/2026-11-09-carattere-noto-sans.md.
 */
export const NOTO_SANS_FACE = 'Etichettatrice Noto Sans';
export const NOTO_SANS = `"${NOTO_SANS_FACE}", sans-serif`;

/** Carattere dei nuovi testi. */
export const DEFAULT_FONT = ISO_FONT;

export const FONT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: ISO_FONT, label: 'Tecnico ISO 3098' },
  { value: NOTO_SANS, label: 'Noto Sans (simile a Segoe UI)' },
  { value: 'sans-serif', label: 'Senza grazie' },
  { value: 'serif', label: 'Con grazie' },
  { value: 'monospace', label: 'Monospaziato' },
  { value: 'system-ui', label: 'Di sistema' },
];

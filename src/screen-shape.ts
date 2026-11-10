/**
 * Orientamento del telefono, dalla forma dello schermo e non dello spazio visibile.
 *
 * Con la tastiera aperta, su un telefono piccolo in verticale, lo spazio visibile
 * diventa più largo che alto (per esempio 360×300) e la media query CSS
 * `orientation: landscape` lo scambierebbe per orizzontale. `screen.width` e
 * `screen.height` invece seguono solo la rotazione del telefono.
 *
 * Imposta `data-screen="landscape" | "portrait"` su <html>: i CSS dell'orizzontale
 * lo usano insieme a `max-height`. Vedi docs/2026-11-08-orizzontale-tastiera.md.
 */
export type ScreenShape = 'landscape' | 'portrait';

export function screenShape(s: Pick<Screen, 'width' | 'height'> = screen): ScreenShape {
  return s.width > s.height ? 'landscape' : 'portrait';
}

export function trackScreenShape(root: HTMLElement = document.documentElement): void {
  const update = () => {
    root.dataset.screen = screenShape();
  };
  update();
  window.addEventListener('resize', update);
  screen.orientation?.addEventListener('change', update);
}

/** Orizzontale con la tastiera aperta (spazio visibile alto al massimo 260 punti): la disposizione compatta. */
export function keyboardCompact(): boolean {
  return screenShape() === 'landscape' && window.matchMedia('(max-height: 260px)').matches;
}

/**
 * Telefono in orizzontale (spazio visibile alto al massimo 600 punti, come nei CSS
 * dell'orizzontale): un testo nuovo non apre subito la tastiera.
 */
export function landscapePhone(): boolean {
  return screenShape() === 'landscape' && window.matchMedia('(max-height: 600px)').matches;
}

/** Riga per il registro della diagnostica: spazio visibile, schermo ed elemento attivo. */
export function viewportInfo(): string {
  const a = document.activeElement;
  const active = a && a !== document.body ? a.tagName.toLowerCase() : 'nessuno';
  return `spazio ${window.innerWidth}×${window.innerHeight}, schermo ${screen.width}×${screen.height} (${screenShape()}), elemento attivo: ${active}`;
}

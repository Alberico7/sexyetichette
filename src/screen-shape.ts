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

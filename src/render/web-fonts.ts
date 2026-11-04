/**
 * Caricamento su richiesta dei font scaricabili (es. «Tecnico ISO 3098»).
 * Il canvas non avvia da solo il caricamento di un @font-face: lo chiedo io al
 * primo uso, e chi disegna viene avvisato quando il font è pronto.
 * La stampa invece aspetta sempre i font con waitForFonts (scene.ts).
 */
import isoFontUrl from '@/assets/fonts/osifont-lgpl3fe.woff?url';
import { ISO_FONT_FACE } from '@/model/fonts';

/**
 * Registra «Tecnico ISO 3098» (osifont, LGPL 3 con font exception, vedi
 * public/licenses/osifont). Il file viene scaricato solo al primo uso.
 */
function registerIsoFont(): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !('fonts' in document)) return;
  document.fonts.add(new FontFace(ISO_FONT_FACE, `url(${JSON.stringify(isoFontUrl)}) format('woff')`, { display: 'swap' }));
}
registerIsoFont();

const requested = new Set<string>();
const listeners = new Set<() => void>();

/** Chiede il caricamento del font, se serve; `style` come in CSS («bold», «italic»…). */
export function requestFont(family: string, style = 'normal'): void {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  const spec = `${style === 'normal' ? '' : `${style} `}20px ${family}`;
  if (requested.has(spec)) return;
  requested.add(spec);
  let loaded: boolean;
  try {
    loaded = document.fonts.check(spec);
  } catch {
    return;
  }
  if (loaded) return;
  document.fonts
    .load(spec)
    .then((faces) => {
      if (faces.length > 0) for (const cb of listeners) cb();
    })
    .catch(() => {
      // Il font non è disponibile: resta il carattere di riserva dell'elenco.
      requested.delete(spec);
    });
}

/** Notifica quando un font chiesto con requestFont è pronto. */
export function onWebFontReady(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

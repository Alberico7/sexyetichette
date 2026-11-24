/**
 * Dove resta il modello di Vosk nel telefono (Cache Storage). Modulo leggero:
 * l'app lo usa per sapere se il modello c'è già, senza caricare Vosk.
 * Vedi docs/2026-11-10-dettatura.md.
 */

/** Nome nato con la pagina di prova (tolta), tenuto: cambiarlo farebbe riscaricare il modello (50 MB). */
export const VOICE_CACHE_NAME = 'etichettatrice-prova-voce';
/** Nome del file del modello convertito: chiave in Cache Storage e indirizzo fisso per Vosk. */
export const VOICE_MODEL_FILE = 'vosk-model-small-it-0.22.tar.gz';
export const VOICE_MODEL_KEY = `./${VOICE_MODEL_FILE}`;

/**
 * Indirizzo fisso del modello, accanto alla pagina. Il file non esiste sul server: lo serve
 * il service worker dalla cache della dettatura (vite.config.ts). Sempre lo stesso, così
 * vosk-browser ritrova la copia già estratta. Vedi docs/2026-11-24-vosk-copie-del-modello.md.
 */
export function voiceModelUrl(base: string = location.href): string {
  return new URL(VOICE_MODEL_KEY, base).href;
}

export async function openVoiceCache(): Promise<Cache | null> {
  try {
    return await caches.open(VOICE_CACHE_NAME);
  } catch {
    return null; // senza Cache Storage si riscarica ogni volta
  }
}

/** `true` se il modello è già stato scaricato e convertito. */
export async function isVoiceModelDownloaded(): Promise<boolean> {
  try {
    return !!(await (await openVoiceCache())?.match(VOICE_MODEL_KEY));
  } catch {
    return false;
  }
}

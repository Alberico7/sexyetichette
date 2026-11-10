/**
 * Dove resta il modello di Vosk nel telefono (Cache Storage). Modulo leggero:
 * l'app lo usa per sapere se il modello c'è già, senza caricare Vosk.
 * Vedi docs/2026-11-10-dettatura.md.
 */

/** Nome della pagina di prova, tenuto: il modello scaricato lì vale anche per l'app. */
export const VOICE_CACHE_NAME = 'etichettatrice-prova-voce';
export const VOICE_MODEL_KEY = './vosk-model-small-it-0.22.tar.gz';

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

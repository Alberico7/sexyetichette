/**
 * Riconoscimento vocale per la dettatura: interfaccia comune al motore vero (Vosk)
 * e a quello simulato dei test. Vedi docs/2026-11-10-dettatura.md.
 */
import { simHooks, simRequested } from '@/sim';
import { isVoiceModelDownloaded } from './model-cache';

export type VoiceProgress = (text: string, fraction?: number) => void;

export interface VoiceResult {
  /** Parole riconosciute, come le scrive il motore (minuscole, numeri in lettere). */
  text: string;
  /** Durata della frase registrata. */
  audioMs: number;
  /** Dal rilascio del pulsante al testo finito. */
  ms: number;
}

export interface VoiceEngine {
  /** Scarica (se serve) e prepara il modello. Più chiamate condividono lo stesso lavoro. */
  prepare(onProgress?: VoiceProgress): Promise<void>;
  /** Apre il microfono (la prima volta chiede il permesso) e inizia ad ascoltare. */
  start(onPartial: (text: string) => void): Promise<void>;
  /** Smette di ascoltare e restituisce la frase. */
  stop(): Promise<VoiceResult>;
  /** Chiude il microfono (l'indicatore del telefono si spegne). */
  closeMic(): void;
}

let enginePromise: Promise<VoiceEngine> | null = null;

/**
 * Il modello è già nel telefono? Controllo leggero, senza caricare il motore:
 * aprendo la casella del testo non si scarica niente se la dettatura non è mai stata usata.
 */
export function voiceModelDownloaded(): Promise<boolean> {
  if ((import.meta.env.DEV || import.meta.env.MODE === 'test') && simRequested()) {
    return Promise.resolve(!!simHooks().voice?.downloaded);
  }
  return isVoiceModelDownloaded();
}

/**
 * Il motore della dettatura, uno solo per tutta l'app (il modello resta caricato).
 * In sviluppo, con `?sim`, quello simulato: in produzione Vite elimina il ramo.
 */
export function voiceEngine(): Promise<VoiceEngine> {
  enginePromise ??= (async () => {
    if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
      if (simRequested()) {
        const { SimulatedVoice } = await import('./simulated');
        return new SimulatedVoice();
      }
    }
    const { VoskVoice } = await import('./vosk-engine');
    return new VoskVoice();
  })();
  return enginePromise;
}

/**
 * Da dove prende il modello vosk-browser, senza accumulare copie nell'archivio.
 * Vedi docs/2026-11-24-vosk-copie-del-modello.md.
 *
 * - Copia già estratta nella cartella fissa → indirizzo fisso: niente cache, niente estrazione.
 * - Altrimenti, con il service worker che controlla la pagina → modello in cache, poi
 *   indirizzo fisso: il service worker lo serve al worker di Vosk dalla cache.
 * - Altrimenti, o se l'indirizzo fisso non va → riserva con un indirizzo blob:, poi si
 *   toglie la copia blob dall'archivio.
 */
import type { VoiceProgress } from './engine';
import { voskFolder, type PruneResult } from './vosk-archive';

export type ModelPath = 'estratto' | 'cache' | 'riserva';

/** Il modello di vosk-browser, per quello che serve qui. */
export interface VoskModelLike {
  on(event: 'load' | 'error', listener: (message: { result?: boolean; error?: string }) => void): void;
  terminate(): void;
}

/**
 * Tempo massimo per aprire il modello: largo, perché su Vanadium senza JIT la
 * preparazione può durare più di un minuto (docs/2026-11-24-vosk-copie-del-modello.md).
 */
export const OPEN_TIMEOUT_MS = 180_000;

/**
 * Aspetta che il modello sia pronto. A differenza di `createModel` di vosk-browser,
 * ascolta anche `error` e ha un tempo massimo: senza, un worker che non risponde
 * lascerebbe la preparazione appesa per sempre. In caso di errore il worker si chiude.
 */
export function openVoskModel<M extends VoskModelLike>(model: M, timeoutMs = OPEN_TIMEOUT_MS): Promise<M> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(
      () =>
        fail(
          `il riconoscimento non si è preparato in ${Math.round(timeoutMs / 1000)} s. ` +
            'Su Vanadium attiva «JavaScript JIT» per questo sito.',
        ),
      timeoutMs,
    );
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      model.terminate();
      reject(new Error(reason));
    };
    model.on('load', (m) => {
      if (settled) return;
      if (m.result) {
        settled = true;
        clearTimeout(timer);
        resolve(model);
      } else fail('il modello non si è caricato');
    });
    model.on('error', (m) => fail(`errore del riconoscimento: ${m.error ?? 'sconosciuto'}`));
  });
}

export interface ModelSourceDeps<M> {
  /** Indirizzo fisso del modello (la chiave in Cache Storage). */
  fixedUrl: string;
  prune(keep: string): Promise<PruneResult>;
  serviceWorkerControls(): boolean;
  /** Assicura il modello in cache; se non si può conservare, restituisce il file. */
  ensureInCache(onProgress: VoiceProgress): Promise<{ inCache: boolean; blob?: Blob }>;
  /** Il modello come file, per la strada di riserva. */
  modelBlob(onProgress: VoiceProgress): Promise<Blob>;
  open(url: string): Promise<M>;
  log(text: string): void;
}

const PREPARING = 'Preparazione del riconoscimento…';
const why = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function openVoskModelSource<M>(
  deps: ModelSourceDeps<M>,
  onProgress: VoiceProgress,
): Promise<{ model: M; path: ModelPath }> {
  const folder = voskFolder(deps.fixedUrl);
  const before = await deps.prune(folder);
  if (before.removed) deps.log(`Dettatura: tolte ${before.removed} voci di copie vecchie del modello`);

  let spare: Blob | undefined;
  if (before.extracted) {
    try {
      onProgress(PREPARING);
      const model = await deps.open(deps.fixedUrl);
      deps.log('Dettatura: modello dalla copia già estratta');
      return { model, path: 'estratto' };
    } catch (e) {
      deps.log(`Dettatura: copia estratta non utilizzabile (${why(e)}), strada di riserva`);
    }
  } else if (deps.serviceWorkerControls()) {
    const cached = await deps.ensureInCache(onProgress);
    if (cached.inCache) {
      try {
        onProgress(PREPARING);
        const model = await deps.open(deps.fixedUrl);
        deps.log('Dettatura: modello dalla cache, tramite il service worker');
        return { model, path: 'cache' };
      } catch (e) {
        deps.log(`Dettatura: indirizzo fisso non riuscito (${why(e)}), strada di riserva`);
      }
    } else spare = cached.blob;
  }

  const blob = spare ?? (await deps.modelBlob(onProgress));
  const url = URL.createObjectURL(blob);
  try {
    onProgress(PREPARING);
    const model = await deps.open(url);
    const after = await deps.prune(folder);
    deps.log(`Dettatura: modello dalla strada di riserva (blob:), copia temporanea tolta (${after.removed} voci)`);
    return { model, path: 'riserva' };
  } finally {
    URL.revokeObjectURL(url);
  }
}

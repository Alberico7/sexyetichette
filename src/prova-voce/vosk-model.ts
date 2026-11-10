/**
 * Modello italiano di Vosk 0.22 per la prova della dettatura.
 *
 * Il sito ufficiale non permette di scaricarlo da un'altra pagina (manca CORS). Si usa
 * la copia su Hugging Face, identica all'ufficiale: la pagina ne controlla l'impronta.
 * È uno zip, mentre vosk-browser vuole un .tar.gz: si converte nel telefono e si
 * conserva nel browser, così le volte successive non si riscarica.
 * Vedi docs/2026-11-10-prova-dettatura.md.
 */
import { gzip, unzip } from 'fflate';
import { createTar, entriesFromFiles, sha256Hex } from './tar';

/** Revisione fissa: il file non può cambiare sotto i piedi. */
export const VOSK_ZIP_URL =
  'https://huggingface.co/ambind/vosk-model-small-it-0.22/resolve/a1e27778d4c7f7da6162c6d84685921462a59f7f/vosk-model-small-it-0.22.zip';
/** Impronta dello zip ufficiale (alphacephei.com), verificata il 2026-11-10. */
export const VOSK_ZIP_SHA256 = '9ec65e75861d1c6c2e457cccd932705340dcdf233f5b239f00733b4de0bf3267';
export const VOSK_ZIP_BYTES = 49_665_141;

const CACHE_NAME = 'etichettatrice-prova-voce';
const CACHE_KEY = './vosk-model-small-it-0.22.tar.gz';

export interface VoskModelFile {
  /** Indirizzo (blob:) da passare a vosk-browser. */
  url: string;
  /** Byte scaricati da Internet (0 se il modello era già nel browser). */
  downloadedBytes: number;
}

type Progress = (text: string, fraction?: number) => void;

async function download(onProgress: Progress): Promise<Uint8Array> {
  const res = await fetch(VOSK_ZIP_URL);
  if (!res.ok || !res.body) throw new Error(`scaricamento non riuscito (${res.status})`);
  const total = Number(res.headers.get('content-length')) || VOSK_ZIP_BYTES;
  const out = new Uint8Array(total);
  const reader = res.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (loaded + value.length > out.length) throw new Error('il file è più grande del previsto');
    out.set(value, loaded);
    loaded += value.length;
    onProgress(
      `Scaricamento: ${(loaded / 1e6).toFixed(1).replace('.', ',')} di ${(total / 1e6).toFixed(1).replace('.', ',')} MB`,
      loaded / total,
    );
  }
  return out.subarray(0, loaded);
}

const unzipAsync = (data: Uint8Array) =>
  new Promise<Record<string, Uint8Array>>((res, rej) => unzip(data, (err, files) => (err ? rej(err) : res(files))));

const gzipAsync = (data: Uint8Array) =>
  new Promise<Uint8Array>((res, rej) => gzip(data, { level: 1 }, (err, out) => (err ? rej(err) : res(out))));

async function openCache(): Promise<Cache | null> {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null; // senza Cache Storage si riscarica ogni volta
  }
}

export async function loadVoskModelFile(onProgress: Progress): Promise<VoskModelFile> {
  const cache = await openCache();
  const cached = await cache?.match(CACHE_KEY);
  if (cached) {
    onProgress('Modello già nel browser, caricamento…');
    return { url: URL.createObjectURL(await cached.blob()), downloadedBytes: 0 };
  }
  const zip = await download(onProgress);
  onProgress('Controllo dell’impronta…');
  const hash = await sha256Hex(zip);
  if (hash !== VOSK_ZIP_SHA256) throw new Error('il file scaricato non è quello ufficiale (impronta diversa)');
  onProgress('Conversione del modello…');
  const tar = createTar(entriesFromFiles(await unzipAsync(zip)));
  const blob = new Blob([(await gzipAsync(tar)) as Uint8Array<ArrayBuffer>], { type: 'application/gzip' });
  try {
    await cache?.put(CACHE_KEY, new Response(blob));
  } catch {
    // spazio esaurito o cache non disponibile: si va avanti senza conservarlo
  }
  return { url: URL.createObjectURL(blob), downloadedBytes: zip.length };
}

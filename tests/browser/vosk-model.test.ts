/**
 * Scaricamento, controllo e conservazione del modello di Vosk, senza Internet:
 * `fetch`, l'impronta e la cache sono simulati. Vedi docs/2026-11-10-manutenibilita.md (punto 4).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8, gunzipSync } from 'fflate';
import { VOICE_CACHE_NAME, VOICE_MODEL_KEY } from '@/voice/model-cache';
import { VOSK_ZIP_SHA256, loadVoskModelFile } from '@/voice/vosk-model';

/** Un piccolo zip con la stessa forma del modello vero. */
const ZIP = zipSync({
  'vosk-model-small-it-0.22/README': strToU8('modello di prova'),
  'vosk-model-small-it-0.22/am/final.mdl': new Uint8Array(1300).fill(7),
});

function serveZip(bytes: Uint8Array = ZIP) {
  return vi
    .spyOn(window, 'fetch')
    .mockImplementation(() =>
      Promise.resolve(
        new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { 'content-length': String(bytes.length) } }),
      ),
    );
}

/** L'impronta calcolata dal browser risulta quella ufficiale. */
function officialHash() {
  const bytes = new Uint8Array(VOSK_ZIP_SHA256.match(/../g)!.map((h) => parseInt(h, 16)));
  return vi.spyOn(crypto.subtle, 'digest').mockResolvedValue(bytes.buffer);
}

const cached = async () => !!(await (await caches.open(VOICE_CACHE_NAME)).match(VOICE_MODEL_KEY));

beforeEach(() => caches.delete(VOICE_CACHE_NAME));
afterEach(async () => {
  vi.restoreAllMocks();
  await caches.delete(VOICE_CACHE_NAME);
});

describe('modello di Vosk', () => {
  it('impronta diversa: errore, e il file non viene conservato', async () => {
    serveZip();
    await expect(loadVoskModelFile(() => {})).rejects.toThrow('impronta diversa');
    expect(await cached()).toBe(false);
  });

  it('impronta giusta: converte in tar.gz, conserva e riporta i byte scaricati', async () => {
    const fetchSpy = serveZip();
    officialHash();
    const progress: string[] = [];
    const file = await loadVoskModelFile((t) => progress.push(t));
    expect(file.downloadedBytes).toBe(ZIP.length);
    expect(file.url.startsWith('blob:')).toBe(true);
    expect(progress.some((p) => p.startsWith('Scaricamento'))).toBe(true);
    expect(progress).toContain('Conversione del modello…');
    expect(await cached()).toBe(true);
    // Il file conservato è un tar compresso con dentro il modello (con il fetch vero).
    fetchSpy.mockRestore();
    const tar = gunzipSync(new Uint8Array(await (await fetch(file.url)).arrayBuffer()));
    expect(new TextDecoder().decode(tar.subarray(0, 100))).toContain('vosk-model-small-it-0.22/');
  });

  it('modello già nel telefono: nessuno scaricamento', async () => {
    await (await caches.open(VOICE_CACHE_NAME)).put(VOICE_MODEL_KEY, new Response(new Blob(['tar'])));
    const fetchSpy = vi.spyOn(window, 'fetch');
    const file = await loadVoskModelFile(() => {});
    expect(file.downloadedBytes).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('se non si può conservare (spazio esaurito) si va avanti lo stesso', async () => {
    serveZip();
    officialHash();
    vi.spyOn(Cache.prototype, 'put').mockRejectedValue(new DOMException('pieno', 'QuotaExceededError'));
    const file = await loadVoskModelFile(() => {});
    expect(file.downloadedBytes).toBe(ZIP.length);
    expect(file.url.startsWith('blob:')).toBe(true);
  });

  it('scaricamento non riuscito: errore con il codice', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(new Response('no', { status: 503 }));
    await expect(loadVoskModelFile(() => {})).rejects.toThrow('503');
  });
});

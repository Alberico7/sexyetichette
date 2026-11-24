/**
 * Apertura del modello (anche con «error») e scelta della strada: copia estratta,
 * cache tramite service worker, riserva blob:. Con funzioni finte.
 * Vedi docs/2026-11-24-vosk-copie-del-modello.md.
 */
import { describe, expect, it, vi } from 'vitest';
import { voskFolder } from '@/voice/vosk-archive';
import { openVoskModel, openVoskModelSource, type ModelSourceDeps, type VoskModelLike } from '@/voice/vosk-source';

type Listener = (m: { result?: boolean; error?: string }) => void;

class FakeModel implements VoskModelLike {
  listeners: Record<string, Listener[]> = {};
  terminate = vi.fn();
  on(event: 'load' | 'error', l: Listener) {
    (this.listeners[event] ??= []).push(l);
  }
  emit(event: 'load' | 'error', m: { result?: boolean; error?: string }) {
    for (const l of this.listeners[event] ?? []) l(m);
  }
}

describe('apertura del modello', () => {
  it('«load» con esito positivo → pronto', async () => {
    const m = new FakeModel();
    const p = openVoskModel(m);
    m.emit('load', { result: true });
    await expect(p).resolves.toBe(m);
    expect(m.terminate).not.toHaveBeenCalled();
  });

  it('«load» con esito negativo → errore e worker chiuso', async () => {
    const m = new FakeModel();
    const p = openVoskModel(m);
    m.emit('load', { result: false });
    await expect(p).rejects.toThrow('non si è caricato');
    expect(m.terminate).toHaveBeenCalledTimes(1);
  });

  it('«error» dal worker → errore invece di restare appesa', async () => {
    const m = new FakeModel();
    const p = openVoskModel(m);
    m.emit('error', { error: 'Failed to fetch' });
    await expect(p).rejects.toThrow('Failed to fetch');
    expect(m.terminate).toHaveBeenCalledTimes(1);
  });

  it('un «error» dopo che il modello è pronto non lo chiude', async () => {
    const m = new FakeModel();
    const p = openVoskModel(m);
    m.emit('load', { result: true });
    await p;
    m.emit('error', { error: 'messaggio sconosciuto' });
    expect(m.terminate).not.toHaveBeenCalled();
  });
});

const FIXED = 'https://esempio.it/app/vosk-model-small-it-0.22.tar.gz';
const FOLDER = voskFolder(FIXED);

/** Dipendenze finte; le funzioni spia sono restituite a parte, per controllarle. */
function deps(over: Partial<ModelSourceDeps<string>> = {}) {
  const log: string[] = [];
  const spies = {
    prune: vi.fn(over.prune ?? (() => Promise.resolve({ extracted: false, removed: 0 }))),
    ensureInCache: vi.fn(over.ensureInCache ?? (() => Promise.resolve({ inCache: true }))),
    modelBlob: vi.fn(over.modelBlob ?? (() => Promise.resolve(new Blob(['tar'])))),
    open: vi.fn(over.open ?? ((url: string) => Promise.resolve(url))),
  };
  const d: ModelSourceDeps<string> = {
    fixedUrl: FIXED,
    serviceWorkerControls: over.serviceWorkerControls ?? (() => true),
    log: (t: string) => void log.push(t),
    ...spies,
  };
  return { d, log, ...spies };
}

describe('da dove prende il modello', () => {
  it('copia già estratta: indirizzo fisso, niente cache', async () => {
    const { d, log, prune, ensureInCache } = deps({ prune: () => Promise.resolve({ extracted: true, removed: 42 }) });
    const r = await openVoskModelSource(d, () => {});
    expect(r).toEqual({ model: FIXED, path: 'estratto' });
    expect(prune).toHaveBeenCalledWith(FOLDER);
    expect(ensureInCache).not.toHaveBeenCalled();
    expect(log.join('\n')).toContain('tolte 42 voci');
  });

  it('non estratta, con il service worker: modello in cache, poi indirizzo fisso', async () => {
    const { d, ensureInCache, open, modelBlob } = deps();
    const r = await openVoskModelSource(d, () => {});
    expect(r.path).toBe('cache');
    expect(ensureInCache).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(FIXED);
    expect(modelBlob).not.toHaveBeenCalled();
  });

  it('senza service worker: riserva blob:, poi la copia blob viene tolta', async () => {
    const { d, prune } = deps({ serviceWorkerControls: () => false });
    const r = await openVoskModelSource(d, () => {});
    expect(r.path).toBe('riserva');
    expect(String(r.model).startsWith('blob:')).toBe(true);
    // Due pulizie: prima (cartella fissa) e dopo, per togliere la copia blob.
    expect(prune).toHaveBeenCalledTimes(2);
    expect(prune).toHaveBeenLastCalledWith(FOLDER);
  });

  it('indirizzo fisso che non va: riserva blob:', async () => {
    const { d } = deps({
      open: (url: string) => (url === FIXED ? Promise.reject(new Error('no')) : Promise.resolve(url)),
    });
    const r = await openVoskModelSource(d, () => {});
    expect(r.path).toBe('riserva');
  });

  it('modello non conservabile in cache: riserva con lo stesso file, senza riscaricare', async () => {
    const file = new Blob(['tar']);
    const { d, modelBlob } = deps({ ensureInCache: () => Promise.resolve({ inCache: false, blob: file }) });
    const r = await openVoskModelSource(d, () => {});
    expect(r.path).toBe('riserva');
    expect(modelBlob).not.toHaveBeenCalled();
  });

  it('copia estratta che non si apre: riserva', async () => {
    const { d } = deps({
      prune: () => Promise.resolve({ extracted: true, removed: 0 }),
      open: (url: string) => (url === FIXED ? Promise.reject(new Error('rotta')) : Promise.resolve(url)),
    });
    const r = await openVoskModelSource(d, () => {});
    expect(r.path).toBe('riserva');
  });
});

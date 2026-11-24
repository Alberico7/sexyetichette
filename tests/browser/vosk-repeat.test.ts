/**
 * Test ripetuto (regola «Niente che si accumula o resta aperto» di CLAUDE.md):
 * 3 preparazioni di seguito non devono far crescere l'archivio di vosk-browser né
 * lasciare indirizzi blob: aperti. Archivio `/vosk` vero (IndexedDB del browser dei test),
 * pulizia vera; il worker di Vosk è finto: scrive la sua cartella come quello vero.
 * Vedi docs/2026-11-24-vosk-copie-del-modello.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VOSK_DB, pruneVoskArchive, voskFolder } from '@/voice/vosk-archive';
import { openVoskModelSource, type ModelSourceDeps } from '@/voice/vosk-source';

const FIXED = 'https://esempio.it/app/vosk-model-small-it-0.22.tar.gz';

function idb<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error(String(req.error)));
  });
}

/** Come il worker: estrae il modello nella cartella che dipende dall'indirizzo. */
function fakeWorkerWrites(url: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.open(VOSK_DB, 21);
    req.onupgradeneeded = () => req.result.createObjectStore('FILE_DATA').createIndex('timestamp', 'timestamp');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('FILE_DATA', 'readwrite');
      const s = tx.objectStore('FILE_DATA');
      const base = voskFolder(url);
      s.put({ timestamp: new Date(), mode: 16893 }, VOSK_DB);
      s.put({ timestamp: new Date(), mode: 16893 }, base);
      for (const f of ['am/final.mdl', 'graph/HCLr.fst', 'downloaded.tar.gz', 'downloaded.ok', 'extracted.ok'])
        s.put({ timestamp: new Date(), mode: 33206, contents: new Uint8Array(100) }, `${base}/${f}`);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

async function archive(): Promise<{ folders: string[]; keys: number }> {
  const req = indexedDB.open(VOSK_DB);
  const db = await new Promise<IDBDatabase>((r) => {
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onsuccess = () => r(req.result);
    req.onerror = () => r(null as unknown as IDBDatabase);
  });
  if (!db?.objectStoreNames.contains('FILE_DATA')) {
    db?.close();
    return { folders: [], keys: 0 };
  }
  const keys = (await idb(db.transaction('FILE_DATA').objectStore('FILE_DATA').getAllKeys())) as string[];
  db.close();
  const folders = [...new Set(keys.filter((k) => k !== VOSK_DB).map((k) => k.split('/').slice(0, 3).join('/')))];
  return { folders, keys: keys.length };
}

const deleteDb = () =>
  new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase(VOSK_DB);
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });

function deps(serviceWorker: boolean): ModelSourceDeps<string> {
  return {
    fixedUrl: FIXED,
    prune: (keep) => pruneVoskArchive(keep),
    serviceWorkerControls: () => serviceWorker,
    ensureInCache: () => Promise.resolve({ inCache: true }),
    modelBlob: () => Promise.resolve(new Blob(['modello'])),
    open: async (url) => {
      await fakeWorkerWrites(url);
      return url;
    },
    log: () => {},
  };
}

beforeEach(deleteDb);
afterEach(async () => {
  vi.restoreAllMocks();
  await deleteDb();
});

describe('preparazioni ripetute: niente si accumula', () => {
  it('strada fissa: dopo 3 preparazioni c’è una sola cartella, sempre la stessa', async () => {
    const paths: string[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await openVoskModelSource(deps(true), () => {});
      paths.push(r.path);
      const a = await archive();
      expect(a.folders).toEqual([voskFolder(FIXED)]);
      sizes.push(a.keys);
    }
    // La prima volta dalla cache, poi dalla copia già estratta.
    expect(paths).toEqual(['cache', 'estratto', 'estratto']);
    expect(new Set(sizes).size).toBe(1);
  });

  it('strada di riserva (blob:): l’archivio resta vuoto e ogni indirizzo blob: viene chiuso', async () => {
    const created = vi.spyOn(URL, 'createObjectURL');
    const revoked = vi.spyOn(URL, 'revokeObjectURL');
    for (let i = 0; i < 3; i++) {
      const r = await openVoskModelSource(deps(false), () => {});
      expect(r.path).toBe('riserva');
      expect((await archive()).folders).toEqual([]);
    }
    expect(created).toHaveBeenCalledTimes(3);
    expect(revoked.mock.calls.map((c) => c[0])).toEqual(created.mock.results.map((r) => r.value as string));
  });

  it('archivio già pieno di copie vecchie: la prima preparazione le toglie, poi resta una cartella', async () => {
    for (let i = 0; i < 5; i++) await fakeWorkerWrites(`blob:https://esempio.it/vecchia-${i}`);
    expect((await archive()).folders).toHaveLength(5);
    for (let i = 0; i < 3; i++) {
      await openVoskModelSource(deps(true), () => {});
      expect((await archive()).folders).toEqual([voskFolder(FIXED)]);
    }
  });
});

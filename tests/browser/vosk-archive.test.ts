/**
 * Pulizia dell'archivio di vosk-browser, con un database `/vosk` finto fatto come quello
 * di IDBFS (versione 21, store FILE_DATA con indice timestamp).
 * Vedi docs/2026-11-24-vosk-copie-del-modello.md.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { VOSK_DB, pruneVoskArchive, voskFolder } from '@/voice/vosk-archive';

const FIXED = 'https://alberico7.github.io/sexyetichette/vosk-model-small-it-0.22.tar.gz';
const KEEP = voskFolder(FIXED);
const BLOB_A = voskFolder('blob:https://alberico7.github.io/1111-aaaa');
const BLOB_B = voskFolder('blob:https://alberico7.github.io/2222-bbbb');

const deleteDb = () =>
  new Promise<void>((r) => {
    const q = indexedDB.deleteDatabase(VOSK_DB);
    q.onsuccess = q.onerror = q.onblocked = () => r();
  });

/** Crea l'archivio finto con le chiavi date (come le scrive IDBFS: percorsi). */
function makeArchive(keys: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VOSK_DB, 21);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('FILE_DATA');
      store.createIndex('timestamp', 'timestamp', { unique: false });
    };
    req.onerror = () => reject(new Error(String(req.error)));
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('FILE_DATA', 'readwrite');
      for (const k of keys) tx.objectStore('FILE_DATA').put({ timestamp: new Date(), mode: 33206 }, k);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    };
  });
}

function keysLeft(): Promise<string[]> {
  return new Promise((resolve) => {
    const req = indexedDB.open(VOSK_DB);
    req.onsuccess = () => {
      const q = req.result.transaction('FILE_DATA').objectStore('FILE_DATA').getAllKeys();
      q.onsuccess = () => {
        req.result.close();
        resolve((q.result as string[]).sort());
      };
    };
  });
}

const folder = (base: string, extracted: boolean) => [
  base,
  `${base}/am`,
  `${base}/am/final.mdl`,
  `${base}/downloaded.tar.gz`,
  ...(extracted ? [`${base}/extracted.ok`] : []),
];

afterEach(deleteDb);

describe('archivio di vosk-browser', () => {
  it('la cartella dipende dall’indirizzo, come nel worker', () => {
    expect(KEEP).toBe('/vosk/https___alberico7_github_io_sexyetichette_vosk_model_small_it_0_22_tar_gz');
  });

  it('con più copie resta solo quella da tenere; dice che è estratta', async () => {
    await makeArchive([VOSK_DB, ...folder(BLOB_A, true), ...folder(KEEP, true), ...folder(BLOB_B, true)]);
    const r = await pruneVoskArchive(KEEP);
    expect(r).toEqual({ extracted: true, removed: 10 });
    expect(await keysLeft()).toEqual([VOSK_DB, ...folder(KEEP, true)].sort());
  });

  it('cartella fissa non ancora estratta: lo dice, e toglie comunque le copie blob', async () => {
    await makeArchive([...folder(BLOB_A, true), ...folder(KEEP, false)]);
    const r = await pruneVoskArchive(KEEP);
    expect(r).toEqual({ extracted: false, removed: 5 });
    expect(await keysLeft()).toEqual(folder(KEEP, false).sort());
  });

  it('una cartella con lo stesso inizio del nome non viene scambiata per quella da tenere', async () => {
    await makeArchive([...folder(KEEP, true), `${KEEP}_vecchia/extracted.ok`]);
    const r = await pruneVoskArchive(KEEP);
    expect(r.removed).toBe(1);
  });

  it('senza archivio non lo crea', async () => {
    await deleteDb();
    expect(await pruneVoskArchive(KEEP)).toEqual({ extracted: false, removed: 0 });
    const dbs = await indexedDB.databases();
    expect(dbs.map((d) => d.name)).not.toContain(VOSK_DB);
  });

  it('se l’archivio non risponde in tempo, va avanti senza bloccare', async () => {
    await makeArchive(folder(BLOB_A, true));
    // Archivio occupato: una transazione di scrittura tenuta aperta fa aspettare le altre.
    const holder = await new Promise<IDBDatabase>((r) => {
      const q = indexedDB.open(VOSK_DB);
      q.onsuccess = () => r(q.result);
    });
    const tx = holder.transaction('FILE_DATA', 'readwrite');
    const t0 = performance.now();
    // Durante la transazione lunga la pulizia aspetta; con un tempo massimo breve si arrende.
    const keepBusy = () => tx.objectStore('FILE_DATA').get('x').addEventListener('success', keepBusy);
    keepBusy();
    const r = await pruneVoskArchive(KEEP, 100);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(r).toEqual({ extracted: false, removed: 0 });
    tx.abort();
    holder.close();
  });
});

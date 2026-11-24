/**
 * Archivio di vosk-browser nel telefono: il worker monta IDBFS su `/vosk` (database
 * IndexedDB `/vosk`, store `FILE_DATA`) e tiene il modello estratto nella cartella
 * `"/vosk/" + modelUrl.replace(/[\W]/g, "_")`. Con un indirizzo che cambia a ogni
 * preparazione (blob:) le copie si accumulano, e il worker le rilegge tutte in memoria.
 * Vedi docs/2026-11-24-vosk-copie-del-modello.md.
 */
export const VOSK_DB = '/vosk';
const STORE = 'FILE_DATA';

/** Cartella in cui il worker di vosk-browser mette il modello passato con questo indirizzo. */
export function voskFolder(modelUrl: string): string {
  return `${VOSK_DB}/${modelUrl.replace(/[\W]/g, '_')}`;
}

export interface PruneResult {
  /** La cartella da tenere contiene un modello già estratto (`extracted.ok`). */
  extracted: boolean;
  /** Voci di altre cartelle tolte dall'archivio. */
  removed: number;
}

const NOTHING: PruneResult = { extracted: false, removed: 0 };

/**
 * Toglie dall'archivio tutto ciò che non sta nella cartella `keep`, e dice se lì il
 * modello è già estratto. Non crea l'archivio se non c'è. Se qualcosa va storto, o
 * passano `timeoutMs`, risponde «niente da tenere» senza bloccare la dettatura.
 */
export function pruneVoskArchive(keep: string, timeoutMs = 5000): Promise<PruneResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (r: PruneResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const timer = setTimeout(() => finish(NOTHING), timeoutMs);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(VOSK_DB);
    } catch {
      finish(NOTHING);
      return;
    }
    // Il database non c'era: si annulla, così non viene creato.
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onerror = () => finish(NOTHING);
    req.onblocked = () => finish(NOTHING);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.close();
        finish(NOTHING);
        return;
      }
      let extracted = false;
      let removed = 0;
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const cursor = store.openKeyCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        // Le chiavi di IDBFS sono percorsi (testo).
        const key = typeof c.key === 'string' ? c.key : '';
        if (key === `${keep}/extracted.ok`) extracted = true;
        if (key !== keep && !key.startsWith(`${keep}/`) && key !== VOSK_DB) {
          store.delete(c.primaryKey);
          removed++;
        }
        c.continue();
      };
      tx.oncomplete = () => {
        db.close();
        finish({ extracted, removed });
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        finish(NOTHING);
      };
    };
  });
}

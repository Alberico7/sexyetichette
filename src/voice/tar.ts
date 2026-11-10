/**
 * Archivio tar minimo (formato ustar), per passare a vosk-browser il modello 0.22,
 * che è pubblicato solo come zip. Vedi docs/2026-11-10-prova-dettatura.md.
 */
export interface TarEntry {
  /** Percorso con «/»; le cartelle finiscono con «/». */
  name: string;
  /** Contenuto (vuoto per le cartelle). */
  data: Uint8Array;
}

const BLOCK = 512;
const enc = new TextEncoder();

function writeString(buf: Uint8Array, offset: number, length: number, value: string) {
  const bytes = enc.encode(value);
  if (bytes.length > length) throw new Error(`Campo tar troppo lungo: ${value}`);
  buf.set(bytes, offset);
}

/** Numero ottale su `length - 1` cifre seguito da NUL, come vuole il formato. */
function writeOctal(buf: Uint8Array, offset: number, length: number, value: number) {
  writeString(buf, offset, length, value.toString(8).padStart(length - 1, '0') + '\0');
}

function header(entry: TarEntry): Uint8Array {
  const h = new Uint8Array(BLOCK);
  const dir = entry.name.endsWith('/');
  writeString(h, 0, 100, entry.name);
  writeOctal(h, 100, 8, dir ? 0o755 : 0o644);
  writeOctal(h, 108, 8, 0);
  writeOctal(h, 116, 8, 0);
  writeOctal(h, 124, 12, dir ? 0 : entry.data.length);
  writeOctal(h, 136, 12, 0);
  h.fill(0x20, 148, 156); // somma di controllo calcolata con il campo pieno di spazi
  h[156] = dir ? 0x35 : 0x30; // '5' cartella, '0' file
  writeString(h, 257, 6, 'ustar\0');
  writeString(h, 263, 2, '00');
  let sum = 0;
  for (const b of h) sum += b;
  writeString(h, 148, 8, sum.toString(8).padStart(6, '0') + '\0 ');
  return h;
}

/** Crea l'archivio: intestazione e contenuto di ogni voce, a blocchi di 512 byte, più due blocchi vuoti. */
export function createTar(entries: readonly TarEntry[]): Uint8Array {
  const size = entries.reduce(
    (n, e) => n + BLOCK + (e.name.endsWith('/') ? 0 : Math.ceil(e.data.length / BLOCK) * BLOCK),
    2 * BLOCK,
  );
  const out = new Uint8Array(size);
  let at = 0;
  for (const e of entries) {
    out.set(header(e), at);
    at += BLOCK;
    if (!e.name.endsWith('/')) {
      out.set(e.data, at);
      at += Math.ceil(e.data.length / BLOCK) * BLOCK;
    }
  }
  return out;
}

/** Voci da un elenco di file: aggiunge le cartelle intermedie e mette tutto in ordine. */
export function entriesFromFiles(files: Record<string, Uint8Array>): TarEntry[] {
  const dirs = new Set<string>();
  const out: TarEntry[] = [];
  for (const [name, data] of Object.entries(files)) {
    const parts = name.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/') + '/');
    if (!name.endsWith('/')) out.push({ name, data });
  }
  for (const d of dirs) out.push({ name: d, data: new Uint8Array(0) });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Impronta SHA-256 in esadecimale. */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

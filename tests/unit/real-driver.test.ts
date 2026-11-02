/**
 * Il lavoro preparato dall'app passa nel driver reale (`WebLabelWriterPrinter`
 * della libreria 0.6.4) con un trasporto USB finto che registra i byte.
 * Verifica che orientamento, larghezza e numero di righe arrivino intatti
 * all'encoder della 550. Non sostituisce la prova con la stampante vera.
 */
import { describe, expect, it } from 'vitest';
import { getPixel } from '@mbtech-nl/bitmap';
import { DEVICES } from '@thermal-label/labelwriter-core';
import { WebLabelWriterPrinter } from '@thermal-label/labelwriter-web';
import { buildJob } from '@/printer/print-flow';
import { toAppError } from '@/printer/errors';
import { libraryPrintArgs, toAppStatus } from '@/printer/webusb';
import { addressDoc, fakePrepare } from './helpers';

const ESC = 0x1b;

/** Stato a 32 byte: `printStatus` (byte 0) e stato del vano rotolo (byte 10). */
function status550(printStatus = 0, bay = 8): Uint8Array {
  const b = new Uint8Array(32);
  b[0] = printStatus;
  b[10] = bay;
  return b;
}

class FakeTransport {
  writes: Uint8Array[] = [];
  connected = true;
  constructor(private readonly statusReply: () => Uint8Array) {}
  async write(data: Uint8Array): Promise<void> {
    this.writes.push(new Uint8Array(data));
  }
  async read(length: number): Promise<Uint8Array> {
    if (length === 32) return this.statusReply();
    return new Uint8Array(length);
  }
  async close(): Promise<void> {
    this.connected = false;
  }
  all(): Uint8Array {
    const total = this.writes.reduce((s, w) => s + w.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const w of this.writes) {
      out.set(w, o);
      o += w.length;
    }
    return out;
  }
}

function findSeq(hay: Uint8Array, needle: number[], from = 0): number {
  outer: for (let i = from; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

describe('driver reale LabelWriter 550 con trasporto finto', () => {
  it('codifica il lavoro senza rotazioni aggiuntive e con 2 copie', async () => {
    const transport = new FakeTransport(() => status550());
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, transport);
    const prepared = await fakePrepare(addressDoc());
    const job = buildJob(addressDoc(), prepared, { copies: 2, density: 'high' });

    await printer.print(...libraryPrintArgs(job));
    const bytes = transport.all();

    // Il primo comando chiede il lock (ESC A 1).
    expect([...transport.writes[0]!]).toEqual([ESC, 0x41, 1]);
    // Densità: 'high' = 130 %.
    expect(findSeq(bytes, [ESC, 0x43, 130])).toBeGreaterThan(0);

    // Due etichette: ESC D con 980 righe (avanzamento) × 672 punti (testina).
    const first = findSeq(bytes, [ESC, 0x44, 1, 2]);
    const second = findSeq(bytes, [ESC, 0x44, 1, 2], first + 1);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(first);
    expect(u32(bytes, first + 4)).toBe(980);
    expect(u32(bytes, first + 8)).toBe(672);

    // Le righe raster corrispondono al nostro bitmap (larghezza 331, riempito a destra fino a 672).
    const raster = first + 12;
    const bmp = prepared.wireBitmap;
    for (const [x, y] of [
      [0, 0],
      [330, 0],
      [5, 979],
      [200, 500],
      [331, 10],
      [671, 10],
    ] as const) {
      const byte = bytes[raster + y * 84 + (x >> 3)]!;
      const bit = (byte >> (7 - (x & 7))) & 1;
      const expected = x < bmp.widthPx ? (getPixel(bmp, x, y) ? 1 : 0) : 0;
      expect(bit, `punto ${x},${y}`).toBe(expected);
    }

    // Chiusura del lavoro: ESC E (avanzamento al taglio) + ESC Q (rilascio lock).
    expect(findSeq(bytes, [ESC, 0x45, ESC, 0x51])).toBe(bytes.length - 4);
  });

  it('lock occupato → errore "Stampante occupata"', async () => {
    const transport = new FakeTransport(() => status550(5));
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, transport);
    const job = buildJob(addressDoc(), await fakePrepare(addressDoc()), { copies: 1, density: 'normal' });
    const err = await printer.print(...libraryPrintArgs(job)).catch((e: unknown) => e);
    expect(toAppError(err).code).toBe('busy');
  });

  it.each([
    [1, 'cover-open'],
    [2, 'no-media'],
    [3, 'no-media'],
    [9, 'paper-jam'],
    [10, 'invalid-media'],
  ])('vano rotolo %i → %s, nessun dato raster inviato', async (bay, code) => {
    const transport = new FakeTransport(() => status550(0, bay));
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, transport);
    const job = buildJob(addressDoc(), await fakePrepare(addressDoc()), { copies: 1, density: 'normal' });
    const err = await printer.print(...libraryPrintArgs(job)).catch((e: unknown) => e);
    expect(toAppError(err).code).toBe(code);
    expect(findSeq(transport.all(), [ESC, 0x44])).toBe(-1);
    // Anche lo stato letto dal polling viene tradotto.
    const status = toAppStatus(await printer.getStatus());
    expect(status.problems[0]?.code).toBe(code);
  });
});

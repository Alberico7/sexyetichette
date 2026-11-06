/**
 * Copie multiple sulla 550 nell'ordine del driver ufficiale DYMO, con il
 * driver vero della libreria e un trasporto finto. Vedi
 * docs/2026-11-06-copie-multiple-550.md.
 */
import { describe, expect, it } from 'vitest';
import { DEVICES, compose550Job, renderImage } from '@thermal-label/labelwriter-core';
import { WebLabelWriterPrinter } from '@thermal-label/labelwriter-web';
import { numberLabelsFromOne, write550CopiesDymoOrder } from '@/printer/copies';
import { buildJob } from '@/printer/print-flow';
import type { PrintJob } from '@/printer/types';
import { libraryPrintArgs, printCopies } from '@/printer/webusb';
import { addressDoc, fakePrepare } from './helpers';

const ESC = 0x1b;

/** Stato a 32 byte: byte 0 stato di stampa, byte 5 indice etichetta, byte 10 vano rotolo. */
function status550(printStatus = 0, index = 0, bay = 8): Uint8Array {
  const b = new Uint8Array(32);
  b[0] = printStatus;
  b[5] = index;
  b[10] = bay;
  return b;
}

/**
 * Trasporto che si comporta come si suppone faccia la 550 secondo il driver DYMO:
 * risponde a ESC A 0/1 subito, ma a ESC A 2 solo dopo aver ricevuto l'etichetta
 * successiva. Una lettura senza risposta pronta fallisce subito (sulla stampante
 * vera scadrebbe dopo 15 s).
 */
class Lw550Like {
  events: string[] = [];
  writes: Uint8Array[] = [];
  connected = true;
  private replies: Uint8Array[] = [];
  private pendingLock2 = false;
  private labelsSeen = 0;
  constructor(private readonly reply: (labelsSeen: number) => Uint8Array = (n) => status550(1, n)) {}

  async write(data: Uint8Array): Promise<void> {
    const d = new Uint8Array(data);
    this.writes.push(d);
    if (d[0] === ESC && d[1] === 0x41) {
      this.events.push(`ESC A ${d[2]}`);
      if (d[2] === 2) this.pendingLock2 = true;
      else this.replies.push(d[2] === 1 ? status550(0) : this.reply(this.labelsSeen));
      return;
    }
    if (d[0] === ESC && d[1] === 0x6e) {
      this.labelsSeen++;
      this.events.push(`etichetta ${d[2]! | (d[3]! << 8)}`);
      if (this.pendingLock2) {
        this.pendingLock2 = false;
        this.replies.push(this.reply(this.labelsSeen));
      }
      return;
    }
    if (d[0] === ESC && d[1] === 0x73) return void this.events.push('preambolo');
    if (d[0] === ESC && d[1] === 0x45 && d[2] === ESC && d[3] === 0x51) return void this.events.push('ESC E ESC Q');
    if (d.length === 2 && d[0] === ESC && d[1] === 0x51) return void this.events.push('ESC Q');
    this.events.push(`altro ${d.length} byte`);
  }

  async read(length: number): Promise<Uint8Array> {
    const r = this.replies.shift();
    if (!r) {
      this.events.push('lettura senza risposta');
      const e = new Error('Transfer timed out after 15000 ms');
      e.name = 'TransportTimeoutError';
      throw e;
    }
    this.events.push('lettura');
    return r.subarray(0, length);
  }

  async close(): Promise<void> {
    this.connected = false;
  }
}

async function jobOf(copies: number): Promise<PrintJob> {
  return buildJob(addressDoc(), await fakePrepare(addressDoc()), { copies, density: 'high' });
}

describe('copie multiple nell’ordine del driver DYMO', () => {
  it('3 copie: ordine esatto dei comandi, indici 1-2-3', async () => {
    const t = new Lw550Like();
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, t);
    const result = await printCopies(printer, await jobOf(3), {}, 'job');
    expect(result).toEqual({ sent: 3, stopped: false, mode: 'job' });
    expect(t.events).toEqual([
      'ESC A 1',
      'lettura',
      'preambolo',
      'etichetta 1',
      'ESC A 2',
      'etichetta 2',
      'lettura',
      'ESC A 2',
      'etichetta 3',
      'lettura',
      'ESC A 0',
      'lettura',
      'ESC E ESC Q',
    ]);
  });

  it('dati delle etichette identici a quelli della libreria, tranne l’indice', async () => {
    const job = await jobOf(3);
    const [image, media, options] = libraryPrintArgs(job);
    const composed = compose550Job(DEVICES.LW_550, renderImage(image, { dither: true, rotate: 0 }), options, media);
    const ours = numberLabelsFromOne(composed.labels);
    ours.forEach((seg, i) => {
      expect([seg[2], seg[3]]).toEqual([i + 1, 0]);
      expect(seg.subarray(4)).toEqual(composed.labels[i]!.subarray(4));
    });
  });

  it('riproduce il guasto: la sequenza della libreria si blocca, la nostra finisce', async () => {
    const lib = new Lw550Like();
    const libPrinter = new WebLabelWriterPrinter(DEVICES.LW_550, lib);
    await expect(libPrinter.print(...libraryPrintArgs(await jobOf(2)))).rejects.toThrow();
    // La libreria aspetta la risposta a ESC A 2 prima di spedire l'etichetta successiva.
    expect(lib.events.slice(lib.events.indexOf('ESC A 2'))).toEqual(['ESC A 2', 'lettura senza risposta']);

    const ours = new Lw550Like();
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, ours);
    await expect(printCopies(printer, await jobOf(2), {}, 'job')).resolves.toMatchObject({ sent: 2 });
  });

  it('carta finita nella risposta dopo l’etichetta 2: si ferma, ESC Q, 2 etichette su 3', async () => {
    const t = new Lw550Like((n) => (n >= 2 ? status550(2, n, 2) : status550(1, n)));
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, t);
    const err = (await printCopies(printer, await jobOf(3), {}, 'job').catch((e: unknown) => e)) as {
      sent: number;
      total: number;
      statusError?: { code: string };
    };
    expect(err.sent).toBe(2);
    expect(err.total).toBe(3);
    expect(err.statusError?.code).toBeTruthy();
    expect(t.events).not.toContain('etichetta 3');
    expect(t.events.at(-1)).toBe('ESC Q');
  });

  it('risposta che non arriva: ESC Q per sbloccare ed errore con le etichette partite', async () => {
    const t = new Lw550Like();
    const composed = {
      preamble: new Uint8Array([ESC, 0x73, 1, 0, 0, 0]),
      labels: [new Uint8Array([ESC, 0x6e, 0, 0]), new Uint8Array([ESC, 0x6e, 0, 0])],
      finalize: new Uint8Array([ESC, 0x45, ESC, 0x51]),
    };
    // Nessuna risposta: la lettura dopo l'etichetta 2 fallisce.
    t.read = async () => {
      throw new Error('Transfer timed out after 15000 ms');
    };
    const err = (await write550CopiesDymoOrder(t, composed).catch((e: unknown) => e)) as { sent: number };
    expect(err.sent).toBe(2);
    expect(t.events.at(-1)).toBe('ESC Q');
  });

  it('«Ferma» dopo 2 di 5: niente etichetta 3, chiusura normale', async () => {
    const t = new Lw550Like();
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, t);
    let sent = 0;
    const result = await printCopies(
      printer,
      await jobOf(5),
      { shouldStop: () => sent >= 2, onProgress: (s) => (sent = s) },
      'job',
    );
    expect(result).toEqual({ sent: 2, stopped: true, mode: 'job' });
    expect(t.events.slice(-6)).toEqual(['ESC A 2', 'etichetta 2', 'lettura', 'ESC A 0', 'lettura', 'ESC E ESC Q']);
  });

  it('modo «una alla volta»: 3 lavori da 1 copia; «Ferma» dopo la copia in corso', async () => {
    const t = new Lw550Like();
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, t);
    expect(await printCopies(printer, await jobOf(3), {}, 'one-by-one')).toEqual({
      sent: 3,
      stopped: false,
      mode: 'one-by-one',
    });
    expect(t.events.filter((e) => e === 'ESC A 1')).toHaveLength(3);
    expect(t.events.filter((e) => e === 'etichetta 0')).toHaveLength(3);

    const t2 = new Lw550Like();
    let sent = 0;
    const r = await printCopies(
      new WebLabelWriterPrinter(DEVICES.LW_550, t2),
      await jobOf(5),
      { shouldStop: () => sent >= 1, onProgress: (s) => (sent = s) },
      'one-by-one',
    );
    expect(r).toEqual({ sent: 1, stopped: true, mode: 'one-by-one' });
  });

  it('parti interne della libreria mancanti: una copia alla volta', async () => {
    const calls: number[] = [];
    const fake = {
      device: DEVICES.LW_550,
      print: async (_img: unknown, _m: unknown, o: { copies?: number }) => void calls.push(o.copies ?? 0),
    } as unknown as WebLabelWriterPrinter;
    const r = await printCopies(fake, await jobOf(3), {}, 'job');
    expect(r).toEqual({ sent: 3, stopped: false, mode: 'one-by-one' });
    expect(calls).toEqual([1, 1, 1]);
  });
});

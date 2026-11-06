/**
 * Lettura del rotolo: cause precise con il driver reale della libreria (0.6.4)
 * e un trasporto finto che risponde come farebbe la 550.
 */
import { describe, expect, it } from 'vitest';
import { DEVICES, parseSkuInfo } from '@thermal-label/labelwriter-core';
import { WebLabelWriterPrinter } from '@thermal-label/labelwriter-web';
import { DiagnosticLog } from '@/diagnostics/log';
import {
  classifyMediaRead,
  compareWithCatalog,
  mediaReadToText,
  readWithRetry,
  skuFields,
} from '@/diagnostics/media-read';
import { traceTransport } from '@/diagnostics/usb-trace';
import { buildSkuBytes } from '@/printer/sim-sku';
import type { MediaReadResult } from '@/printer/types';
import { readMediaWith } from '@/printer/webusb';

type Reply = Uint8Array | Error;

class FakeTransport {
  connected = true;
  writes: Uint8Array[] = [];
  constructor(private readonly reply: (cmd: number) => Reply) {}
  private last = 0;
  async write(data: Uint8Array): Promise<void> {
    this.writes.push(new Uint8Array(data));
    this.last = data[1] ?? 0;
  }
  async read(length: number): Promise<Uint8Array> {
    const r = this.reply(this.last);
    if (r instanceof Error) throw r;
    return r.subarray(0, length);
  }
  async close(): Promise<void> {
    this.connected = false;
  }
}

function timeoutError(): Error {
  const e = new Error('Transfer timed out after 2000 ms');
  e.name = 'TransportTimeoutError';
  return e;
}

async function readWith(reply: (cmd: number) => Reply): Promise<{ result: MediaReadResult; log: DiagnosticLog }> {
  const transport = new FakeTransport(reply);
  const printer = new WebLabelWriterPrinter(DEVICES.LW_550, transport);
  const log = new DiagnosticLog();
  const trace = traceTransport(transport, log, () => 0)!;
  return { result: await readMediaWith(printer, trace), log };
}

const tag25x54 = () => buildSkuBytes({ sku: '1976411', widthMm: 25, lengthMm: 54, totalLabels: 500 });

describe('lettura del rotolo con il driver reale', () => {
  it('tag valido nel catalogo: formato 25×54 e campi del tag', async () => {
    const { result, log } = await readWith(() => tag25x54());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.detected.media.id).toBe('multi-purpose-small');
    expect(result.detected.totalLabels).toBe(500);
    expect(result.bytes?.length).toBe(63);
    expect(result.fields.find((f) => f.label === 'Codice (SKU)')?.value).toBe('1976411');
    // Il traffico USB è registrato con il comando riconosciuto e la risposta in esadecimale.
    expect(log.toText()).toMatch(/ESC U \(dati del rotolo\) · 2 byte/);
    expect(log.toText()).toMatch(/risposta a ESC U.*63\/63 byte/);
    expect(log.toText()).toContain('b6 ca');
  });

  it('codice fuori catalogo: usa le misure del tag', async () => {
    const { result } = await readWith(() => buildSkuBytes({ sku: 'S0999999', widthMm: 25, lengthMm: 54 }));
    expect(result.ok && result.detected.fromCatalog).toBe(false);
    expect(result.ok && result.detected.media.widthMm).toBe(25);
  });

  it('nessuna risposta: causa «timeout»', async () => {
    const { result, log } = await readWith(() => timeoutError());
    expect(result.ok).toBe(false);
    expect(!result.ok && result.reason).toBe('timeout');
    expect(!result.ok && result.message).toMatch(/non ha risposto/);
    expect(log.toText()).toMatch(/Lettura USB fallita/);
  });

  it('risposta corta: causa «short» con i byte ricevuti', async () => {
    const { result } = await readWith(() => tag25x54().subarray(0, 20));
    expect(!result.ok && result.reason).toBe('short');
    expect(!result.ok && result.detail).toMatch(/20 byte su 63/);
    expect(result.bytes?.length).toBe(20);
  });

  it('codice iniziale errato: causa «bad-magic» con il valore trovato', async () => {
    const { result } = await readWith(() => buildSkuBytes({ sku: '30252', widthMm: 28, lengthMm: 89, magic: 0x1234 }));
    expect(!result.ok && result.reason).toBe('bad-magic');
    expect(!result.ok && result.detail).toMatch(/0x1234/);
  });

  it('tag senza misure: causa «no-size»', async () => {
    const { result } = await readWith(() => buildSkuBytes({ sku: 'X', widthMm: 0, lengthMm: 0 }));
    expect(!result.ok && result.reason).toBe('no-size');
  });

  it('nessun byte osservato: causa generica «invalid»', () => {
    const r = classifyMediaRead({ sku: undefined });
    expect(!r.ok && r.reason).toBe('invalid');
  });
});

describe('secondo tentativo', () => {
  it('riprova una volta e conta i tentativi', async () => {
    let n = 0;
    const once = async (): Promise<MediaReadResult> =>
      ++n === 1 ? classifyMediaRead({ error: timeoutError() }) : classifyMediaRead({ sku: parseSkuInfo(tag25x54()) });
    const r = await readWithRetry(once, { sleep: async () => {} });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it('due fallimenti: restituisce l’ultimo con 2 tentativi', async () => {
    const r = await readWithRetry(async () => classifyMediaRead({ error: timeoutError() }), { sleep: async () => {} });
    expect(!r.ok && r.reason).toBe('timeout');
    expect(r.attempts).toBe(2);
  });
});

describe('dati del tag e testo', () => {
  it('confronto con il catalogo, in un verso o nell’altro', () => {
    const sku = parseSkuInfo(tag25x54());
    expect(compareWithCatalog(sku).sizeMatches).toBe(true);
    const wrong = parseSkuInfo(buildSkuBytes({ sku: '1976411', widthMm: 28, lengthMm: 89 }));
    expect(compareWithCatalog(wrong).sizeMatches).toBe(false);
    expect(
      compareWithCatalog(parseSkuInfo(buildSkuBytes({ sku: 'ZZZ', widthMm: 1, lengthMm: 1 }))).catalogName,
    ).toBeUndefined();
  });

  it('campi in italiano e testo con i byte in esadecimale', async () => {
    const fields = skuFields(parseSkuInfo(tag25x54()));
    expect(fields.map((f) => f.label)).toContain('Etichette totali');
    const { result } = await readWith(() => tag25x54().subarray(0, 10));
    const text = mediaReadToText(result);
    expect(text).toMatch(/Rotolo non letto/);
    expect(text).toMatch(/Byte ricevuti \(10\): b6 ca/);
  });
});

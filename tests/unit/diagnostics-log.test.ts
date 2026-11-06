import { describe, expect, it } from 'vitest';
import { DiagnosticLog, LOG_CAPACITY } from '@/diagnostics/log';
import { describeCommand, toHex, traceTransport } from '@/diagnostics/usb-trace';

describe('registro degli eventi', () => {
  it('tiene solo gli ultimi 300 eventi e dice quanti ne ha scartati', () => {
    const log = new DiagnosticLog();
    for (let i = 0; i < LOG_CAPACITY + 25; i++) log.add('app', `evento ${i}`);
    expect(log.entries.length).toBe(LOG_CAPACITY);
    expect(log.entries[0]?.message).toBe('evento 25');
    expect(log.toText()).toMatch(/^\(25 eventi più vecchi non conservati\)/);
  });

  it('testo con ora, tipo e dettaglio', () => {
    const log = new DiagnosticLog(10, () => new Date(2026, 10, 3, 16, 40, 12, 345).getTime());
    log.add('error', 'Stampa non riuscita', 'TransportTimeoutError: x');
    expect(log.toText()).toBe('16:40:12.345 ERR  Stampa non riuscita\n             TransportTimeoutError: x');
  });
});

describe('traffico USB', () => {
  it('riconosce i comandi della 550', () => {
    expect(describeCommand(new Uint8Array([0x1b, 0x41, 1]))).toBe('ESC A (stato), richiesta lock');
    expect(describeCommand(new Uint8Array([0x1b, 0x41, 0]))).toBe('ESC A (stato), senza lock');
    expect(describeCommand(new Uint8Array([0x1b, 0x55]))).toBe('ESC U (dati del rotolo)');
    expect(describeCommand(new Uint8Array([0x1b, 0x56]))).toBe('ESC V (versione)');
    expect(describeCommand(new Uint8Array([0x1b, 0x73, 0, 0, 0, 0]))).toBe('ESC s (inizio lavoro)');
    expect(describeCommand(new Uint8Array([0xff, 0x00]))).toBe('dati');
  });

  it('esadecimale troncato', () => {
    expect(toHex(new Uint8Array([0xca, 0xb6, 1]))).toBe('ca b6 01');
    expect(toHex(new Uint8Array(10), 4)).toBe('00 00 00 00 … (+6 byte)');
  });

  it('registra comandi e risposte, mai i dati di stampa, e si può staccare', async () => {
    const transport = {
      async write(_d: Uint8Array) {},
      async read(n: number) {
        return new Uint8Array(n).fill(0xab);
      },
    };
    // Solo confronto di identità: il metodo non viene chiamato.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalWrite = transport.write;
    const log = new DiagnosticLog();
    const trace = traceTransport(transport, log, () => 0)!;
    await transport.write(new Uint8Array([0x1b, 0x41, 0]));
    await transport.read(32);
    // Dati di stampa: 2000 byte con un contenuto riconoscibile.
    await transport.write(new Uint8Array(2000).fill(0x5a));
    const text = log.toText();
    expect(text).toMatch(/ESC A \(stato\), senza lock · 3 byte/);
    expect(text).toContain('1b 41 00');
    expect(text).toMatch(/risposta a ESC A.*32\/32 byte/);
    expect(text).toMatch(/dati · 2000 byte/);
    expect(text).not.toContain('5a 5a');
    expect(trace.readsByOpcode.get(0x41)?.bytes?.length).toBe(32);
    trace.detach();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(transport.write).toBe(originalWrite);
  });

  it('oggetto senza write/read: nessuna osservazione', () => {
    expect(traceTransport({}, new DiagnosticLog())).toBeNull();
    expect(traceTransport(undefined, new DiagnosticLog())).toBeNull();
  });
});

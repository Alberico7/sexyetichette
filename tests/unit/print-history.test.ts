/**
 * «Ultime stampe» nella diagnostica. Vedi docs/2026-11-06-diagnostica-piu-semplice.md.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DiagnosticLog } from '@/diagnostics/log';
import { PRINT_HISTORY_MAX, PrintHistory, printHistory, remainingLabels } from '@/diagnostics/print-history';
import { fullReportText } from '@/diagnostics/report';
import { traceTransport } from '@/diagnostics/usb-trace';
import { runPrint } from '@/printer/print-flow';
import { SimulatedPrinterPort } from '@/printer/simulated';
import { addressDoc, fakePrepare } from './helpers';

const hex = (s: string) => new Uint8Array(s.trim().split(/\s+/).map((b) => parseInt(b, 16)));

/** Risposte a ESC A della 550 vera (2026-11-06): 477 etichette rimaste, poi la risposta «vuota» dopo una pausa. */
const STATUS_477 = hex('00 00 00 00 00 00 00 00 00 64 08 53 30 37 32 32 35 32 30 00 00 00 00 00 00 00 00 dd 01 00 00 00');
const STATUS_EMPTY = hex('04 00 00 00 00 00 00 00 00 64 08 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00');

describe('etichette rimaste nello stato della 550', () => {
  it('byte 27–28: dd 01 = 477', () => {
    expect(remainingLabels(STATUS_477)).toBe(477);
  });
  it('risposta senza dati del rotolo o troppo corta: nessun numero', () => {
    expect(remainingLabels(STATUS_EMPTY)).toBeUndefined();
    expect(remainingLabels(STATUS_477.subarray(0, 20))).toBeUndefined();
  });
});

describe('ultime stampe', () => {
  beforeEach(() => printHistory.clear());

  it('stampante simulata: 2 copie chieste, 2 etichette inviate, nel testo della diagnostica', async () => {
    const port = new SimulatedPrinterPort({ delayMs: 1 });
    await port.connect();
    await runPrint(port, addressDoc(), { copies: 2, density: 'high' }, fakePrepare);
    expect(printHistory.records).toHaveLength(1);
    expect(printHistory.records[0]).toMatchObject({ copies: 2, labelsSent: 2, density: 'high', media: 'address-standard' });
    const text = fullReportText({ app: { version: '0', commit: 'x', builtAt: '' }, prints: printHistory.toText() });
    expect(text).toMatch(/Ultime stampe \(1\):\n {2}\d\d:\d\d:\d\d\.\d{3} · copie chieste 2 · etichette inviate 2 · densità high/);
  });

  it('ne tiene al massimo 10, la più recente per prima', () => {
    const h = new PrintHistory();
    for (let i = 1; i <= 12; i++) h.add({ at: i, copies: i, density: 'normal', media: 'm' });
    expect(h.records).toHaveLength(PRINT_HISTORY_MAX);
    expect(h.records[0]!.copies).toBe(3);
    const lines = h.toText().split('\n');
    expect(lines[0]).toBe('Ultime stampe (10):');
    expect(lines[1]).toContain('copie chieste 12');
  });

  it('errore e contatore del rotolo nel testo', () => {
    const h = new PrintHistory();
    h.add({ at: 0, copies: 2, labelsSent: 1, density: 'high', media: 'm', remainingBefore: 477, remainingAfter: 476, error: 'Transport closed' });
    expect(h.toText()).toContain('copie chieste 2 · etichette inviate 1 · rimaste sul rotolo 477 → 476 · densità high · formato m · ERRORE: Transport closed');
  });

  it('nessuna stampa: lo dice', () => {
    expect(new PrintHistory().toText()).toBe('Ultime stampe (0):\n  (nessuna stampa in questa sessione)');
  });
});

describe('osservatore del traffico USB', () => {
  it('avvisa a ogni scrittura e lettura con il codice del comando', async () => {
    const transport = {
      async write(_data: Uint8Array) {},
      async read(_length: number) {
        return STATUS_477;
      },
    };
    const trace = traceTransport(transport, new DiagnosticLog())!;
    const seen: string[] = [];
    trace.listener = (e) => seen.push(`${e.dir} ${e.opcode?.toString(16)} ${e.bytes.length}`);
    await transport.write(new Uint8Array([0x1b, 0x6e, 0, 0]));
    await transport.write(new Uint8Array([0x1b, 0x41, 0]));
    await transport.read(32);
    expect(seen).toEqual(['tx 6e 4', 'tx 41 3', 'rx 41 32']);
  });
});

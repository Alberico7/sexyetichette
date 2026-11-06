import { describe, expect, it } from 'vitest';
import { checkJob } from '@/diagnostics/job-check';
import { DiagnosticLog } from '@/diagnostics/log';
import { runPrinterCheck, type CheckContext } from '@/diagnostics/printer-check';
import { fullReportText } from '@/diagnostics/report';
import { createDocument, createTextElement } from '@/model/document';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { buildJob } from '@/printer/print-flow';
import { SimulatedPrinterPort } from '@/printer/simulated';
import { canShare, shareFileName, shareText } from '@/share';
import { addressDoc, fakePrepare } from './helpers';

const APP = { version: '0.1.0', commit: 'abc1234', builtAt: '2026-11-03 16:00' };

function context(patch: Partial<CheckContext> = {}): CheckContext {
  return {
    app: APP,
    env: { userAgent: 'Test', secureContext: true, webUsb: true, screen: '412×915' },
    info: null,
    doc: addressDoc(),
    head: LW550_HEAD,
    settings: { density: 'normal', copies: 1 },
    prepare: fakePrepare,
    sleep: async () => {},
    ...patch,
  };
}

async function probeOf(config: ConstructorParameters<typeof SimulatedPrinterPort>[0] = {}) {
  const port = new SimulatedPrinterPort({ delayMs: 1, ...config });
  await port.connect();
  return port.probe()!;
}

describe('prova LabelWriter 550', () => {
  it('tutto a posto: nessun problema e tutti i passaggi', async () => {
    const report = await runPrinterCheck(await probeOf({ rollSku: '30252' }), context());
    expect(report.steps.map((s) => s.id)).toEqual([
      'app',
      'device',
      'version',
      'status',
      'media',
      'geometry',
      'job',
      'settings',
    ]);
    expect(report.problems).toEqual([]);
    expect(report.summary).toMatch(/Nessun problema/);
    expect(report.steps.find((s) => s.id === 'job')?.state).toBe('ok');
    expect(report.steps.find((s) => s.id === 'media')?.details.some((d) => d.label === 'Tag: Codice (SKU)')).toBe(true);
  });

  it('rotolo che non risponde: problema grave in cima', async () => {
    const report = await runPrinterCheck(await probeOf({ fault: 'nfc-timeout' }), context());
    expect(report.problems[0]?.severity).toBe('grave');
    expect(report.problems[0]?.message).toMatch(/Rotolo non letto \(3 tentativi su 3\).*non ha risposto/);
    expect(report.steps.find((s) => s.id === 'media')?.state).toBe('fail');
  });

  it('lettura instabile: avviso', async () => {
    const report = await runPrinterCheck(await probeOf({ fault: 'nfc-flaky' }), context());
    expect(report.problems.some((p) => /instabile: [12] letture su 3/.test(p.message))).toBe(true);
    expect(report.steps.find((s) => s.id === 'media')?.state).toBe('warn');
  });

  it('formato scelto diverso dal rotolo: avviso', async () => {
    const doc = createDocument(findMediaById('multi-purpose-small')!);
    const report = await runPrinterCheck(await probeOf({ rollSku: '30252' }), context({ doc, prepare: fakePrepare }));
    expect(
      report.problems.some((p) => /formato scelto \(25×54 mm\) è diverso dal rotolo \(28×89 mm\)/.test(p.message)),
    ).toBe(true);
  });

  it('coperchio aperto: problema grave dallo stato', async () => {
    const report = await runPrinterCheck(await probeOf({ fault: 'cover-open' }), context());
    expect(report.problems.some((p) => p.severity === 'grave' && /Stato della stampante/.test(p.message))).toBe(true);
  });

  it('550 Turbo: avviso modello non verificato', async () => {
    const report = await runPrinterCheck(await probeOf({ model: 'LW_550_TURBO' }), context());
    expect(report.problems.some((p) => /Turbo/.test(p.message))).toBe(true);
  });
});

describe('controllo del lavoro di stampa', () => {
  it('lavoro corretto: tutte le righe ok, 84 byte per riga', async () => {
    const doc = addressDoc();
    const prepared = await fakePrepare(doc);
    const result = checkJob(
      buildJob(doc, prepared, { copies: 1, density: 'normal' }),
      prepared.geometry,
      LW550_HEAD,
      doc,
    );
    expect(result.rows.filter((r) => r.state !== 'ok')).toEqual([]);
    expect(result.stats.bytesPerLine).toBe(84);
    expect(result.stats.lines).toBe(prepared.geometry.printable.width);
  });

  it('righe sbagliate, pixel grigi ed elementi fuori dall’etichetta', async () => {
    const doc = addressDoc();
    doc.elements.push({ ...createTextElement({ x: 0, y: 0, width: 10, height: 10 }, 'x'), x: 200 });
    const prepared = await fakePrepare(doc);
    const job = buildJob(doc, prepared, { copies: 1, density: 'normal' });
    job.image.data[0] = 128;
    job.labelLengthDots += 5;
    const result = checkJob(job, prepared.geometry, LW550_HEAD, doc);
    const text = result.rows
      .filter((r) => r.state !== 'ok')
      .map((r) => r.message)
      .join('\n');
    expect(text).toMatch(/Lunghezza etichetta/);
    expect(text).toMatch(/pixel grigi/);
    expect(text).toMatch(/escono dall’etichetta/);
  });
});

describe('testo completo e condivisione', () => {
  it('riepilogo in cima, registro in fondo, nessun testo dell’etichetta', async () => {
    const doc = addressDoc();
    doc.elements.push(createTextElement({ x: 2, y: 2, width: 40, height: 10 }, 'Barattolo zucchero segreto'));
    const report = await runPrinterCheck(await probeOf({ fault: 'nfc-timeout' }), context({ doc }));
    const log = new DiagnosticLog();
    log.add('app', 'evento di prova');
    const text = fullReportText({
      when: new Date(2026, 10, 3, 17, 5),
      app: APP,
      printer: report,
      testPrint: {
        printedAt: new Date(2026, 10, 3, 17, 6),
        border: 'manca a sinistra',
        missingTicks: { left: '6', right: '', top: '', bottom: '' },
      },
      log,
    });
    expect(text.startsWith('Etichettatrice – diagnostica 2026-11-03 17:05')).toBe(true);
    expect(text.indexOf('RIEPILOGO')).toBeLessThan(text.indexOf('Prova LabelWriter 550'));
    expect(text.indexOf('Stampa di prova')).toBeLessThan(text.indexOf('Prova LabelWriter 550'));
    expect(text.indexOf('Registro degli eventi')).toBeGreaterThan(text.indexOf('Prova LabelWriter 550'));
    expect(text).toContain('Bordo esterno: manca a sinistra');
    expect(text).toContain('sinistra 6');
    expect(text).toContain('Serie: …0001');
    expect(text).not.toContain('zucchero');
  });

  it('condivisione: testo, file per testi lunghi, annullamento senza errore', async () => {
    const calls: ShareData[] = [];
    const nav = {
      share: async (d: ShareData) => {
        calls.push(d);
      },
      canShare: () => true,
    } as unknown as Navigator;
    expect(canShare(nav)).toBe(true);
    expect(await shareText('T', 'breve', nav)).toBe('shared');
    expect(calls[0]).toEqual({ title: 'T', text: 'breve' });
    expect(await shareText('T', 'x'.repeat(30_000), nav, new Date(2026, 10, 3, 9, 5))).toBe('shared');
    expect(calls[1]?.files?.[0]?.name).toBe('diagnostica-2026-11-03-0905.txt');
    expect(shareFileName(new Date(2026, 0, 2, 3, 4))).toBe('diagnostica-2026-01-02-0304.txt');

    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    const cancelling = { share: async () => Promise.reject(abort) } as unknown as Navigator;
    expect(await shareText('T', 'x', cancelling)).toBe('cancelled');
    expect(await shareText('T', 'x', {} as Navigator)).toBe('unsupported');
  });
});

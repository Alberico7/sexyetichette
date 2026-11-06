/**
 * Prova completa della LabelWriter 550 collegata, con soli comandi di lettura
 * (`ESC V`, `ESC A`, `ESC U`) e un controllo del lavoro di stampa che non viene
 * inviato. Logica pura: riceve la porta della stampante e il contesto dell'app.
 */
import {
  EDGE_SAFETY_DOTS,
  computeGeometry,
  documentGeometry,
  type HeadSpec,
  type LabelGeometry,
} from '@/model/geometry';
import type { LabelDocument, MediaFormat } from '@/model/types';
import { dotsToMm } from '@/model/units';
import {
  LW550_PRODUCT_ID,
  LW550_TURBO_PRODUCT_ID,
  LW550_VENDOR_ID,
  findMediaBySku,
  sameMediaSize,
} from '@/printer/media';
import { buildJob } from '@/printer/print-flow';
import type {
  Density,
  DetailRow,
  MediaReadResult,
  PrinterInfo,
  PrinterProbe,
  ProbeResult,
  RawStatusInfo,
} from '@/printer/types';
import { endpointText, hex4Id } from '@/printer/usb-diagnostics';
import type { PreparedLabel } from '@/render/export';
import { checkJob } from './job-check';
import { describeError } from './log';
import { toHex } from './hex';

export type CheckStepState = 'ok' | 'warn' | 'fail' | 'info' | 'skip';

export interface CheckStep {
  id: 'app' | 'device' | 'version' | 'status' | 'media' | 'geometry' | 'job' | 'settings';
  title: string;
  state: CheckStepState;
  message: string;
  ms?: number;
  details: DetailRow[];
}

export interface Problem {
  severity: 'grave' | 'avviso';
  message: string;
}

export interface PrinterCheckReport {
  at: Date;
  steps: CheckStep[];
  problems: Problem[];
  summary: string;
  /** Ultima lettura del rotolo riuscita, se c'è. */
  media?: MediaReadResult;
}

export interface CheckContext {
  app: { version: string; commit: string; builtAt: string };
  env: { userAgent: string; secureContext: boolean; webUsb: boolean; screen: string };
  info: PrinterInfo | null;
  doc: LabelDocument;
  head: HeadSpec;
  settings: { density: Density; copies: number };
  /** Rendering dell'etichetta a 300 dpi; assente = controllo del lavoro saltato. */
  prepare?: (doc: LabelDocument) => Promise<PreparedLabel>;
  /** Un testo con adattamento automatico non entra nel suo riquadro. */
  overflow?: boolean;
  /** Ripetizioni di stato e rotolo (predefinito 3). */
  repeats?: number;
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

export const DENSITY_NAMES: Record<Density, string> = {
  light: 'chiara',
  medium: 'media',
  normal: 'normale',
  high: 'scura',
};

const PRINT_STATUS: Record<number, string> = {
  0: 'inattiva',
  1: 'in stampa',
  2: 'errore',
  5: 'lock tenuto da un altro host',
};

const mm = (dots: number) => `${dotsToMm(dots).toFixed(1).replace('.', ',')} mm`;

export function formatSize(media: MediaFormat): string {
  const n = (v: number) => String(v).replace('.', ',');
  return media.lengthMm === undefined
    ? `${n(media.widthMm)} mm continuo`
    : `${n(media.widthMm)}×${n(media.lengthMm)} mm`;
}

export function geometryRows(prefix: string, g: LabelGeometry): DetailRow[] {
  return [
    {
      label: `${prefix}: etichetta`,
      value: `${g.label.width}×${g.label.height} punti (${mm(g.label.width)} × ${mm(g.label.height)})`,
    },
    {
      label: `${prefix}: area stampabile`,
      value: `x ${g.printable.x}, y ${g.printable.y}, ${g.printable.width}×${g.printable.height} punti`,
    },
    {
      label: `${prefix}: zone non stampabili`,
      value: g.deadZones.length
        ? g.deadZones.map((z) => `${z.width}×${z.height} punti a x ${z.x}, y ${z.y}`).join('; ')
        : 'nessuna',
    },
    {
      label: `${prefix}: area consigliata (margine di sicurezza ${EDGE_SAFETY_DOTS} punti sui bordi lunghi)`,
      value: `x ${g.safe.x}, y ${g.safe.y}, ${g.safe.width}×${g.safe.height} punti`,
    },
    { label: `${prefix}: rotazione verso la testina`, value: `${g.wireRotation}°` },
    { label: `${prefix}: punti attraverso / lungo`, value: `${g.crossDots} / ${g.feedDots}` },
  ];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function runPrinterCheck(
  probe: PrinterProbe,
  ctx: CheckContext,
  onProgress?: (steps: readonly CheckStep[]) => void,
): Promise<PrinterCheckReport> {
  const steps: CheckStep[] = [];
  const problems: Problem[] = [];
  const repeats = ctx.repeats ?? 3;
  const pause = ctx.pauseMs ?? 500;
  const sleep = ctx.sleep ?? defaultSleep;
  const add = (step: CheckStep) => {
    steps.push(step);
    onProgress?.(steps);
  };
  const problem = (severity: Problem['severity'], message: string) => problems.push({ severity, message });

  // 1. Browser e app
  add({
    id: 'app',
    title: 'Browser e app',
    state: ctx.env.secureContext && ctx.env.webUsb ? 'ok' : 'fail',
    message: `App ${ctx.app.version} (${ctx.app.commit}${ctx.app.builtAt ? `, ${ctx.app.builtAt}` : ''})`,
    details: [
      { label: 'Browser', value: ctx.env.userAgent },
      { label: 'Pagina sicura', value: ctx.env.secureContext ? 'sì' : 'no' },
      { label: 'WebUSB', value: ctx.env.webUsb ? 'presente' : 'assente' },
      { label: 'Schermo', value: ctx.env.screen },
    ],
  });

  // 2. Dispositivo
  const dev = probe.device();
  if (!dev) {
    add({
      id: 'device',
      title: 'Dispositivo USB',
      state: 'info',
      message: 'Descrittori USB non disponibili.',
      details: [],
    });
  } else {
    const known =
      dev.vendorId === LW550_VENDOR_ID &&
      (dev.productId === LW550_PRODUCT_ID || dev.productId === LW550_TURBO_PRODUCT_ID);
    const turbo = dev.productId === LW550_TURBO_PRODUCT_ID;
    const details: DetailRow[] = [
      { label: 'Nome', value: `${dev.manufacturerName} – ${dev.productName}` },
      { label: 'ID', value: `${hex4Id(dev.vendorId)}:${hex4Id(dev.productId)}` },
      { label: 'USB / versione dispositivo', value: `${dev.usbVersion} / ${dev.deviceVersion}` },
    ];
    if (dev.serialTail) details.push({ label: 'Serie', value: dev.serialTail });
    for (const i of dev.interfaces) {
      details.push({
        label: `Interfaccia ${i.number}`,
        value: `${i.className}${i.claimed ? ' (in uso dall’app)' : ''} · ${i.endpoints.map(endpointText).join(', ') || 'nessun endpoint'}`,
      });
    }
    if (!known) problem('grave', 'Il dispositivo collegato non è una LabelWriter 550.');
    if (turbo) problem('avviso', 'LabelWriter 550 Turbo: modello non verificato con questa app.');
    add({
      id: 'device',
      title: 'Dispositivo USB',
      state: known ? (turbo ? 'warn' : 'ok') : 'fail',
      message: known
        ? turbo
          ? 'LabelWriter 550 Turbo (non verificata)'
          : 'LabelWriter 550'
        : 'Modello non riconosciuto',
      details,
    });
  }

  // 3. Versione (ESC V)
  const version = await probe.version();
  {
    const details: DetailRow[] = [];
    let state: CheckStepState = version.ok ? 'ok' : 'fail';
    let message = 'Versione non letta.';
    if (version.value) {
      const v = version.value;
      details.push(
        { label: 'Hardware', value: v.hardware || '–' },
        { label: 'Firmware', value: `${v.firmware} (${v.firmwareKind})` },
        { label: 'Data del firmware', value: v.firmwareDate || '–' },
        { label: 'Codice prodotto interno', value: hex4Id(v.pid) },
      );
      message = `Firmware ${v.firmware}, hardware ${v.hardware || '–'}`;
      if (v.firmwareKind === 'bootloader') {
        state = 'fail';
        problem('grave', 'La stampante è in modalità bootloader (aggiornamento firmware): non può stampare.');
      }
      if (dev && v.pid !== 0 && v.pid !== dev.productId) {
        state = 'warn';
        details.push({
          label: 'Attenzione',
          value: `codice interno ${hex4Id(v.pid)} diverso dal codice USB ${hex4Id(dev.productId)}`,
        });
      }
    } else {
      problem('avviso', 'La stampante non ha risposto alla richiesta della versione (ESC V).');
    }
    if (version.error) details.push({ label: 'Errore', value: version.error });
    if (version.bytes) details.push({ label: 'Byte ricevuti', value: toHex(version.bytes) });
    add({ id: 'version', title: 'Versione della stampante (ESC V)', state, message, ms: version.ms, details });
  }

  // 4. Stato (ESC A), più volte
  {
    const reads: ProbeResult<RawStatusInfo>[] = [];
    for (let i = 0; i < repeats; i++) {
      if (i > 0) await sleep(pause);
      reads.push(await probe.status());
    }
    const ok = reads.filter((r) => r.ok);
    const details: DetailRow[] = reads.map((r, i) => ({
      label: `Lettura ${i + 1}`,
      value: r.ok
        ? `${r.ms} ms · ${r.value?.printStatus !== undefined ? `stato ${r.value.printStatus} (${PRINT_STATUS[r.value.printStatus] ?? '?'})` : ''} · ${r.bytes ? toHex(r.bytes) : 'byte non disponibili'}`
        : `${r.ms} ms · errore: ${r.error ?? '?'}`,
    }));
    const last = ok.at(-1)?.value;
    let state: CheckStepState = ok.length === reads.length ? 'ok' : ok.length === 0 ? 'fail' : 'warn';
    let message: string;
    if (!last) {
      message = 'Nessuna risposta allo stato.';
      problem(
        'grave',
        `La stampante non risponde alla richiesta di stato (${reads.length} tentativi su ${reads.length}).`,
      );
    } else {
      const s = last.status;
      message = `${s.ready ? 'Pronta' : 'Non pronta'}, rotolo ${s.mediaLoaded ? 'presente' : 'assente'}${s.problems.length ? `, ${s.problems.map((p) => p.title).join(', ')}` : ''}`;
      details.push(
        { label: 'Pronta', value: s.ready ? 'sì' : 'no' },
        { label: 'Rotolo presente', value: s.mediaLoaded ? 'sì' : 'no' },
      );
      for (const p of s.problems) {
        details.push({
          label: p.warning ? 'Avviso' : 'Problema',
          value: `${p.title}${p.detail ? ` (${p.detail})` : ''}`,
        });
        problem(p.warning ? 'avviso' : 'grave', `Stato della stampante: ${p.title}.`);
      }
      for (const d of s.details) details.push({ label: `Libreria: ${d.label}`, value: d.value });
      if (last.printStatus === 5)
        problem('grave', 'Il lock di stampa è tenuto da un altro host (un altro programma o dispositivo).');
      if (ok.length < reads.length)
        problem('avviso', `Stato instabile: ${reads.length - ok.length} letture su ${reads.length} fallite.`);
      const slow = ok.filter((r) => r.ms > 1000).length;
      if (slow > 0) {
        if (state === 'ok') state = 'warn';
        problem('avviso', `Stato lento: ${slow} risposte oltre 1 secondo.`);
      }
      const distinct = new Set(ok.map((r) => (r.bytes ? toHex(r.bytes) : ''))).size;
      if (distinct > 1) details.push({ label: 'Differenze', value: `${distinct} risposte diverse tra le letture` });
    }
    add({
      id: 'status',
      title: `Stato (ESC A) × ${repeats}`,
      state,
      message,
      ms: Math.round(reads.reduce((s, r) => s + r.ms, 0) / reads.length),
      details,
    });
  }

  // 5. Rotolo (ESC U), più volte
  let media: MediaReadResult | undefined;
  {
    const reads: MediaReadResult[] = [];
    const times: number[] = [];
    for (let i = 0; i < repeats; i++) {
      if (i > 0) await sleep(pause);
      const start = performance.now();
      try {
        reads.push(await probe.media());
      } catch (err) {
        reads.push({
          ok: false,
          reason: 'error',
          message: 'Errore durante la lettura del rotolo.',
          detail: describeError(err),
          attempts: 1,
        });
      }
      times.push(Math.round(performance.now() - start));
    }
    const okReads = reads.filter((r): r is Extract<MediaReadResult, { ok: true }> => r.ok);
    media = okReads[0] ?? reads[0];
    const details: DetailRow[] = reads.map((r, i) => ({
      label: `Lettura ${i + 1}`,
      value: `${times[i]} ms · ${r.ok ? `ok, codice ${r.detected.sku || '–'}` : `${r.reason}: ${r.detail}`}${r.bytes ? ` · ${r.bytes.length} byte` : ''}`,
    }));
    for (const [i, r] of reads.entries()) {
      if (r.bytes) details.push({ label: `Byte lettura ${i + 1}`, value: toHex(r.bytes) });
    }
    let state: CheckStepState;
    let message: string;
    const first = okReads[0];
    if (!first) {
      state = 'fail';
      const r = reads[0] as Extract<MediaReadResult, { ok: false }> | undefined;
      message = r ? r.message : 'Rotolo non letto.';
      problem('grave', `Rotolo non letto (${reads.length} tentativi su ${reads.length}): ${r?.message ?? '?'}`);
    } else {
      state = okReads.length === reads.length ? 'ok' : 'warn';
      const d = first.detected;
      message = `${d.media.name} (codice ${d.sku || '–'})`;
      for (const f of first.fields) details.push({ label: `Tag: ${f.label}`, value: f.value });
      const entry = d.sku ? findMediaBySku(d.sku) : undefined;
      if (!entry) {
        details.push({
          label: 'Catalogo',
          value: `codice «${d.sku || '(vuoto)'}» non nel catalogo: uso le misure del tag (${formatSize(d.media)})`,
        });
        problem(
          'avviso',
          `Codice del rotolo «${d.sku || '(vuoto)'}» non nel catalogo dell’app: verranno usate le misure lette dal tag.`,
        );
      } else {
        details.push({ label: 'Catalogo', value: `${entry.name}` });
      }
      if (okReads.length < reads.length)
        problem(
          'avviso',
          `Lettura del rotolo instabile: ${reads.length - okReads.length} letture su ${reads.length} fallite.`,
        );
      const sizes = new Set(okReads.map((r) => formatSize(r.detected.media))).size;
      if (sizes > 1) problem('avviso', 'Letture del rotolo diverse tra loro.');
      if (!sameMediaSize(d.media, ctx.doc.media)) {
        problem(
          'avviso',
          `Il formato scelto (${formatSize(ctx.doc.media)}) è diverso dal rotolo (${formatSize(d.media)}).`,
        );
      }
    }
    add({ id: 'media', title: `Rotolo (ESC U) × ${repeats}`, state, message, details });
  }

  // 6. Formato e geometria
  {
    const g = documentGeometry(ctx.doc, ctx.head);
    const details: DetailRow[] = [
      { label: 'Formato scelto', value: `${ctx.doc.media.name} (${ctx.doc.media.id}), ${formatSize(ctx.doc.media)}` },
      {
        label: 'Verso del contenuto',
        value: ctx.doc.direction === 'along' ? 'lungo il rotolo' : 'attraverso il rotolo',
      },
      ...geometryRows('Scelto', g),
      {
        label: 'Testina',
        value: `${ctx.head.headDots} punti a ${ctx.head.dpi} dpi, zona iniziale ${ctx.head.leadingDots}, finale ${ctx.head.trailingDots}`,
      },
    ];
    let state: CheckStepState = 'ok';
    if (media?.ok) {
      const dm = media.detected.media;
      details.push({ label: 'Formato del rotolo', value: `${dm.name}, ${formatSize(dm)}` });
      details.push(
        ...geometryRows('Rotolo', computeGeometry(dm, ctx.doc.direction, ctx.doc.continuousLengthMm, ctx.head)),
      );
      if (!sameMediaSize(dm, ctx.doc.media)) state = 'warn';
    }
    add({
      id: 'geometry',
      title: 'Formato e geometria',
      state,
      message: `${formatSize(ctx.doc.media)}, ${g.crossDots}×${g.feedDots} punti`,
      details,
    });
  }

  // 7. Controllo del lavoro, senza inviarlo
  if (ctx.prepare) {
    const start = performance.now();
    try {
      const prepared = await ctx.prepare(ctx.doc);
      const job = buildJob(ctx.doc, prepared, { copies: 1, density: ctx.settings.density });
      const result = checkJob(job, prepared.geometry, ctx.head, ctx.doc);
      if (ctx.overflow)
        result.rows.push({
          state: 'warn',
          message: 'Un testo non entra nel suo riquadro ed è stampato alla dimensione minima.',
        });
      const worst = result.rows.some((r) => r.state === 'fail')
        ? 'fail'
        : result.rows.some((r) => r.state === 'warn')
          ? 'warn'
          : 'ok';
      const empty = ctx.doc.elements.length === 0;
      for (const r of result.rows) {
        // Un'etichetta ancora vuota non è un problema della stampante.
        if (r.state === 'ok' || (empty && r.state === 'warn')) continue;
        problem(r.state === 'fail' ? 'grave' : 'avviso', `Lavoro di stampa: ${r.message}`);
      }
      if (empty) result.rows.push({ state: 'ok', message: 'Etichetta ancora vuota: controllati formato e codifica.' });
      add({
        id: 'job',
        title: 'Lavoro di stampa (non inviato)',
        state: worst,
        message: `${result.stats.widthDots}×${result.stats.lines} punti, ${result.stats.blackDots} neri${result.stats.encodedBytes ? `, ${result.stats.encodedBytes} byte per copia` : ''}`,
        ms: Math.round(performance.now() - start),
        details: result.rows.map((r) => ({
          label: r.state === 'ok' ? '✓' : r.state === 'warn' ? '!' : '✗',
          value: r.message,
        })),
      });
    } catch (err) {
      problem('grave', `Preparazione del lavoro di stampa non riuscita: ${describeError(err)}`);
      add({
        id: 'job',
        title: 'Lavoro di stampa (non inviato)',
        state: 'fail',
        message: 'Preparazione non riuscita.',
        details: [{ label: 'Errore', value: describeError(err) }],
      });
    }
  } else {
    add({ id: 'job', title: 'Lavoro di stampa (non inviato)', state: 'skip', message: 'Non eseguito.', details: [] });
  }

  // 8. Impostazioni
  add({
    id: 'settings',
    title: 'Impostazioni',
    state: 'info',
    message: `Densità ${DENSITY_NAMES[ctx.settings.density]}, copie ${ctx.settings.copies}`,
    details: [
      { label: 'Elementi sull’etichetta', value: String(ctx.doc.elements.length) },
      { label: 'Lunghezza continua', value: `${ctx.doc.continuousLengthMm} mm` },
      ...(ctx.info
        ? [
            {
              label: 'Modello (libreria)',
              value: `${ctx.info.model} (${ctx.info.key})${ctx.info.verified ? '' : ', non verificato'}`,
            },
          ]
        : []),
    ],
  });

  problems.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'grave' ? -1 : 1));
  const graves = problems.filter((p) => p.severity === 'grave').length;
  const summary =
    problems.length === 0
      ? 'Nessun problema trovato nelle prove di lettura. Prova ora la stampa di prova.'
      : graves > 0
        ? `${graves} problema/i grave/i e ${problems.length - graves} avviso/i.`
        : `${problems.length} avviso/i, nessun problema grave.`;
  const report: PrinterCheckReport = { at: new Date(), steps, problems, summary };
  if (media) report.media = media;
  return report;
}

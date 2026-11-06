/**
 * Flusso di stampa, indipendente dall'interfaccia:
 * controllo dello stato → rendering a 300 dpi → bitmap a 1 bit → invio.
 */
import type { LabelDocument } from '@/model/types';
import type { PreparedLabel } from '@/render/export';
import { printHistory, type PrintRecord } from '@/diagnostics/print-history';
import { AppErrorException, unwrapError } from './errors';
import { LW550_HEAD } from './media';
import type { Density, PrintControl, PrintJob, PrintOutcome, PrinterPort, UsbPrintCounts } from './types';

export const MAX_COPIES = 99;

export interface PrintSettings {
  copies: number;
  density: Density;
}

export function clampCopies(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_COPIES, Math.max(1, Math.round(n)));
}

export function buildJob(doc: LabelDocument, prepared: PreparedLabel, settings: PrintSettings): PrintJob {
  return {
    image: prepared.wireImage,
    media: doc.media,
    labelLengthDots: prepared.geometry.feedDots,
    copies: clampCopies(settings.copies),
    density: settings.density,
  };
}

export async function runPrint(
  port: PrinterPort,
  doc: LabelDocument,
  settings: PrintSettings,
  // Import dinamico: il rendering richiede il DOM, il flusso no (testabile in Node).
  prepare: (doc: LabelDocument) => Promise<PreparedLabel> = async (d) =>
    (await import('@/render/export')).prepareLabel(d, LW550_HEAD),
  control?: PrintControl,
): Promise<PrintJob & { outcome: PrintOutcome }> {
  await precheck(port);
  const prepared = await prepare(doc);
  const job = buildJob(doc, prepared, settings);
  const outcome = await send(port, job, control);
  return { ...job, outcome };
}

/**
 * Invia il lavoro e lo annota in «Ultime stampe» (un solo punto per stampante
 * vera e simulata; la vera aggiunge i conteggi letti dal traffico USB).
 */
async function send(port: PrinterPort, job: PrintJob, control?: PrintControl): Promise<PrintOutcome> {
  const record: PrintRecord = { at: Date.now(), copies: job.copies, density: job.density, media: job.media.id };
  const fill = (sent: number, usb?: UsbPrintCounts) => {
    record.labelsSent = usb?.labelsSent ?? sent;
    if (usb?.remainingBefore !== undefined) record.remainingBefore = usb.remainingBefore;
    if (usb?.remainingAfter !== undefined) record.remainingAfter = usb.remainingAfter;
  };
  try {
    const outcome = await port.print(job, control);
    record.mode = outcome.mode;
    fill(outcome.sent, outcome.usb);
    if (outcome.stopped) record.stoppedAfter = outcome.sent;
    return outcome;
  } catch (err) {
    const e = unwrapError(err);
    record.error = e.detail ? `${e.title}: ${e.detail}` : e.title;
    if (e.partial) fill(e.partial.sent, e.partial.usb);
    throw err;
  } finally {
    printHistory.add(record);
  }
}

/** Controllo preventivo: messaggi più chiari di quelli del driver. */
async function precheck(port: PrinterPort): Promise<void> {
  const status = await port.getStatus();
  const blocking = status.problems.find((p) => !p.warning);
  if (blocking) throw new AppErrorException(blocking);
}

/** Stampa un lavoro già pronto (per esempio l'etichetta di prova). */
export async function runJob(port: PrinterPort, job: PrintJob, control?: PrintControl): Promise<PrintOutcome> {
  await precheck(port);
  return send(port, job, control);
}

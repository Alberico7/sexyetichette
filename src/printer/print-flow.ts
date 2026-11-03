/**
 * Flusso di stampa, indipendente dall'interfaccia:
 * controllo dello stato → rendering a 300 dpi → bitmap a 1 bit → invio.
 */
import type { LabelDocument } from '@/model/types';
import type { PreparedLabel } from '@/render/export';
import { AppErrorException } from './errors';
import { LW550_HEAD } from './media';
import type { Density, PrintJob, PrinterPort } from './types';

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
): Promise<PrintJob> {
  await precheck(port);
  const prepared = await prepare(doc);
  const job = buildJob(doc, prepared, settings);
  await port.print(job);
  return job;
}

/** Controllo preventivo: messaggi più chiari di quelli del driver. */
async function precheck(port: PrinterPort): Promise<void> {
  const status = await port.getStatus();
  const blocking = status.problems.find((p) => !p.warning);
  if (blocking) throw new AppErrorException(blocking);
}

/** Stampa un lavoro già pronto (per esempio l'etichetta di prova). */
export async function runJob(port: PrinterPort, job: PrintJob): Promise<void> {
  await precheck(port);
  await port.print(job);
}

/**
 * Controllo del lavoro di stampa senza inviarlo alla stampante.
 *
 * Verifica che l'immagine preparata dall'app abbia le dimensioni attese dalla
 * geometria, che sia solo bianco e nero, e che la libreria la codifichi per la
 * 550 senza cambiarla (stesse righe, 84 byte per riga, stessi punti neri).
 */
import { renderImage } from '@mbtech-nl/bitmap';
import { DEVICES, compose550Job } from '@thermal-label/labelwriter-core';
import type { HeadSpec, LabelGeometry } from '@/model/geometry';
import type { LabelDocument } from '@/model/types';
import { dotsToMm } from '@/model/units';
import { findMediaById } from '@/printer/media';
import { countBlack, toWireBitmap } from '@/printer/raster';
import type { PrintJob } from '@/printer/types';

/** Controlli di coerenza sul lavoro: lanciano un errore se qualcosa non torna. */
export function validateJob(job: PrintJob, head: HeadSpec = { dpi: 300, headDots: 672, leadingDots: 0, trailingDots: 0 }): void {
  const { image } = job;
  if (image.width <= 0 || image.height <= 0) throw new Error('Immagine vuota');
  if (image.width > head.headDots) {
    throw new Error(`Immagine larga ${image.width} punti: la testina ne ha ${head.headDots}`);
  }
  if (image.data.length !== image.width * image.height * 4) throw new Error('Dimensione dati RGBA errata');
  if (job.copies < 1 || !Number.isInteger(job.copies)) throw new Error('Numero di copie non valido');
  if (job.labelLengthDots < image.height) throw new Error('Lunghezza etichetta minore dell’immagine');
  if (!findMediaById(job.media.id) && !job.media.id.startsWith('custom') && !job.media.id.startsWith('nfc')) {
    throw new Error(`Formato sconosciuto: ${job.media.id}`);
  }
}

export type CheckState = 'ok' | 'warn' | 'fail';

export interface CheckRow {
  state: CheckState;
  message: string;
}

export interface JobCheck {
  rows: CheckRow[];
  stats: {
    widthDots: number;
    lines: number;
    blackDots: number;
    bytesPerLine?: number;
    encodedBytes?: number;
  };
}

/** Punti lungo l'avanzamento dell'area stampabile. */
function printableFeed(g: LabelGeometry): number {
  return g.wireRotation === 90 ? g.printable.width : g.printable.height;
}

export function checkJob(job: PrintJob, geometry: LabelGeometry, head: HeadSpec, doc?: LabelDocument): JobCheck {
  const rows: CheckRow[] = [];
  const push = (ok: boolean, okText: string, failText: string, level: CheckState = 'fail') =>
    rows.push(ok ? { state: 'ok', message: okText } : { state: level, message: failText });
  const { image } = job;

  try {
    validateJob(job, head);
    rows.push({ state: 'ok', message: 'Lavoro coerente (dimensioni, copie, formato).' });
  } catch (err) {
    rows.push({ state: 'fail', message: `Lavoro non valido: ${err instanceof Error ? err.message : String(err)}` });
  }

  push(
    image.width === geometry.crossDots && image.width <= head.headDots,
    `Larghezza ${image.width} punti = larghezza dell’etichetta (testina ${head.headDots}).`,
    `Larghezza ${image.width} punti, attesi ${geometry.crossDots} (testina ${head.headDots}).`,
  );
  const feed = printableFeed(geometry);
  push(
    image.height === feed,
    `Righe ${image.height} = area stampabile lungo il rotolo.`,
    `Righe ${image.height}, attese ${feed}.`,
  );
  const dead = geometry.feedDots - feed;
  push(
    job.labelLengthDots === geometry.feedDots && image.height + dead === job.labelLengthDots,
    `Etichetta ${job.labelLengthDots} punti = ${image.height} stampabili + ${dead} di zona non stampabile: nessun punto nella zona non stampabile.`,
    `Lunghezza etichetta ${job.labelLengthDots} punti, attesa ${geometry.feedDots} (${image.height} + ${dead}).`,
  );

  let grey = 0;
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i]!;
    if ((r !== 0 && r !== 255) || image.data[i + 1] !== r || image.data[i + 2] !== r) grey++;
  }
  push(grey === 0, 'Solo pixel bianchi o neri: l’anteprima è esattamente ciò che si stampa.', `${grey} pixel grigi: il driver li retinerà e la stampa differirà dall’anteprima.`);

  const ours = toWireBitmap(image, { rotate: 0 });
  const blackDots = countBlack(ours);
  push(blackDots > 0, `${blackDots} punti neri.`, 'Etichetta vuota: nessun punto nero.', 'warn');

  const stats: JobCheck['stats'] = { widthDots: image.width, lines: image.height, blackDots };
  try {
    const driver = renderImage(image, { dither: true, rotate: 0 });
    const composed = compose550Job(DEVICES.LW_550, driver, { copies: 1, density: job.density, labelLengthDots: job.labelLengthDots });
    const label = composed.labels[0]!;
    const bytesPerLine = head.headDots / 8;
    // ESC n (4 byte) + ESC D (12 byte) + righe + ESC G (2 byte)
    const rasterBytes = label.length - 4 - 12 - 2;
    const lines = label[8]! | (label[9]! << 8) | (label[10]! << 16) | (label[11]! << 24);
    stats.bytesPerLine = bytesPerLine;
    stats.encodedBytes = composed.preamble.length + label.length + composed.finalize.length;
    push(
      lines === image.height && rasterBytes === lines * bytesPerLine,
      `Codifica della libreria: ${lines} righe × ${bytesPerLine} byte.`,
      `Codifica della libreria inattesa: ${lines} righe, ${rasterBytes} byte di immagine.`,
    );
    push(
      countBlack(driver) === blackDots,
      'Il driver non cambia l’immagine (stessi punti neri).',
      `Il driver cambia l’immagine: ${countBlack(driver)} punti neri invece di ${blackDots}.`,
    );
  } catch (err) {
    rows.push({ state: 'fail', message: `Codifica della libreria non riuscita: ${err instanceof Error ? err.message : String(err)}` });
  }

  if (doc) {
    const wMm = dotsToMm(geometry.label.width);
    const hMm = dotsToMm(geometry.label.height);
    const outside = doc.elements.filter(
      (el) => el.rotation % 360 === 0 && (el.x < -0.5 || el.y < -0.5 || el.x + el.width > wMm + 0.5 || el.y + el.height > hMm + 0.5),
    ).length;
    push(outside === 0, 'Tutti gli elementi sono dentro l’etichetta.', `${outside} elemento/i escono dall’etichetta e verranno tagliati.`, 'warn');
  }

  return { rows, stats };
}

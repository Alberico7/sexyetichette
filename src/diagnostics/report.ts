/**
 * Testo completo della diagnostica, da copiare o condividere.
 * Ordine: riepilogo, prove, risposte sulla stampa di prova, registro.
 * Nessun dato personale: niente testi delle etichette, serie troncato.
 */
import type { MediaReadResult } from '@/printer/types';
import { reportToText, type DiagnosticReport } from '@/printer/usb-diagnostics';
import type { DiagnosticLog } from './log';
import { mediaReadToText } from './media-read';
import type { PrinterCheckReport } from './printer-check';

export interface TestPrintAnswers {
  printedAt?: Date;
  format?: string;
  density?: string;
  error?: string;
  border?: string;
  orientation?: string;
  firstOut?: string;
  missingTicks?: { left: string; right: string; top: string; bottom: string };
  darkness?: string;
}

export interface FullReportInput {
  when?: Date;
  app: { version: string; commit: string; builtAt: string };
  printer?: PrinterCheckReport | null;
  usb?: DiagnosticReport | null;
  media?: MediaReadResult | null;
  testPrint?: TestPrintAnswers | null;
  log?: DiagnosticLog | null;
}

const ICONS = { ok: '✓', warn: '!', fail: '✗', info: 'i', skip: '–' } as const;

export function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function testPrintToText(t: TestPrintAnswers): string {
  const lines = ['Stampa di prova:'];
  if (t.printedAt) lines.push(`  Stampata: ${stamp(t.printedAt)}${t.format ? `, formato ${t.format}` : ''}${t.density ? `, densità ${t.density}` : ''}`);
  if (t.error) lines.push(`  Errore: ${t.error}`);
  const ans = (label: string, v?: string) => lines.push(`  ${label}: ${v || '(senza risposta)'}`);
  ans('Bordo esterno', t.border);
  ans('Scritta «ALTO»', t.orientation);
  ans('Lato uscito per primo', t.firstOut);
  if (t.missingTicks) {
    const m = t.missingTicks;
    lines.push(`  Tacche mancanti o tagliate (mm): sinistra ${m.left || '?'}, destra ${m.right || '?'}, alto ${m.top || '?'}, basso ${m.bottom || '?'}`);
  } else {
    ans('Tacche mancanti', undefined);
  }
  ans('Nitidezza', t.darkness);
  return lines.join('\n');
}

export function printerCheckToText(r: PrinterCheckReport): string {
  const lines = ['Prova LabelWriter 550:'];
  for (const s of r.steps) {
    lines.push(`${ICONS[s.state]} ${s.title}: ${s.message}${s.ms !== undefined ? ` (${s.ms} ms)` : ''}`);
    for (const d of s.details) lines.push(`    ${d.label}: ${d.value}`);
  }
  return lines.join('\n');
}

export function fullReportText(input: FullReportInput): string {
  const when = input.when ?? new Date();
  const out: string[] = [
    `Etichettatrice – diagnostica ${stamp(when)}`,
    `App ${input.app.version} (${input.app.commit}${input.app.builtAt ? `, build ${input.app.builtAt}` : ''})`,
    '',
  ];
  if (input.printer) {
    out.push(`RIEPILOGO: ${input.printer.summary}`);
    for (const p of input.printer.problems) out.push(`  ${p.severity === 'grave' ? '✗' : '!'} ${p.message}`);
    out.push('');
  }
  if (input.testPrint) out.push(testPrintToText(input.testPrint), '');
  if (input.printer) out.push(printerCheckToText(input.printer), '');
  if (input.media && !input.printer) out.push(mediaReadToText(input.media), '');
  if (input.usb) out.push(reportToText(input.usb, when), '');
  if (input.log) {
    out.push(`Registro degli eventi (${input.log.entries.length}):`);
    out.push(input.log.toText() || '(vuoto)');
  }
  return out.join('\n').trimEnd() + '\n';
}

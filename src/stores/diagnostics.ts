/**
 * Risultati della diagnostica della sessione: restano disponibili anche
 * chiudendo e riaprendo il pannello, fino al ricaricamento della pagina.
 */
import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import { APP_BUILD } from '@/app-info';
import { diagLog } from '@/diagnostics/log';
import { printHistory } from '@/diagnostics/print-history';
import type { PrinterCheckReport } from '@/diagnostics/printer-check';
import { fullReportText, stamp, type TestPrintAnswers } from '@/diagnostics/report';
import type { DiagnosticReport } from '@/printer/usb-diagnostics';
import { usePrinterStore } from './printer';

export const useDiagnosticsStore = defineStore('diagnostics', () => {
  const usbReport = shallowRef<DiagnosticReport | null>(null);
  const printerReport = shallowRef<PrinterCheckReport | null>(null);
  const testPrint = ref<TestPrintAnswers | null>(null);

  function fullText(when = new Date()): string {
    const printer = usePrinterStore();
    return fullReportText({
      when,
      app: APP_BUILD,
      printer: printerReport.value,
      usb: usbReport.value,
      media: printer.mediaRead,
      testPrint: testPrint.value,
      log: diagLog,
      prints: printHistory.toText(),
    });
  }

  function shareTitle(when = new Date()): string {
    return `Etichettatrice – diagnostica ${stamp(when)}`;
  }

  return { usbReport, printerReport, testPrint, fullText, shareTitle };
});

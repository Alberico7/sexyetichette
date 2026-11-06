/**
 * Stampa rapida: un tocco su «Stampa» manda subito il lavoro, senza il pannello
 * dell'anteprima. Se c'è qualcosa da guardare prima (stampante non pronta,
 * etichetta vuota, testo che non entra, formato diverso dal rotolo) non stampa
 * e chiede di aprire l'anteprima, che mostra l'avviso.
 * Vedi docs/2026-11-06-stampa-rapida.md.
 */
import { computed, ref } from 'vue';
import type { LabelDocument } from '@/model/types';
import { sameMediaSize } from '@/printer/media';
import { clampCopies } from '@/printer/print-flow';
import { countBlack } from '@/printer/raster';
import type { PreparedLabel } from '@/render/export';
import { resolveFontSize } from '@/render/scene';
import { useDocumentStore } from '@/stores/document';
import { usePreviewStore } from '@/stores/preview';
import { usePrinterStore } from '@/stores/printer';
import { useRecentStore } from '@/stores/recent';

export type QuickPrintResult = 'printed' | 'preview' | 'failed' | 'busy';

/** Condiviso fra tutti i pulsanti: un doppio tocco non stampa due volte. */
const busy = ref(false);

/** Avvisi che l'anteprima mostra e che fermano la stampa rapida. */
export function usePrintWarnings() {
  const store = useDocumentStore();
  const printer = usePrinterStore();
  const mismatch = computed(() => !!printer.detected && !sameMediaSize(printer.detected.media, store.doc.media));
  const overflow = computed(() =>
    store.doc.elements.some((el) => el.type === 'text' && el.autoFit && resolveFontSize(el).overflow),
  );
  return { mismatch, overflow };
}

export function useQuickPrint() {
  const store = useDocumentStore();
  const printer = usePrinterStore();
  const preview = usePreviewStore();
  const recent = useRecentStore();
  const { mismatch, overflow } = usePrintWarnings();
  const printing = computed(() => busy.value || printer.state === 'printing');

  async function print(copies = 1): Promise<QuickPrintResult> {
    if (printing.value) return 'busy';
    busy.value = true;
    try {
      if (printer.state !== 'connected' || printer.blockingProblems.length > 0 || mismatch.value || overflow.value) {
        return 'preview';
      }
      const snapshot = JSON.parse(JSON.stringify(store.doc)) as LabelDocument;
      let prepared: PreparedLabel;
      try {
        prepared = await preview.ensure();
      } catch {
        return 'preview';
      }
      if (countBlack(prepared.wireBitmap) === 0) return 'preview';
      // Copie passate direttamente: le copie del pannello di stampa non cambiano.
      const ok = await printer.print(snapshot, async () => prepared, clampCopies(copies));
      if (!ok) return 'failed';
      recent.add(snapshot, prepared);
      return 'printed';
    } finally {
      busy.value = false;
    }
  }

  return { print, printing };
}

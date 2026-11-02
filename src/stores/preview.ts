/**
 * Anteprima calcolata in sottofondo: 300 ms dopo l'ultima modifica, a piccoli
 * passi separati da un fotogramma, così l'interfaccia non si blocca.
 * Quando si apre il pannello di stampa il risultato è già pronto, e la stampa
 * usa esattamente lo stesso bitmap mostrato.
 */
import { defineStore } from 'pinia';
import { computed, ref, shallowRef, watch } from 'vue';
import type { LabelDocument } from '@/model/types';
import { LW550_HEAD } from '@/printer/media';
import { bitmapToRgba, countBlack, toWireBitmap } from '@/printer/raster';
import type { PreparedLabel } from '@/render/export';
import { renderPrintableRgba } from '@/render/export';
import { useDocumentStore } from './document';

export const PREVIEW_DELAY_MS = 300;

/** Cede il controllo al browser fino al prossimo fotogramma. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') setTimeout(resolve, 0);
    else requestAnimationFrame(() => resolve());
  });
}

/** Preparazione a passi: rendering, soglia e rotazione, conversione. */
export async function prepareInSteps(doc: LabelDocument): Promise<PreparedLabel> {
  const { image, geometry } = await renderPrintableRgba(doc, LW550_HEAD);
  await nextFrame();
  const wireBitmap = toWireBitmap(image, { rotate: geometry.wireRotation });
  await nextFrame();
  return { geometry, wireBitmap, wireImage: bitmapToRgba(wireBitmap) };
}

export const usePreviewStore = defineStore('preview', () => {
  const documents = useDocumentStore();
  /** Aumenta a ogni modifica del documento. */
  const version = ref(0);
  const prepared = shallowRef<PreparedLabel | null>(null);
  const preparedVersion = ref(-1);
  const inkDots = ref(0);
  const error = ref<string | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running: { version: number; promise: Promise<PreparedLabel> } | null = null;

  const ready = computed(() => prepared.value !== null && preparedVersion.value === version.value);

  watch(
    () => documents.doc,
    () => {
      version.value++;
      schedule();
    },
    { deep: true },
  );

  function schedule(delay = PREVIEW_DELAY_MS): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void compute().catch(() => {});
    }, delay);
  }

  /** Calcola l'anteprima della versione corrente (o riusa il calcolo già in corso). */
  function compute(): Promise<PreparedLabel> {
    const v = version.value;
    if (running && running.version === v) return running.promise;
    // Copia: se il documento cambia durante il calcolo, il risultato resta coerente.
    const snapshot = JSON.parse(JSON.stringify(documents.doc)) as LabelDocument;
    const promise = prepareInSteps(snapshot).then(
      (result) => {
        if (v >= preparedVersion.value) {
          prepared.value = result;
          preparedVersion.value = v;
          inkDots.value = countBlack(result.wireBitmap);
          error.value = null;
        }
        if (running?.version === v) running = null;
        return result;
      },
      (err: unknown) => {
        error.value = err instanceof Error ? err.message : String(err);
        if (running?.version === v) running = null;
        throw err;
      },
    );
    running = { version: v, promise };
    return promise;
  }

  /** Anteprima aggiornata al documento attuale: subito se già pronta. */
  async function ensure(): Promise<PreparedLabel> {
    if (prepared.value && preparedVersion.value === version.value) return prepared.value;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const result = await compute();
    // Se il documento è cambiato nel frattempo, ricalcola.
    return preparedVersion.value === version.value ? result : ensure();
  }

  // Prima anteprima all'avvio.
  schedule(0);

  return { version, prepared, preparedVersion, ready, inkDots, error, ensure, schedule };
});

/**
 * Formato dell'etichetta e rotolo letto dalla stampante.
 *
 * - Un'etichetta vuota prende il formato del rotolo appena viene letto.
 * - Stesso formato del rotolo ma con la misura arrotondata del catalogo
 *   (es. 25 invece di 25,4 mm): prende la misura vera del chip. Verso e testi
 *   (in mm dal bordo) restano come sono.
 *
 * Vedi docs/2026-11-05-margine-bordo-testina.md e docs/2026-11-06-riordino-app-vue.md.
 */
import { watch } from 'vue';
import { useDocumentStore } from '@/stores/document';
import { usePrinterStore } from '@/stores/printer';

export function useRollMedia(): void {
  const store = useDocumentStore();
  const printer = usePrinterStore();

  watch(
    () => printer.detected,
    (detected) => {
      if (detected && store.doc.elements.length === 0) store.setMedia(detected.media);
    },
  );

  watch(
    () => [printer.detected, store.doc.media.id, store.doc.media.widthMm, store.doc.media.lengthMm] as const,
    ([detected]) => {
      const roll = detected?.media;
      const cur = store.doc.media;
      if (!roll || roll.id !== cur.id) return;
      if (roll.widthMm !== cur.widthMm || roll.lengthMm !== cur.lengthMm || roll.lengthDots !== cur.lengthDots) {
        store.setMedia(roll, store.doc.direction);
      }
    },
    { immediate: true },
  );
}

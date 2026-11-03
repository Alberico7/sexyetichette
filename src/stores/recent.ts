/** Etichette stampate di recente, ricordate su questo dispositivo. */
import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import { newId } from '@/model/document';
import type { LabelDocument } from '@/model/types';
import type { PreparedLabel } from '@/render/export';
import { thumbnailDataUrl } from '@/render/thumbnail';
import { addRecent, loadRecents, saveRecents, type RecentLabel } from '@/storage/label-store';

export const useRecentStore = defineStore('recent', () => {
  const items = shallowRef<RecentLabel[]>(loadRecents());

  function persist(next: RecentLabel[]): void {
    const saved = saveRecents(next);
    // Se lo storage non è disponibile l'elenco vale almeno per questa sessione.
    items.value = saved.length > 0 || next.length === 0 ? saved : next;
  }

  /** Da chiamare dopo una stampa riuscita, con il bitmap appena stampato. */
  function add(doc: LabelDocument, prepared: PreparedLabel | null): void {
    let thumbnail = '';
    try {
      if (prepared) thumbnail = thumbnailDataUrl(prepared.wireBitmap, prepared.geometry);
    } catch {
      thumbnail = '';
    }
    const entry: RecentLabel = {
      id: newId(),
      printedAt: new Date().toISOString(),
      thumbnail,
      doc: JSON.parse(JSON.stringify(doc)) as LabelDocument,
    };
    persist(addRecent(items.value, entry));
  }

  function remove(id: string): void {
    persist(items.value.filter((r) => r.id !== id));
  }

  function clear(): void {
    persist([]);
  }

  return { items, add, remove, clear };
});

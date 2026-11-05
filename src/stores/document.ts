import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import { areaFromDots, createDocument, createTextElement, touch } from '@/model/document';
import { defaultDirection, documentGeometry } from '@/model/geometry';
import type { ContentDirection, LabelDocument, LabelElement, MediaFormat } from '@/model/types';
import { LW550_HEAD, defaultMedia } from '@/printer/media';
import { loadSettings, saveSettings } from '@/settings';
import { loadCurrentLabel, saveCurrentLabel } from '@/storage/label-store';

/** Ritardo del salvataggio automatico dopo l'ultima modifica. */
export const AUTOSAVE_DELAY_MS = 500;

type ElementPatch = Partial<Omit<LabelElement, 'id' | 'type'>>;

function initialDocument(): LabelDocument {
  const saved = loadSettings();
  const doc = createDocument(saved.media ?? defaultMedia());
  if (saved.direction) doc.direction = saved.direction;
  return doc;
}

export const useDocumentStore = defineStore('document', () => {
  // Si riparte dall'ultima etichetta; se non c'è, dall'ultimo formato e verso usati.
  const doc = ref<LabelDocument>(loadCurrentLabel() ?? initialDocument());
  const selectedId = ref<string | null>(null);

  const geometry = computed(() => documentGeometry(doc.value, LW550_HEAD));
  const selected = computed(() => doc.value.elements.find((e) => e.id === selectedId.value) ?? null);

  function select(id: string | null): void {
    selectedId.value = id;
  }

  function setMedia(media: MediaFormat, direction?: ContentDirection): void {
    // Copia profonda di dati semplici (funziona anche con oggetti reattivi di Vue).
    doc.value.media = JSON.parse(JSON.stringify(media)) as MediaFormat;
    doc.value.direction = direction ?? defaultDirection(media);
    touch(doc.value);
    saveSettings({ media: doc.value.media, direction: doc.value.direction });
  }

  function setDirection(direction: ContentDirection): void {
    doc.value.direction = direction;
    touch(doc.value);
    saveSettings({ direction });
  }

  function setContinuousLength(mm: number): void {
    doc.value.continuousLengthMm = Math.min(500, Math.max(10, mm));
    touch(doc.value);
  }

  /** Nuovo testo vuoto, pronto da scrivere. */
  function addText(text = ''): LabelElement {
    const el = createTextElement(areaFromDots(geometry.value.safe), text);
    doc.value.elements.push(el);
    selectedId.value = el.id;
    touch(doc.value);
    return el;
  }

  function updateElement(id: string, patch: ElementPatch): void {
    const el = doc.value.elements.find((e) => e.id === id);
    if (!el) return;
    Object.assign(el, patch);
    touch(doc.value);
  }

  function removeElement(id: string): void {
    doc.value.elements = doc.value.elements.filter((e) => e.id !== id);
    if (selectedId.value === id) selectedId.value = null;
    touch(doc.value);
  }

  /** Elimina il testo se è rimasto vuoto (es. pannello chiuso senza scrivere). */
  function removeIfEmpty(id: string | null): void {
    if (!id) return;
    const el = doc.value.elements.find((e) => e.id === id);
    if (el?.type === 'text' && el.text.trim() === '') removeElement(id);
  }

  function replaceDocument(next: LabelDocument): void {
    doc.value = next;
    selectedId.value = null;
  }

  // Salvataggio automatico: con un breve ritardo mentre si scrive, subito se l'app va in sottofondo.
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function saveNow(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveCurrentLabel(doc.value);
  }
  watch(
    doc,
    () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
    },
    { deep: true },
  );
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', saveNow);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') saveNow();
    });
  }

  return {
    doc,
    selectedId,
    selected,
    geometry,
    select,
    setMedia,
    setDirection,
    setContinuousLength,
    addText,
    updateElement,
    removeElement,
    removeIfEmpty,
    replaceDocument,
    saveNow,
  };
});

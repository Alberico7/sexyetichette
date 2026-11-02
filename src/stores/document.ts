import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { areaFromDots, createDocument, createTextElement, touch } from '@/model/document';
import { defaultDirection, documentGeometry } from '@/model/geometry';
import type { ContentDirection, LabelDocument, LabelElement, MediaFormat } from '@/model/types';
import { LW550_HEAD, defaultMedia } from '@/printer/media';

type ElementPatch = Partial<Omit<LabelElement, 'id' | 'type'>>;

export const useDocumentStore = defineStore('document', () => {
  const doc = ref<LabelDocument>(createDocument(defaultMedia()));
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
  }

  function setDirection(direction: ContentDirection): void {
    doc.value.direction = direction;
    touch(doc.value);
  }

  function setContinuousLength(mm: number): void {
    doc.value.continuousLengthMm = Math.min(500, Math.max(10, mm));
    touch(doc.value);
  }

  function addText(text = 'Testo'): LabelElement {
    const el = createTextElement(areaFromDots(geometry.value.printable), text);
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

  function replaceDocument(next: LabelDocument): void {
    doc.value = next;
    selectedId.value = null;
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
    replaceDocument,
  };
});

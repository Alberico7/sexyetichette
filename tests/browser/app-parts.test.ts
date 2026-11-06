/**
 * Parti estratte da App.vue: rotolo letto e messaggio breve.
 * Vedi docs/2026-11-06-riordino-app-vue.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick, type EffectScope } from 'vue';
import { useRollMedia } from '@/composables/roll-media';
import { TOAST_MS, useToast } from '@/composables/toast';
import type { MediaFormat } from '@/model/types';
import { findMediaById } from '@/printer/media';
import { useDocumentStore } from '@/stores/document';
import { usePrinterStore } from '@/stores/printer';

let scope: EffectScope;

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  scope = effectScope();
});
afterEach(() => {
  scope.stop();
  vi.useRealTimers();
});

/** Il rotolo letto dalla stampante diventa `media`. */
function readRoll(media: MediaFormat): void {
  usePrinterStore().mediaRead = {
    ok: true,
    detected: { sku: 'S0722520', media, fromCatalog: true },
    fields: [],
    attempts: 1,
  };
}

const small = findMediaById('multi-purpose-small')!;
const address = findMediaById('address-standard')!;

describe('useRollMedia: formato dal rotolo letto', () => {
  it('etichetta vuota: prende il formato del rotolo', async () => {
    const docs = useDocumentStore();
    docs.setMedia(address);
    scope.run(() => useRollMedia());
    readRoll({ ...small, widthMm: 25.4 });
    await nextTick();
    expect(docs.doc.media.id).toBe('multi-purpose-small');
    expect(docs.doc.media.widthMm).toBe(25.4);
  });

  it('etichetta con testi e formato diverso: niente cambia', async () => {
    const docs = useDocumentStore();
    docs.setMedia(address);
    docs.addText('Resta');
    scope.run(() => useRollMedia());
    readRoll({ ...small, widthMm: 25.4 });
    await nextTick();
    expect(docs.doc.media.id).toBe('address-standard');
  });

  it('stesso formato con 25 mm salvati e 25,4 mm dal chip: misura vera, testi agli stessi mm, verso invariato', async () => {
    const docs = useDocumentStore();
    docs.setMedia(small, 'across');
    const el = docs.addText('Misura');
    const before = { x: el.x, y: el.y, width: el.width, height: el.height };
    scope.run(() => useRollMedia());
    readRoll({ ...small, widthMm: 25.4 });
    await nextTick();
    expect(docs.doc.media.widthMm).toBe(25.4);
    expect(docs.doc.direction).toBe('across');
    const after = docs.doc.elements[0]!;
    expect({ x: after.x, y: after.y, width: after.width, height: after.height }).toEqual(before);
  });
});

describe('useToast: messaggio breve', () => {
  it('compare, sparisce dopo 3 s; un messaggio nuovo sostituisce il precedente', () => {
    vi.useFakeTimers();
    const t = useToast();
    t.show('Stampata ✓');
    expect(t.text.value).toBe('Stampata ✓');
    vi.advanceTimersByTime(TOAST_MS - 100);
    t.show('Stampate 2 copie ✓');
    vi.advanceTimersByTime(TOAST_MS - 100);
    // Il primo timer non cancella il secondo messaggio.
    expect(t.text.value).toBe('Stampate 2 copie ✓');
    vi.advanceTimersByTime(200);
    expect(t.text.value).toBeNull();
  });

  it('show(null) lo toglie subito', () => {
    const t = useToast();
    t.show('Stampata ✓');
    t.show(null);
    expect(t.text.value).toBeNull();
  });
});

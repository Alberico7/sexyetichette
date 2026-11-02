import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createTextElement } from '@/model/document';
import { LW550_HEAD } from '@/printer/media';
import { bitmapsEqual } from '@/printer/raster';
import { prepareLabel } from '@/render/export';
import { resolveFontSize } from '@/render/scene';
import { useDocumentStore } from '@/stores/document';
import { usePreviewStore } from '@/stores/preview';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('anteprima in sottofondo', () => {
  it('ensure() restituisce lo stesso risultato finché il documento non cambia', async () => {
    const docs = useDocumentStore();
    const preview = usePreviewStore();
    docs.addText('Prova');
    await flush();
    const a = await preview.ensure();
    const b = await preview.ensure();
    expect(b).toBe(a);
    expect(preview.ready).toBe(true);
  });

  it('una modifica rende l’anteprima non aggiornata e ensure() la ricalcola', async () => {
    const docs = useDocumentStore();
    const preview = usePreviewStore();
    const el = docs.addText('Prima');
    await flush();
    const before = await preview.ensure();
    docs.updateElement(el.id, { text: 'Dopo, più lungo' });
    await flush();
    expect(preview.ready).toBe(false);
    const after = await preview.ensure();
    expect(after).not.toBe(before);
    expect(preview.ready).toBe(true);
    // Coincide con un calcolo fatto da zero sul documento attuale.
    const fresh = await prepareLabel(docs.doc, LW550_HEAD);
    expect(bitmapsEqual(after.wireBitmap, fresh.wireBitmap)).toBe(true);
  });

  it('si aggiorna da solo dopo la pausa di 300 ms', async () => {
    const docs = useDocumentStore();
    const preview = usePreviewStore();
    docs.addText('Auto');
    await flush();
    await new Promise((r) => setTimeout(r, 700));
    expect(preview.ready).toBe(true);
    expect(preview.inkDots).toBeGreaterThan(0);
  });
});

describe('cache dell’adattamento automatico', () => {
  it('stesso testo e riquadro → stesso risultato, senza ricalcolo', () => {
    const el = createTextElement({ x: 0, y: 0, width: 60, height: 20 }, 'Cache');
    const a = resolveFontSize(el);
    const b = resolveFontSize({ ...el });
    expect(b).toBe(a);
    expect(resolveFontSize({ ...el, width: 30 })).not.toBe(a);
  });
});

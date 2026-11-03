import { describe, expect, it } from 'vitest';
import { createTextElement } from '@/model/document';
import type { LabelDocument } from '@/model/types';
import {
  CURRENT_LABEL_KEY,
  MAX_RECENT,
  RECENT_KEY,
  addRecent,
  formatWhen,
  labelSignature,
  loadCurrentLabel,
  loadRecents,
  parseDocument,
  recentSummary,
  saveCurrentLabel,
  saveRecents,
  type KeyValueStorage,
  type RecentLabel,
} from '@/storage/label-store';
import { addressDoc } from './helpers';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  /** Spazio massimo in caratteri (simula la memoria piena). */
  constructor(private limit = Infinity) {}
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (v.length > this.limit) throw new DOMException('pieno', 'QuotaExceededError');
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function docWith(...texts: string[]): LabelDocument {
  const doc = addressDoc();
  for (const t of texts) doc.elements.push(createTextElement({ x: 2, y: 2, width: 80, height: 20 }, t));
  return doc;
}

const recentOf = (doc: LabelDocument, id: string): RecentLabel => ({
  id,
  printedAt: '2026-11-03T10:00:00.000Z',
  thumbnail: 'data:image/png;base64,AAAA',
  doc,
});

describe('etichetta attuale salvata', () => {
  it('salvata e riletta uguale', () => {
    const s = new MemoryStorage();
    const doc = docWith('Tubo 20 AFKEUR');
    expect(saveCurrentLabel(doc, s)).toBe(true);
    expect(loadCurrentLabel(s)).toEqual(doc);
  });

  it('dati rovinati o versione sconosciuta → ignorati', () => {
    const s = new MemoryStorage();
    expect(loadCurrentLabel(s)).toBeNull();
    s.setItem(CURRENT_LABEL_KEY, '{non è json');
    expect(loadCurrentLabel(s)).toBeNull();
    s.setItem(CURRENT_LABEL_KEY, JSON.stringify({ ...docWith('x'), version: 99 }));
    expect(loadCurrentLabel(s)).toBeNull();
    s.setItem(CURRENT_LABEL_KEY, JSON.stringify({ ...docWith('x'), media: { id: 'm' } }));
    expect(loadCurrentLabel(s)).toBeNull();
  });

  it('elementi non validi e testi vuoti scartati', () => {
    const doc = docWith('Buono', '   ', 'Altro');
    const raw = JSON.parse(JSON.stringify(doc)) as { elements: Record<string, unknown>[] };
    raw.elements[2]!.align = 'giustificato';
    raw.elements.push({ type: 'image', id: 'x' });
    const parsed = parseDocument(raw)!;
    expect(parsed.elements.map((e) => e.text)).toEqual(['Buono']);
  });

  it('storage assente o pieno: nessun errore', () => {
    expect(saveCurrentLabel(docWith('a'), null)).toBe(false);
    expect(saveCurrentLabel(docWith('a'), new MemoryStorage(5))).toBe(false);
    expect(loadCurrentLabel(null)).toBeNull();
  });
});

describe('etichette recenti', () => {
  it('la più recente in cima, nessun doppione per etichette identiche', () => {
    let list: RecentLabel[] = [];
    list = addRecent(list, recentOf(docWith('A'), '1'));
    list = addRecent(list, recentOf(docWith('B'), '2'));
    // Stesso contenuto di A, ma documento diverso (id e date diversi).
    list = addRecent(list, recentOf(docWith('A'), '3'));
    expect(list.map((r) => r.id)).toEqual(['3', '2']);
  });

  it('contenuto diverso = etichetta diversa', () => {
    const a = docWith('A');
    const b = structuredClone(a);
    b.elements[0]!.bold = true;
    const c = structuredClone(a);
    c.direction = c.direction === 'along' ? 'across' : 'along';
    expect(labelSignature(a)).not.toBe(labelSignature(b));
    expect(labelSignature(a)).not.toBe(labelSignature(c));
    expect(labelSignature(a)).toBe(labelSignature({ ...structuredClone(a), id: 'altro', modified: 'x' }));
  });

  it(`al massimo ${MAX_RECENT}`, () => {
    let list: RecentLabel[] = [];
    for (let i = 0; i < MAX_RECENT + 5; i++) list = addRecent(list, recentOf(docWith(`N${i}`), String(i)));
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]!.id).toBe(String(MAX_RECENT + 4));
  });

  it('salvate e rilette; voci non valide scartate', () => {
    const s = new MemoryStorage();
    const list = [recentOf(docWith('A'), '1'), recentOf(docWith('B'), '2')];
    expect(saveRecents(list, s)).toHaveLength(2);
    expect(loadRecents(s)).toEqual(list);
    s.setItem(RECENT_KEY, JSON.stringify([{ id: 'x' }, { ...list[0], thumbnail: 'javascript:alert(1)' }]));
    const read = loadRecents(s);
    expect(read).toHaveLength(1);
    expect(read[0]!.thumbnail).toBe('');
  });

  it('memoria piena: le più vecchie escono', () => {
    const list = [recentOf(docWith('A'), '1'), recentOf(docWith('B'), '2'), recentOf(docWith('C'), '3')];
    const one = JSON.stringify(list.slice(0, 2)).length;
    const s = new MemoryStorage(one);
    expect(saveRecents(list, s).map((r) => r.id)).toEqual(['1', '2']);
    expect(loadRecents(s).map((r) => r.id)).toEqual(['1', '2']);
    expect(saveRecents(list, new MemoryStorage(3))).toEqual([]);
  });

  it('riassunto e data', () => {
    expect(recentSummary(docWith('Tubo\n20', 'AFKEUR'))).toBe('Tubo 20 · AFKEUR');
    expect(recentSummary(docWith())).toBe('(etichetta vuota)');
    expect(recentSummary(docWith('x'.repeat(100)), 10)).toBe(`${'x'.repeat(9)}…`);
    const now = new Date(2026, 10, 3, 18, 0);
    expect(formatWhen(new Date(2026, 10, 3, 14, 32).toISOString(), now)).toBe('oggi 14:32');
    expect(formatWhen(new Date(2026, 10, 2, 9, 5).toISOString(), now)).toBe('ieri 09:05');
    expect(formatWhen(new Date(2026, 9, 28, 9, 5).toISOString(), now)).toBe('28 ott');
    expect(formatWhen(new Date(2025, 9, 28).toISOString(), now)).toBe('28 ott 2025');
  });
});

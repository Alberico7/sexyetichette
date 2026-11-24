import { describe, expect, it } from 'vitest';
import {
  MAX_MODULE_DOTS,
  QUIET_ZONE_MODULES,
  checkBarcodeValue,
  code128Symbols,
  code128Widths,
  firstUnencodable,
  keyboardSensitive,
  layoutBarcode,
} from '@/model/barcode';
import { createBarcodeElement } from '@/model/document';
import { labelSignature, parseDocument, recentSummary } from '@/storage/label-store';
import { addressDoc } from './helpers';

describe('Code 128 (docs/2026-11-24-codici-a-barre.md)', () => {
  it('sole cifre in numero pari: insieme C, due cifre per simbolo, cifra di controllo', () => {
    // 105 + 1·12 + 2·34 + 3·56 + 4·78 = 665; 665 mod 103 = 47.
    expect(code128Symbols('12345678')).toEqual([105, 12, 34, 56, 78, 47, 106]);
  });

  it('sole cifre in numero dispari: insieme C, poi l’ultima cifra in B', () => {
    const s = code128Symbols('1234567');
    expect(s.slice(0, 6)).toEqual([105, 12, 34, 56, 100, 23]);
    expect(s.at(-1)).toBe(106);
  });

  it('lettere e segni: insieme B', () => {
    // «A» = 33, «R» = 50, «T» = 52; 104 + 33 + 2·50 + 3·52 = 393; 393 mod 103 = 84.
    expect(code128Symbols('ART')).toEqual([104, 33, 50, 52, 84, 106]);
    expect(code128Symbols('7')[0]).toBe(104); // una sola cifra: B
  });

  it('11 moduli per simbolo, 13 lo stop; inizia e finisce con una barra', () => {
    for (const v of ['ART-12345', '12345678', 'a b.c']) {
      const w = code128Widths(v);
      const n = code128Symbols(v).length;
      expect(w.reduce((a, b) => a + b, 0)).toBe(11 * (n - 1) + 13);
      expect(w.length % 2).toBe(1);
    }
  });

  it('solo ASCII stampabile: accenti, simboli dell’app ed emoji rifiutati', () => {
    expect(firstUnencodable('ART-12 ~')).toBe('');
    expect(firstUnencodable('caffè')).toBe('è');
    expect(firstUnencodable('⌀20')).toBe('⌀');
    expect(firstUnencodable('ok🙂')).toBe('🙂');
    expect(() => code128Symbols('è')).toThrow('non codificabile');
    expect(checkBarcodeValue('')).toEqual({ kind: 'empty' });
    expect(checkBarcodeValue('Ø1')).toEqual({ kind: 'unencodable', char: 'Ø' });
    expect(checkBarcodeValue('ART-1')).toBeNull();
  });

  it('segni che il lettore «a tastiera» può scrivere diversi', () => {
    expect(keyboardSensitive('ART 12.5')).toBe(false);
    expect(keyboardSensitive('ART-12')).toBe(true);
    expect(keyboardSensitive('A/B')).toBe(true);
  });
});

describe('disposizione delle barre', () => {
  const widths = code128Widths('ART-12345'); // 134 moduli di barre, 154 con le zone di quiete
  const total = widths.reduce((a, b) => a + b, 0) + 2 * QUIET_ZONE_MODULES;

  it('riquadro largo: modulo di 3 punti, mai di più', () => {
    const l = layoutBarcode(widths, 2000);
    expect(l.module).toBe(MAX_MODULE_DOTS);
    expect(l.totalWidth).toBe(total * 3);
  });

  it('riquadro stretto: modulo di 2 punti, centrato, con le zone di quiete', () => {
    const l = layoutBarcode(widths, total * 2 + 5);
    expect(l.module).toBe(2);
    expect(l.barsX).toBeGreaterThanOrEqual(QUIET_ZONE_MODULES * 2);
    expect(l.barsX + l.barsWidth + QUIET_ZONE_MODULES * 2).toBeLessThanOrEqual(total * 2 + 5);
  });

  it('non entra con 2 punti: niente codice', () => {
    expect(layoutBarcode(widths, total * 2 - 1).fits).toBe(false);
  });
});

describe('codici a barre salvati', () => {
  function docWithBarcode(value: string) {
    const doc = addressDoc();
    doc.elements.push(createBarcodeElement({ x: 2, y: 2, width: 80, height: 20 }, value));
    return doc;
  }

  it('si salvano e si rileggono uguali', () => {
    const doc = docWithBarcode('ART-1');
    expect(parseDocument(JSON.parse(JSON.stringify(doc)))!.elements).toEqual(doc.elements);
  });

  it('vuoti o rovinati vengono scartati, il resto dell’etichetta resta', () => {
    const doc = docWithBarcode('ART-1');
    doc.elements.push(createBarcodeElement({ x: 2, y: 2, width: 80, height: 20 }, '   '));
    const raw = JSON.parse(JSON.stringify(doc)) as { elements: Record<string, unknown>[] };
    raw.elements.push({ ...raw.elements[0], id: 'rotto', symbology: 'qr' });
    raw.elements.push({ ...raw.elements[0], id: 'rotto2', showText: 'sì' });
    expect(parseDocument(raw)!.elements.map((e) => e.id)).toEqual([doc.elements[0]!.id]);
  });

  it('recenti: riassunto «[codice] …» e impronta diversa se cambia il contenuto', () => {
    const a = docWithBarcode('ART-1');
    expect(recentSummary(a)).toBe('[codice] ART-1');
    const b = docWithBarcode('ART-2');
    expect(labelSignature(a)).not.toBe(labelSignature(b));
  });
});

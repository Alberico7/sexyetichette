/**
 * Larghezza vera del rotolo, margine di sicurezza sui bordi lunghi e codice ESC V.
 * Dati veri della LabelWriter 550 del 2026-11-05. Vedi docs/2026-11-05-margine-bordo-testina.md.
 */
import { describe, expect, it } from 'vitest';
import { parseSkuInfo } from '@thermal-label/labelwriter-core';
import { classifyMediaRead } from '@/diagnostics/media-read';
import { EDGE_SAFETY_DOTS, computeGeometry } from '@/model/geometry';
import { versionProductId } from '@/printer/engine-version';
import { LW550_HEAD, findMediaById, mediaFromSku, withRollSize } from '@/printer/media';

const hex = (s: string) =>
  new Uint8Array(
    s
      .trim()
      .split(/\s+/)
      .map((b) => parseInt(b, 16)),
  );

/** Risposta a ESC U del rotolo S0722520, letta sulla 550 vera. */
const REAL_ROLL = hex(
  'b6 ca 00 3c 0e 8b f5 3e 53 30 37 32 32 35 32 30 00 00 00 00 00 ff 04 01 01 00 00 00 6b 02 1e 00 48 00 00 00 00 00 10 00 1c 02 fe 00 00 00 00 00 37 01 f4 01 76 3c 32 00 01 00 00 00 ee 30 d0',
);

/** Risposta a ESC V della 550 vera. */
const REAL_VERSION = hex(
  '4c 57 35 35 30 42 5f 50 50 42 5f 30 30 30 30 32 46 57 41 50 30 30 30 32 30 30 32 30 30 39 32 31 32 38',
);

describe('larghezza vera del rotolo', () => {
  it('rotolo S0722520 vero: 25,4 mm dal chip invece dei 25 del catalogo, nome invariato', () => {
    const r = classifyMediaRead({ sku: parseSkuInfo(REAL_ROLL), bytes: REAL_ROLL });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.detected.media.id).toBe('multi-purpose-small');
    expect(r.detected.media.widthMm).toBe(25.4);
    expect(r.detected.media.lengthDots).toBe(638);
    expect(r.detected.media.name).toBe('Multiuso piccola 25×54 mm');
    // Il catalogo non viene modificato.
    expect(findMediaById('multi-purpose-small')!.widthMm).toBe(25);
  });

  it('misure del chip lontane dal catalogo (oltre 2 mm): si tiene il catalogo', () => {
    const r = mediaFromSku({ sku: 'S0722520', labelWidthMm: 40, labelLengthMm: 54, labelType: 'die' });
    expect(r?.media.widthMm).toBe(25);
  });

  it('lunghezza corretta solo se diversa più di 0,2 mm', () => {
    const base = findMediaById('address-standard')!;
    expect(withRollSize(structuredClone(base), { labelWidthMm: 28.6, labelLengthMm: 89.1 })).toMatchObject({
      widthMm: 28.6,
      lengthMm: 89,
      lengthDots: 1051,
    });
    expect(withRollSize(structuredClone(base), { labelWidthMm: 28, labelLengthMm: 90 })).toMatchObject({
      widthMm: 28,
      lengthMm: 90,
      lengthDots: 1063,
    });
  });

  it('senza dati del chip resta il catalogo', () => {
    const base = findMediaById('address-standard')!;
    expect(withRollSize(structuredClone(base), { labelWidthMm: 0, labelLengthMm: 0 })).toEqual(base);
  });
});

describe('margine di sicurezza sui bordi lunghi', () => {
  const small = { ...findMediaById('multi-purpose-small')!, widthMm: 25.4 };

  it('25,4×54 lungo il rotolo: 300 punti, immagine intera, area consigliata 6 punti dentro in alto e in basso', () => {
    const g = computeGeometry(small, 'along', 50, LW550_HEAD);
    expect(EDGE_SAFETY_DOTS).toBe(6);
    expect(g.crossDots).toBe(300);
    expect(g.label).toEqual({ width: 638, height: 300 });
    // L'immagine inviata copre tutta l'etichetta attraverso la testina.
    expect(g.printable).toEqual({ x: 71, y: 0, width: 567, height: 300 });
    expect(g.safe).toEqual({ x: 71, y: 6, width: 567, height: 288 });
    expect(g.safetyZones).toEqual([
      { x: 71, y: 0, width: 567, height: 6 },
      { x: 71, y: 294, width: 567, height: 6 },
    ]);
    // La zona iniziale di 6 mm non cambia.
    expect(g.deadZones).toEqual([{ x: 0, y: 0, width: 71, height: 300 }]);
  });

  it('attraverso il rotolo: margini a sinistra e a destra', () => {
    const g = computeGeometry(small, 'across', 50, LW550_HEAD);
    expect(g.printable).toEqual({ x: 0, y: 71, width: 300, height: 567 });
    expect(g.safe).toEqual({ x: 6, y: 71, width: 288, height: 567 });
    expect(g.safetyZones).toEqual([
      { x: 0, y: 71, width: 6, height: 567 },
      { x: 294, y: 71, width: 6, height: 567 },
    ]);
  });

  it('il margine c’è con ogni formato del catalogo e l’area consigliata sta nell’area stampabile', () => {
    for (const direction of ['along', 'across'] as const) {
      const g = computeGeometry(findMediaById('address-standard')!, direction, 50, LW550_HEAD);
      expect(g.safetyZones).toHaveLength(2);
      expect(g.safe.x).toBeGreaterThanOrEqual(g.printable.x);
      expect(g.safe.y).toBeGreaterThanOrEqual(g.printable.y);
      expect(g.safe.x + g.safe.width).toBeLessThanOrEqual(g.printable.x + g.printable.width);
      expect(g.safe.y + g.safe.height).toBeLessThanOrEqual(g.printable.y + g.printable.height);
    }
  });
});

describe('codice prodotto nella versione (ESC V)', () => {
  it('risposta vera della 550: «28» in testo = 0x0028, non 0x3832', () => {
    expect(versionProductId(REAL_VERSION, 0x3832)).toBe(0x28);
  });

  it('byte non testuali o risposta corta: resta il valore della libreria', () => {
    const raw = new Uint8Array(REAL_VERSION);
    raw[32] = 0x00;
    expect(versionProductId(raw, 0x1234)).toBe(0x1234);
    expect(versionProductId(raw.subarray(0, 20), 0x1234)).toBe(0x1234);
    expect(versionProductId(undefined, 0x1234)).toBe(0x1234);
  });
});

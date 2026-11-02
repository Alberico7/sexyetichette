import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  findMediaBySku,
  mediaFromSku,
  sameMediaSize,
  toLibraryMedia,
} from '@/printer/media';

describe('catalogo formati 550', () => {
  it('contiene solo formati per la testina standard (niente nastri D1 né formati larghi)', () => {
    expect(CATALOG.length).toBeGreaterThan(15);
    expect(CATALOG.some((m) => m.id.startsWith('d1-'))).toBe(false);
    expect(CATALOG.some((m) => m.id === 'shipping-4x6')).toBe(false);
    for (const m of CATALOG) expect(m.widthMm).toBeLessThanOrEqual(62);
  });

  it('ha nomi in italiano', () => {
    expect(CATALOG.find((m) => m.id === 'address-standard')?.name).toBe('Indirizzo 28×89 mm');
    expect(CATALOG.find((m) => m.id === 'continuous-57')?.lengthMm).toBeUndefined();
  });
});

describe('rotolo letto via NFC', () => {
  it('trova lo SKU nel catalogo (con spazi del tag)', () => {
    expect(findMediaBySku('30252      ')?.id).toBe('address-standard');
    const r = mediaFromSku({ sku: '30252      ', labelWidthMm: 28, labelLengthMm: 89, labelType: 'die' });
    expect(r?.fromCatalog).toBe(true);
    expect(r?.media.lengthDots).toBe(1051);
  });

  it('SKU dell’etichetta verificata nella issue #1 della libreria (S0722540)', () => {
    expect(findMediaBySku('S0722540')?.id).toBe('multi-purpose-medium-removable');
  });

  it('SKU sconosciuto: usa le misure del tag', () => {
    const r = mediaFromSku({ sku: 'X999', labelWidthMm: 57.1, labelLengthMm: 31.7, labelType: 'die' });
    expect(r?.fromCatalog).toBe(false);
    expect(r?.media.widthMm).toBe(57.1);
    expect(r?.media.lengthMm).toBe(31.7);
    expect(r?.media.lengthDots).toBe(374);
    expect(r?.media.name).toContain('X999');
  });

  it('rotolo continuo sconosciuto', () => {
    const r = mediaFromSku({ sku: '', labelWidthMm: 54, labelLengthMm: 0, labelType: 'continuous' });
    expect(r?.media.lengthMm).toBeUndefined();
  });

  it('tag senza misure: nessun formato', () => {
    expect(mediaFromSku({ sku: '', labelWidthMm: 0, labelLengthMm: 0, labelType: 'unknown' })).toBeNull();
  });
});

describe('confronto e conversione', () => {
  it('sameMediaSize tollera i decimi di millimetro del tag', () => {
    expect(sameMediaSize({ id: 'a', name: '', widthMm: 57, lengthMm: 32 }, { id: 'b', name: '', widthMm: 57.1, lengthMm: 31.7 })).toBe(true);
    expect(sameMediaSize({ id: 'a', name: '', widthMm: 28, lengthMm: 89 }, { id: 'b', name: '', widthMm: 36, lengthMm: 89 })).toBe(false);
    expect(sameMediaSize({ id: 'a', name: '', widthMm: 57 }, { id: 'b', name: '', widthMm: 57, lengthMm: 32 })).toBe(false);
  });

  it('toLibraryMedia', () => {
    expect(toLibraryMedia({ id: 'x', name: 'X', widthMm: 28, lengthMm: 89 }, 1051)).toEqual({
      id: 'x',
      name: 'X',
      widthMm: 28,
      heightMm: 89,
      type: 'die-cut',
      lengthDots: 1051,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { DEVICES } from '@thermal-label/labelwriter-core';
import { WebLabelWriterPrinter } from '@thermal-label/labelwriter-web';
import { DiagnosticLog } from '@/diagnostics/log';
import { traceTransport } from '@/diagnostics/usb-trace';
import { mmToDots } from '@/model/units';
import { EU_CODES, EU_NEW_FORMATS } from '@/printer/eu-skus';
import { CATALOG, LW550_HEAD, allSkus, findMediaById, findMediaBySku, normalizeSku } from '@/printer/media';
import { buildSkuBytes } from '@/printer/sim-sku';
import { readMediaWith } from '@/printer/webusb';

const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) <= 1;

describe('codici europei DYMO', () => {
  it('S0722520 e 11352 → Multiuso piccola 25×54', () => {
    for (const code of ['S0722520', 's0722520 ', '11352', '2177564', '2112283']) {
      expect(findMediaBySku(code)?.id, code).toBe('multi-purpose-small');
    }
    expect(findMediaBySku('S0722520')?.name).toBe('Multiuso piccola 25×54 mm');
  });

  it('ogni codice porta a un formato con le misure della tabella DYMO (±1 mm)', () => {
    for (const e of EU_CODES) {
      const media = findMediaById(e.mediaId);
      expect(media, e.mediaId).toBeDefined();
      for (const code of [...e.shown, ...e.more]) {
        const found = findMediaBySku(code)!;
        expect(found, code).toBeDefined();
        if (e.lengthMm === 0) {
          expect(near(found.widthMm, e.widthMm), code).toBe(true);
          expect(found.lengthMm, code).toBeUndefined();
        } else {
          // La tabella DYMO non sempre mette prima la misura attraverso il rotolo (es. 32×57).
          const same =
            (near(found.widthMm, e.widthMm) && near(found.lengthMm, e.lengthMm)) ||
            (near(found.widthMm, e.lengthMm) && near(found.lengthMm, e.widthMm));
          expect(same, `${code}: ${found.widthMm}×${found.lengthMm}`).toBe(true);
        }
      }
    }
  });

  it('nessun codice associato a due formati diversi', () => {
    const owner = new Map<string, string>();
    for (const m of CATALOG) {
      for (const code of allSkus(m)) {
        const key = normalizeSku(code);
        expect(owner.get(key) ?? m.id, `${code} in ${owner.get(key)} e ${m.id}`).toBe(m.id);
        owner.set(key, m.id);
      }
    }
  });

  it('formati nuovi: larghezza entro la testina e lunghezza coerente', () => {
    for (const f of EU_NEW_FORMATS) {
      const m = findMediaById(f.id)!;
      expect(m.widthMm).toBeLessThanOrEqual(LW550_HEAD.headDots / 11.81);
      expect(m.lengthDots).toBe(mmToDots(f.lengthMm));
    }
    expect(findMediaBySku('S0722560')?.name).toBe('Badge piccolo 41×89 mm');
  });

  it('i codici delle confezioni multiple non compaiono nell’elenco ma si trovano', () => {
    const small = findMediaById('multi-purpose-small')!;
    expect(small.skus).toEqual(['30336', '1976411', 'S0722520', '11352']);
    expect(allSkus(small)).toContain('2223589');
  });

  it('tag con codice S0722520 letto con il driver reale → formato del catalogo', async () => {
    const transport = {
      connected: true,
      async write() {},
      async read(n: number) {
        return buildSkuBytes({ sku: 'S0722520', widthMm: 25, lengthMm: 54, totalLabels: 500 }).subarray(0, n);
      },
      async close() {},
    };
    const printer = new WebLabelWriterPrinter(DEVICES.LW_550, transport);
    const result = await readMediaWith(printer, traceTransport(transport, new DiagnosticLog()));
    expect(result.ok && result.detected.fromCatalog).toBe(true);
    expect(result.ok && result.detected.media.id).toBe('multi-purpose-small');
    expect(result.ok && result.detected.media.lengthDots).toBe(638);
  });
});

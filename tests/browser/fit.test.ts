import { describe, expect, it } from 'vitest';
import { getPixel, type LabelBitmap } from '@mbtech-nl/bitmap';
import { createDocument, createTextElement } from '@/model/document';
import { DIAMETER_SIGN, DIAMETER_SYMBOL } from '@/model/text';
import type { TextElement } from '@/model/types';
import { mmToDots } from '@/model/units';
import { LW550_HEAD, findMediaById } from '@/printer/media';
import { bitmapsEqual, countBlack } from '@/printer/raster';
import { prepareLabel } from '@/render/export';
import { wireToReading } from '@/render/preview';
import { resolveFontSize, waitForFonts } from '@/render/scene';

function docWith(el: Partial<TextElement>) {
  const doc = createDocument(findMediaById('address-standard')!);
  doc.direction = 'along';
  const text = { ...createTextElement({ x: 10, y: 4, width: 60, height: 20 }, 'Tubo Ø 20'), ...el };
  doc.elements.push(text);
  return { doc, text };
}

function bounds(b: LabelBitmap) {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < b.heightPx; y++)
    for (let x = 0; x < b.widthPx; x++)
      if (getPixel(b, x, y)) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
  return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

async function reading(el: Partial<TextElement>) {
  const { doc, text } = docWith(el);
  await waitForFonts(doc.elements);
  const p = await prepareLabel(doc, LW550_HEAD);
  return { bitmap: wireToReading(p.wireBitmap, 90), text, printable: p.geometry.printable };
}

describe('adattamento automatico nel rendering', () => {
  it('il testo su una riga riempie la larghezza del riquadro e resta dentro', async () => {
    const { bitmap, text, printable } = await reading({ text: 'Barattolo zucchero', autoFit: true });
    const b = bounds(bitmap);
    const boxW = mmToDots(text.width);
    const boxH = mmToDots(text.height);
    const boxX = mmToDots(text.x) - printable.x;
    const boxY = mmToDots(text.y) - printable.y;
    expect(b.w / boxW).toBeGreaterThan(0.9);
    expect(b.minX).toBeGreaterThanOrEqual(boxX - 1);
    expect(b.minX + b.w).toBeLessThanOrEqual(boxX + boxW + 1);
    expect(b.minY).toBeGreaterThanOrEqual(boxY - 1);
    expect(b.minY + b.h).toBeLessThanOrEqual(boxY + boxH + 1);
  });

  it('non va a capo da solo: una riga resta una riga', async () => {
    const one = await reading({ text: 'Una riga piuttosto lunga da adattare', autoFit: true, height: 25 });
    const b = bounds(one.bitmap);
    // Una sola riga: l'inchiostro è molto più largo che alto.
    expect(b.w / b.h).toBeGreaterThan(8);
  });

  it('più larghezza → testo più grande', async () => {
    const { text: narrow } = docWith({ autoFit: true, width: 30, text: 'Tubo Ø 20' });
    const { text: wide } = docWith({ autoFit: true, width: 60, text: 'Tubo Ø 20' });
    await waitForFonts([narrow]);
    expect(resolveFontSize(wide).sizePt).toBeGreaterThan(resolveFontSize(narrow).sizePt);
  });

  it('due righe (Invio) occupano l’altezza', async () => {
    const { bitmap } = await reading({ text: 'Riga 1\nRiga 2', autoFit: true, width: 70, height: 20 });
    const b = bounds(bitmap);
    expect(b.h).toBeGreaterThan(mmToDots(20) * 0.75);
  });

  it('senza adattamento resta la dimensione scelta', async () => {
    const { text } = docWith({ autoFit: false, fontSizePt: 12 });
    expect(resolveFontSize(text)).toEqual({ sizePt: 12, overflow: false });
  });

  it('testo che non entra: avviso e dimensione minima', async () => {
    const { text } = docWith({ autoFit: true, width: 3, height: 2, text: 'Testo troppo lungo' });
    expect(resolveFontSize(text)).toEqual({ sizePt: 4, overflow: true });
  });

  it('rendering deterministico con adattamento', async () => {
    const { doc } = docWith({ autoFit: true });
    const a = await prepareLabel(doc, LW550_HEAD);
    const b = await prepareLabel(doc, LW550_HEAD);
    expect(bitmapsEqual(a.wireBitmap, b.wireBitmap)).toBe(true);
  });
});

describe('simbolo del diametro ISO', () => {
  it('⌀ produce inchiostro e si distingue da Ø', async () => {
    const iso = await reading({ text: `${DIAMETER_SIGN} 20`, autoFit: false, fontSizePt: 40 });
    const o = await reading({ text: `${DIAMETER_SYMBOL} 20`, autoFit: false, fontSizePt: 40 });
    const digits = await reading({ text: ' 20', autoFit: false, fontSizePt: 40 });
    expect(countBlack(iso.bitmap)).toBeGreaterThan(countBlack(digits.bitmap));
    expect(bitmapsEqual(iso.bitmap, o.bitmap)).toBe(false);
  });
});

describe('dimensione scelta dopo lo spegnimento dell’adattamento', () => {
  it('stesso bitmap di un testo creato direttamente a 18 pt', async () => {
    const turnedOff = docWith({ autoFit: false, fontSizePt: 18 }).doc;
    const direct = docWith({ autoFit: undefined, fontSizePt: 18 }).doc;
    const a = await prepareLabel(turnedOff, LW550_HEAD);
    const b = await prepareLabel(direct, LW550_HEAD);
    expect(bitmapsEqual(a.wireBitmap, b.wireBitmap)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { FIT_MAX_PT, FIT_MIN_PT, fitFontSize, ptToDots, splitLines, TEXT_LINE_HEIGHT } from '@/render/fit';
import { createTextElement } from '@/model/document';

/** Misura finta: ogni carattere è largo 0,6 volte la dimensione. */
const mono = (line: string, size: number) => line.length * size * 0.6;

describe('fitFontSize', () => {
  it('riga lunga: limitata dalla larghezza', () => {
    const r = fitFontSize('Barattolo zucchero', 900, 300, mono);
    expect(r.overflow).toBe(false);
    const size = ptToDots(r.sizePt);
    expect(mono('Barattolo zucchero', size)).toBeLessThanOrEqual(900 * 0.96);
    // Mezzo punto in più non entrerebbe.
    expect(mono('Barattolo zucchero', ptToDots(r.sizePt + 0.5))).toBeGreaterThan(900 * 0.96);
  });

  it('molte righe: limitate dall’altezza; a capo solo con Invio', () => {
    const text = 'A\nB\nC\nD';
    const r = fitFontSize(text, 2000, 300, mono);
    const size = ptToDots(r.sizePt);
    expect(4 * size * TEXT_LINE_HEIGHT).toBeLessThanOrEqual(300 * 0.96);
    expect(4 * ptToDots(r.sizePt + 0.5) * TEXT_LINE_HEIGHT).toBeGreaterThan(300 * 0.96);
    expect(splitLines('a\r\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('limiti: massimo 200 pt, minimo 4 pt con avviso', () => {
    expect(fitFontSize('x', 100_000, 100_000, mono)).toEqual({ sizePt: FIT_MAX_PT, overflow: false });
    expect(fitFontSize('testo lunghissimo che non entra', 20, 20, mono)).toEqual({
      sizePt: FIT_MIN_PT,
      overflow: true,
    });
  });

  it('testo vuoto: conta solo l’altezza', () => {
    const r = fitFontSize('', 50, 300, mono);
    expect(r.overflow).toBe(false);
    expect(r.sizePt).toBeGreaterThan(FIT_MIN_PT);
  });

  it('monotono: un riquadro più grande non dà mai un testo più piccolo', () => {
    let prev = 0;
    for (let w = 100; w <= 2000; w += 37) {
      const r = fitFontSize('Tubo Ø 20', w, 400, mono);
      expect(r.sizePt).toBeGreaterThanOrEqual(prev);
      prev = r.sizePt;
    }
  });

  it('dimensioni a passi di mezzo punto', () => {
    const r = fitFontSize('Prova', 777, 333, mono);
    expect((r.sizePt * 2) % 1).toBe(0);
  });
});

describe('nuovi testi', () => {
  it('hanno l’adattamento automatico attivo', () => {
    expect(createTextElement({ x: 0, y: 0, width: 50, height: 20 }).autoFit).toBe(true);
  });
});

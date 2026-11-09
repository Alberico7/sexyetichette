import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FONT, FONT_OPTIONS, ISO_FONT, NOTO_SANS, NOTO_SANS_FACE } from '@/model/fonts';

// Vedi docs/2026-11-09-carattere-noto-sans.md.
const FILES = ['400-normal', '400-italic', '700-normal', '700-italic'].map(
  (v) => `src/assets/fonts/noto-sans-latin-${v}.woff2`,
);

describe('carattere «Noto Sans (simile a Segoe UI)»', () => {
  it('nell’elenco subito dopo ISO, che resta il carattere dei nuovi testi', () => {
    expect(FONT_OPTIONS[1]).toEqual({ value: NOTO_SANS, label: 'Noto Sans (simile a Segoe UI)' });
    expect(NOTO_SANS).toBe(`"${NOTO_SANS_FACE}", sans-serif`);
    expect(DEFAULT_FONT).toBe(ISO_FONT);
  });

  it('quattro file woff2 piccoli, con la licenza OFL', () => {
    for (const f of FILES) {
      expect(existsSync(f), f).toBe(true);
      const buf = readFileSync(f);
      expect(buf.subarray(0, 4).toString('latin1'), f).toBe('wOF2');
      expect(buf.length, f).toBeLessThan(20_000);
    }
    expect(readFileSync('public/licenses/noto-sans/OFL.txt', 'utf8')).toContain('SIL Open Font License, Version 1.1');
    expect(existsSync('public/licenses/noto-sans/README.txt')).toBe(true);
  });
});

/**
 * Contrasto dei colori del tema: tutto il testo ad almeno 7:1 (WCAG AAA) sul
 * fondo meno favorevole, nei due temi. Legge le variabili da base.css.
 * Vedi docs/2026-11-06-colori-riposanti.md.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/base.css', import.meta.url), 'utf8');

/** `--nome: light-dark(#chiaro, #scuro)` oppure `--nome: #colore`. */
function themeColor(name: string, theme: 'light' | 'dark'): string {
  const m = new RegExp(`--${name}:\s*([^;]+);`).exec(css);
  if (!m) throw new Error(`variabile --${name} non trovata`);
  const value = m[1]!.trim();
  const pair = /^light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)$/i.exec(value);
  if (pair) return theme === 'light' ? pair[1]! : pair[2]!;
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  throw new Error(`--${name}: valore non riconosciuto (${value})`);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const TEXT = ['text', 'muted', 'accent', 'ok', 'warn', 'danger'];
const BACKGROUNDS = ['bg', 'surface', 'surface-2'];

describe.each(['light', 'dark'] as const)('tema %s', (theme) => {
  it.each(TEXT)('--%s ≥ 7:1 su fondo, pannelli e pannelli secondari', (name) => {
    for (const bg of BACKGROUNDS) {
      const c = contrast(themeColor(name, theme), themeColor(bg, theme));
      expect(c, `--${name} su --${bg}`).toBeGreaterThanOrEqual(7);
    }
  });

  it('scritta sui pulsanti principali ≥ 7:1', () => {
    expect(contrast(themeColor('accent-text', theme), themeColor('accent', theme))).toBeGreaterThanOrEqual(7);
  });

  it('testo principale non più abbagliante di 13:1', () => {
    for (const bg of BACKGROUNDS) {
      expect(contrast(themeColor('text', theme), themeColor(bg, theme))).toBeLessThanOrEqual(13);
    }
  });
});

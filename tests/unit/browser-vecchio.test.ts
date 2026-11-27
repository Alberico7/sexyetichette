import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Gli script classici di index.html (tema e controllo del browser troppo vecchio) devono
 * funzionare anche su Chromium 83. Vedi docs/2026-11-27-browser-troppo-vecchio.md.
 */
describe('index.html: script classici senza niente più recente di Chromium 83', () => {
  const html = readFileSync('index.html', 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]!);

  it('ci sono lo script del tema e quello del controllo', () => {
    expect(scripts).toHaveLength(2);
    expect(scripts.some((s) => s.includes('data-browser-vecchio'))).toBe(true);
  });

  it.each([
    ['??=', 'assegnazione logica (Chromium 85)'],
    ['||=', 'assegnazione logica (Chromium 85)'],
    ['&&=', 'assegnazione logica (Chromium 85)'],
    ['?.', 'concatenamento opzionale (Chromium 80)'],
    ['??', 'coalescenza nulla (Chromium 80)'],
    ['.at(', 'Array.prototype.at (Chromium 92)'],
    ['structuredClone', 'structuredClone (Chromium 98)'],
    ['replaceAll', 'String.replaceAll (Chromium 85)'],
    ['findLast', 'findLast (Chromium 97)'],
    ['Object.hasOwn', 'Object.hasOwn (Chromium 93)'],
  ])('non usa %s — %s', (token) => {
    for (const s of scripts) expect(s).not.toContain(token);
  });

  it('il controllo chiede light-dark(), la funzione più recente che l’app usa', () => {
    const check = scripts.find((s) => s.includes('data-browser-vecchio'))!;
    expect(check).toContain("CSS.supports('color', 'light-dark(#000, #fff)')");
    // Il messaggio ha colori fissi: le variabili del tema su questi browser non valgono.
    expect(check).not.toContain('var(--');
  });
});

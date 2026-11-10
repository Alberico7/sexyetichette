import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { META_COLORS } from '@/theme';

/** Colori di `--surface` in base.css: light-dark(chiaro, scuro). */
function surface(): { light: string; dark: string } {
  const css = readFileSync('src/styles/base.css', 'utf8');
  const m = /--surface:\s*light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i.exec(css)!;
  return { light: m[1]!.toLowerCase(), dark: m[2]!.toLowerCase() };
}

describe('colore delle barre di Android (docs/2026-11-10-pwa.md)', () => {
  it('theme.ts usa il colore dei pannelli, chiaro e scuro', () => {
    expect(META_COLORS).toEqual(surface());
  });

  it('il manifest ha il colore dei pannelli; lo sfondo d’avvio resta blu', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as {
      theme_color: string;
      background_color: string;
    };
    expect(m.theme_color.toLowerCase()).toBe(surface().light);
    expect(m.background_color.toLowerCase()).toBe('#274e76');
  });

  it('index.html parte con gli stessi colori, prima che parta il codice', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`<meta name="theme-color" content="${surface().light}" />`);
    expect(html).toContain(`'${surface().dark}'`);
  });
});

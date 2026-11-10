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

  it('il manifest resta blu: nell’app installata Vanadium usa solo questo colore, fisso', () => {
    // Prova sul Pixel (2026-11-10): con il colore dei pannelli la barra dei tasti restava
    // chiara anche col tema scuro, e il colore per la modalità scura di Android è ignorato.
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as Record<string, unknown>;
    expect(m.theme_color).toBe('#274e76');
    expect(m.background_color).toBe('#274e76');
    expect(m.user_preferences).toBeUndefined();
  });

  it('index.html parte con gli stessi colori, prima che parta il codice', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain(`<meta name="theme-color" content="${surface().light}" />`);
    expect(html).toContain(`'${surface().dark}'`);
  });
});

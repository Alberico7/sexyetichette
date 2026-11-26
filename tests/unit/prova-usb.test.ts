import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Pagina di prova USB per browser vecchi (Chromium 83). Vedi docs/2026-11-27-prova-usb-browser-vecchi.md. */
describe('prova-usb.html: niente più recente di Chromium 83', () => {
  const html = readFileSync('public/prova-usb.html', 'utf8');
  const script = html.slice(html.indexOf('<script>'), html.lastIndexOf('</script>'));

  it.each([
    ['??=', 'assegnazione logica (Chromium 85)'],
    ['||=', 'assegnazione logica (Chromium 85)'],
    ['&&=', 'assegnazione logica (Chromium 85)'],
    ['.at(', 'Array.prototype.at (Chromium 92)'],
    ['structuredClone', 'structuredClone (Chromium 98)'],
    ['replaceAll', 'String.replaceAll (Chromium 85)'],
    ['findLast', 'findLast (Chromium 97)'],
    ['Object.hasOwn', 'Object.hasOwn (Chromium 93)'],
  ])('non usa %s — %s', (token) => {
    expect(script).not.toContain(token);
  });

  it('script classico, non un modulo; niente stili troppo recenti', () => {
    expect(html).not.toContain('type="module"');
    expect(html).not.toContain('light-dark(');
    expect(html).not.toMatch(/\d+dvh/);
  });
});
